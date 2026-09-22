import type Phaser from 'phaser'
import { AssetReveal } from './asset-reveal'
import {
  chooseMapLevel,
  mapTileManifest,
  tilePlacement,
  visibleTileCoordinates,
  type TileCoordinate,
  type WorldView,
} from './map-tiles'
import { isInView } from './lazy-scene-assets'

type TileRecord = {
  tile: TileCoordinate
  status: 'loading' | 'ready' | 'error'
  image?: Phaser.GameObjects.Image
  complete: () => void
  reveal: AssetReveal
  lastNeeded: number
  lastAttempt: number
  bytes: number
}
const keyFor = ({ level, column, row }: TileCoordinate) =>
  `world-map-${level.scale}-${column}-${row}`
const urlFor = ({ level, column, row }: TileCoordinate) =>
  `./assets/map/tiles/${level.scale}/${column}-${row}.webp`
const CACHE_BYTES = 32 * 1024 * 1024
const BATCH_SIZE = 4

export class MapTileStreamer {
  private readonly records = new Map<string, TileRecord>()
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private previousView = ''
  private stableSince = 0
  private previousTime = 0
  private readonly fileError = (file: { key: string }) => {
    const record = this.records.get(file.key)
    if (!record) return
    this.scene.load.off(`filecomplete-image-${file.key}`, record.complete)
    record.status = 'error'
    record.bytes = 0
  }

  constructor(private readonly scene: Phaser.Scene) {
    scene.load.on('loaderror', this.fileError)
  }

  update(
    camera: Phaser.Cameras.Scene2D.Camera,
    time: number,
    rendererResolution: number,
    enabled = true,
    target?: { zoom: number; view: WorldView }
  ) {
    const delta = this.previousTime ? time - this.previousTime : 0
    this.previousTime = time
    const level = chooseMapLevel(
      mapTileManifest.levels,
      target?.zoom ?? camera.zoom,
      rendererResolution
    )
    // worldView still describes the preceding frame until Phaser's preRender.
    const width = camera.width / camera.zoom,
      height = camera.height / camera.zoom
    const view = target?.view ?? {
      x: camera.scrollX + (camera.width - width) / 2,
      y: camera.scrollY + (camera.height - height) / 2,
      width,
      height,
    }
    const signature = `${level?.scale}:${Math.round(view.x)}:${Math.round(view.y)}:${Math.round(view.width)}:${Math.round(view.height)}`
    if (signature !== this.previousView) {
      this.previousView = signature
      this.stableSince = time
    }
    const visible = level ? visibleTileCoordinates(mapTileManifest, level, view, 0) : []
    const needed = new Set(visible.map(keyFor))
    for (const [key, record] of this.records) {
      if (needed.has(key)) record.lastNeeded = time
      if (record.image) {
        const shown =
          record.tile.level === level &&
          isInView(tilePlacement(mapTileManifest, record.tile), camera)
        record.image
          .setVisible(shown)
          .setAlpha(record.reveal.update(delta, shown, this.reducedMotion.matches))
      }
    }
    if (enabled && level && !this.scene.load.isLoading() && this.scene.load.isReady()) {
      const allVisibleReady = visible.every(
        tile => this.records.get(keyFor(tile))?.status === 'ready'
      )
      const candidates =
        !target && allVisibleReady && time - this.stableSince >= 200
          ? visibleTileCoordinates(mapTileManifest, level, view, 1)
          : visible
      // Visible tiles always win; the peripheral ring is only requested after the camera settles.
      candidates.sort((a, b) => this.distance(a, view) - this.distance(b, view))
      let queued = 0
      let reservedBytes = [...this.records.values()].reduce(
        (total, record) => total + record.bytes,
        0
      )
      for (const tile of candidates) {
        const record = this.records.get(keyFor(tile))
        if (record && (record.status !== 'error' || time - record.lastAttempt < 5000)) continue
        const bytes = this.tileBytes(tile)
        if (!needed.has(keyFor(tile)) && reservedBytes + bytes > CACHE_BYTES) continue
        this.require(tile, time)
        reservedBytes += bytes
        if (++queued === BATCH_SIZE) break
      }
      if (queued) this.scene.load.start()
    }
    this.releaseOldTiles(needed)
  }

  destroy() {
    this.scene.load.off('loaderror', this.fileError)
    for (const key of [...this.records.keys()]) this.release(key)
  }

  private tileBytes(tile: TileCoordinate) {
    const placement = tilePlacement(mapTileManifest, tile)
    return (
      Math.round(placement.width * tile.level.scale) *
      Math.round(placement.height * tile.level.scale) *
      4
    )
  }

  private distance(
    tile: TileCoordinate,
    view: { x: number; y: number; width: number; height: number }
  ) {
    const p = tilePlacement(mapTileManifest, tile)
    return (
      (p.x + p.width / 2 - view.x - view.width / 2) ** 2 +
      (p.y + p.height / 2 - view.y - view.height / 2) ** 2
    )
  }

  private require(tile: TileCoordinate, time: number) {
    const key = keyFor(tile)
    const record: TileRecord = {
      tile,
      status: 'loading',
      lastNeeded: time,
      lastAttempt: time,
      bytes: this.tileBytes(tile),
      reveal: new AssetReveal(),
      complete: () => {
        if (this.records.get(key) !== record || !this.scene.textures.exists(key)) return
        const placement = tilePlacement(mapTileManifest, tile)
        record.image = this.scene.add
          .image(placement.x, placement.y, key)
          .setOrigin(0)
          .setDisplaySize(placement.width, placement.height)
          .setDepth(-100 + tile.level.scale)
          .setAlpha(0)
        record.bytes =
          Math.round(placement.width * tile.level.scale) *
          Math.round(placement.height * tile.level.scale) *
          4
        record.status = 'ready'
      },
    }
    this.records.set(key, record)
    this.scene.load.once(`filecomplete-image-${key}`, record.complete)
    this.scene.load.image(key, urlFor(tile))
  }

  private release(key: string) {
    const record = this.records.get(key)!
    this.scene.load.off(`filecomplete-image-${key}`, record.complete)
    record.image?.destroy()
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
    this.records.delete(key)
  }

  private releaseOldTiles(needed: Set<string>) {
    let bytes = [...this.records.values()].reduce((total, record) => total + record.bytes, 0)
    const oldest = [...this.records.entries()]
      .filter(([key, record]) => !needed.has(key) && record.status === 'ready')
      .sort((a, b) => a[1].lastNeeded - b[1].lastNeeded)
    for (const [key, record] of oldest) {
      if (bytes <= CACHE_BYTES) break
      bytes -= record.bytes
      this.release(key)
    }
  }
}
