import type Phaser from 'phaser'
import { AssetReveal } from '../asset-reveal'
import type { BushRustle } from '../bush-rustle'
import { isInView, LazySceneAssets, type VisibleBounds } from '../lazy-scene-assets'
import occluderManifest from './generated/occluders.json'

export type ValenceOccluder = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  baseY: number
  url: string
}
export const valenceOccluders = occluderManifest as ValenceOccluder[]

/** Shrubs and low hedges rustle when someone walks through them; tall trees and cypresses don't. */
export function isValenceShrub(object: { id: string; width: number; height: number }) {
  return object.id.startsWith('tree-') && (object.height <= 50 || object.width > object.height * 1.15)
}

type Entry = { object: ValenceOccluder; image: Phaser.GameObjects.Image; reveal: AssetReveal }

/** Source-aligned cutouts above the map, sorted by their ground line against the avatar. */
export class ValenceOccluders {
  private readonly assets: LazySceneAssets<Entry[]>
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  constructor(scene: Phaser.Scene, bushes: BushRustle, objects: ValenceOccluder[] = valenceOccluders) {
    const groups = new Map<string, ValenceOccluder[]>()
    for (const object of objects) {
      const key = `${Math.floor(object.x / 256)}:${Math.floor(object.y / 256)}`
      groups.set(key, [...(groups.get(key) ?? []), object])
    }
    this.assets = new LazySceneAssets(
      scene,
      [...groups.values()].map(group => {
        const x = Math.min(...group.map(o => o.x)) - 80
        const y = Math.min(...group.map(o => o.y)) - 80
        return {
          bounds: {
            x,
            y,
            width: Math.max(...group.map(o => o.x + o.width)) + 80 - x,
            height: Math.max(...group.map(o => o.y + o.height)) + 80 - y,
          },
          keys: group.map(o => `valence-occluder-${o.id}`),
          load: () => {
            for (const o of group) scene.load.image(`valence-occluder-${o.id}`, o.url)
          },
          create: () => {
            const entries = group.map(object => ({
              object,
              reveal: new AssetReveal(),
              image: scene.add
                .image(object.x, object.y, `valence-occluder-${object.id}`)
                .setOrigin(0)
                .setDisplaySize(object.width, object.height)
                .setDepth(object.baseY)
                .setAlpha(0),
            }))
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
