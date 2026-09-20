import Phaser from 'phaser'
import {
  chooseMapLevel,
  mapTileManifest,
  tilePlacement,
  visibleTileCoordinates,
  type TileCoordinate,
} from './map-tiles'

type TileRecord = {
  tile: TileCoordinate
  status: 'loading' | 'ready' | 'error'
  image?: Phaser.GameObjects.Image
  lastNeeded: number
}

const keyFor = ({ level, column, row }: TileCoordinate) =>
  `world-map-${level.scale}-${column}-${row}`
const urlFor = ({ level, column, row }: TileCoordinate) =>
  `./assets/map/tiles/${level.scale}/${column}-${row}.webp`

export class MapTileStreamer {
  private readonly records = new Map<string, TileRecord>()
  private readonly fileError: (file: Phaser.Loader.File) => void

  constructor(private readonly scene: Phaser.Scene) {
    this.fileError = file => {
      const record = this.records.get(file.key)
      if (record) record.status = 'error'
    }
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.fileError)
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, time: number, rendererResolution: number) {
    const level = chooseMapLevel(mapTileManifest.levels, camera.zoom, rendererResolution)
    if (level) {
      const tiles = visibleTileCoordinates(mapTileManifest, level, camera.worldView, 1)
      for (const tile of tiles) this.require(tile, time)
    }
    this.releaseOldTiles(time)
  }

  destroy() {
    this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.fileError)
    for (const [key, record] of this.records) {
      record.image?.destroy()
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
    }
    this.records.clear()
  }

  private require(tile: TileCoordinate, time: number) {
    const key = keyFor(tile)
    const existing = this.records.get(key)
    if (existing) {
      existing.lastNeeded = time
      return
    }
    const record: TileRecord = { tile, status: 'loading', lastNeeded: time }
    this.records.set(key, record)
    this.scene.load.once(`filecomplete-image-${key}`, () => {
      const current = this.records.get(key)
      if (!current) {
        if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
        return
      }
      if (!this.scene.textures.exists(key)) return
      const placement = tilePlacement(mapTileManifest, tile)
      current.image = this.scene.add
        .image(placement.x, placement.y, key)
        .setOrigin(0)
        .setDisplaySize(placement.width, placement.height)
        .setDepth(-100 + tile.level.scale)
      current.status = 'ready'
    })
    this.scene.load.image(key, urlFor(tile))
    if (!this.scene.load.isLoading() && this.scene.load.isReady()) this.scene.load.start()
  }

  private releaseOldTiles(time: number) {
    for (const [key, record] of this.records) {
      if (time - record.lastNeeded < 8000) continue
      record.image?.destroy()
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
      this.records.delete(key)
    }
  }
}
