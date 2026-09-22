import type Phaser from 'phaser'
import { AssetReveal } from './asset-reveal'
import { BushRustle } from './bush-rustle'
import { isInView, LazySceneAssets, type VisibleBounds } from './lazy-scene-assets'
import { maskSignGround } from './occluder-masks'
import { occluders } from './world'

type Entry = {
  object: (typeof occluders)[number]
  image: Phaser.GameObjects.Image
  reveal: AssetReveal
}

/** Nearby cutouts restore foreground depth while distant islands use the flat map. */
export class LazyOccluders {
  private readonly assets: LazySceneAssets<Entry[]>
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  constructor(scene: Phaser.Scene, bushes: BushRustle) {
    const groups = new Map<string, typeof occluders>()
    for (const object of occluders) {
      const key = `${Math.floor(object.x / 256)}:${Math.floor(object.y / 256)}`
      const group = groups.get(key) ?? []
      group.push(object)
      groups.set(key, group)
    }
    this.assets = new LazySceneAssets(
      scene,
      [...groups.values()].map(objects => {
        const x = Math.min(...objects.map(object => object.x)) - 80
        const y = Math.min(...objects.map(object => object.y)) - 80
        return {
          bounds: {
            x,
            y,
            width: Math.max(...objects.map(object => object.x + object.width)) + 80 - x,
            height: Math.max(...objects.map(object => object.y + object.height)) + 80 - y,
          },
          keys: objects.map(object => `occlusion-${object.id}`),
          load: () => {
            for (const object of objects) scene.load.image(`occlusion-${object.id}`, object.url)
          },
          create: () => {
            const entries = objects.map(object => {
              const image = scene.add
                .image(object.x, object.y, `occlusion-${object.id}`)
                .setOrigin(0)
                .setDisplaySize(object.width, object.height)
                .setDepth(object.always ? 2000 : object.baseY)
                .setAlpha(0)
              maskSignGround(scene, object, image)
              return { object, image, reveal: new AssetReveal() }
            })
            bushes.add(entries)
            return entries
          },
        }
      })
    )
  }

  update(
    camera: Phaser.Cameras.Scene2D.Camera,
    delta: number,
    enabled: boolean,
    loadView?: VisibleBounds
  ) {
    this.assets.update(
      camera,
      enabled,
      entries => {
        for (const { object, image, reveal } of entries)
          image.setAlpha(reveal.update(delta, isInView(object, camera), this.reducedMotion.matches))
      },
      { view: loadView, concurrent: true }
    )
  }
}
