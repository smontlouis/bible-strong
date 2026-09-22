import type Phaser from 'phaser'
import { AmbientTiles, ambientTileManifests, loadAmbientTiles } from './ambient-tiles'
import { AnimatedReader, loadReader } from './animated-reader'
import { CentralBook, loadCentralBook } from './central-book'
import book from './generated/central-book.json'
import { LazySceneAssets, type LazySceneAsset, type VisibleBounds } from './lazy-scene-assets'
import { worldReaders } from './world-readers'

type Animation = (
  camera: Phaser.Cameras.Scene2D.Camera,
  delta: number,
  paused: boolean,
  avatarX: number
) => void

export class LazyWorldAnimations {
  private readonly assets: LazySceneAssets<Animation>
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  constructor(scene: Phaser.Scene) {
    const assets: LazySceneAsset<Animation>[] = [
      {
        bounds: book,
        keys: book.pages.map(page => `central-book-${page.key}`),
        load: () => loadCentralBook(scene),
        create: () => {
          const animation = new CentralBook(scene)
          return (camera, delta, paused) => animation.update(camera, delta, paused)
        },
      },
    ]
    // Both comparison readers share a clock: load and instantiate them together.
    const readerGroups = [
      ...worldReaders.filter(reader => !reader.manifest.synchronize).map(reader => [reader]),
      worldReaders.filter(reader => reader.manifest.synchronize),
    ].filter(group => group.length)
    for (const readers of readerGroups) {
      const x = Math.min(...readers.map(({ manifest }) => manifest.x))
      const y = Math.min(...readers.map(({ manifest }) => manifest.y))
      assets.push({
        bounds: {
          x,
          y,
          width: Math.max(...readers.map(({ manifest }) => manifest.x + manifest.width)) - x,
          height: Math.max(...readers.map(({ manifest }) => manifest.y + manifest.height)) - y,
        },
        keys: readers.flatMap(({ id, manifest }) =>
          manifest.pages.map(page => `${id}-${page.key}`)
        ),
        load: () => {
          for (const { id, manifest } of readers) loadReader(scene, id, manifest)
        },
        create: () => {
          const animations = readers.map(
            ({ id, manifest }) => new AnimatedReader(scene, id, manifest)
          )
          return (camera, delta, paused, avatarX) => {
            for (const animation of animations) animation.update(camera, paused, avatarX, delta)
          }
        },
      })
    }
    for (const tile of ambientTileManifests)
      assets.push({
        bounds: tile,
        keys: [tile.id],
        load: () => loadAmbientTiles(scene, [tile]),
        create: () => {
          const animation = new AmbientTiles(scene, [tile])
          return (camera, delta, paused) => animation.update(camera, paused, delta)
        },
      })
    this.assets = new LazySceneAssets(scene, assets)
  }

  update(
    camera: Phaser.Cameras.Scene2D.Camera,
    delta: number,
    paused: boolean,
    avatarX: number,
    loading: { enabled: boolean; view?: VisibleBounds }
  ) {
    this.assets.update(
      camera,
      loading.enabled && !this.reducedMotion.matches,
      animation => animation(camera, delta, paused, avatarX),
      { view: loading.view, concurrent: true }
    )
  }
}
