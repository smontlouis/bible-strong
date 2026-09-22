import type Phaser from 'phaser'

export type VisibleBounds = { x: number; y: number; width: number; height: number }
export function intersects(a: VisibleBounds, b: VisibleBounds) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function isInView(bounds: VisibleBounds, camera: Phaser.Cameras.Scene2D.Camera) {
  const width = camera.width / camera.zoom
  const height = camera.height / camera.zoom
  const left = camera.scrollX + (camera.width - width) / 2
  const top = camera.scrollY + (camera.height - height) / 2
  return (
    bounds.x < left + width &&
    bounds.x + bounds.width > left &&
    bounds.y < top + height &&
    bounds.y + bounds.height > top
  )
}

export type LazySceneAsset<T> = {
  bounds: VisibleBounds
  keys: string[]
  load: () => void
  create: () => T
}

/** One animation group at a time. Failed optional artwork keeps its static fallback. */
export class LazySceneAssets<T> {
  private readonly entries: {
    asset: LazySceneAsset<T>
    state: 'idle' | 'loading' | 'ready' | 'failed'
    value?: T
  }[]
  private readonly failed = (file: { key: string }) => {
    for (const entry of this.entries)
      if (entry.state === 'loading' && entry.asset.keys.includes(file.key)) entry.state = 'failed'
  }

  constructor(
    private readonly scene: Phaser.Scene,
    assets: LazySceneAsset<T>[]
  ) {
    this.entries = assets.map(asset => ({ asset, state: 'idle' }))
    scene.load.on('loaderror', this.failed)
    scene.events.once('shutdown', () => scene.load.off('loaderror', this.failed))
  }

  update(
    camera: Phaser.Cameras.Scene2D.Camera,
    enabled: boolean,
    update: (value: T) => void,
    loading: { view?: VisibleBounds; concurrent?: boolean } = {}
  ) {
    for (const entry of this.entries) {
      if (
        entry.state === 'loading' &&
        entry.asset.keys.every(key => this.scene.textures.exists(key))
      ) {
        entry.value = entry.asset.create()
        entry.state = 'ready'
      }
      if (entry.state === 'ready') update(entry.value!)
    }
    // Each stream has at most one group in flight, even when sharing the active loader.
    if (
      !enabled ||
      (!loading.concurrent && this.scene.load.isLoading()) ||
      this.entries.some(entry => entry.state === 'loading')
    )
      return
    const next = this.entries.find(
      entry =>
        entry.state === 'idle' &&
        (loading.view
          ? intersects(entry.asset.bounds, loading.view)
          : isInView(entry.asset.bounds, camera))
    )
    if (!next) return
    next.state = 'loading'
    next.asset.load()
    if (!this.scene.load.isLoading() && this.scene.load.isReady()) this.scene.load.start()
  }
}
