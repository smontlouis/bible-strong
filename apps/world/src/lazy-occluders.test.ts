import type Phaser from 'phaser'
import { afterEach, expect, it, vi } from 'vitest'
import { LazyOccluders } from './lazy-occluders'
import { occlusionDepth } from './occlusion-depth'
import type { BushRustle } from './bush-rustle'

vi.mock('./world', () => ({
  occluders: [
    { id: 'dictionary-desk', x: 246, y: 230, width: 148, height: 90, baseY: 308, always: false },
    { id: 'foreground', x: 246, y: 230, width: 148, height: 90, baseY: 308, always: true },
  ],
}))
vi.mock('./lazy-scene-assets', () => ({
  isInView: () => true,
  LazySceneAssets: class {
    values: unknown[]
    constructor(_scene: unknown, assets: { create: () => unknown }[]) {
      this.values = assets.map(asset => asset.create())
    }
    update(_camera: unknown, _enabled: boolean, update: (value: unknown) => void) {
      this.values.forEach(update)
    }
  },
}))

afterEach(() => vi.unstubAllGlobals())

it('keeps the loaded desk below its reader from both sides, including when streaming is paused', () => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
  const images: { depth: number; setDepth: (depth: number) => unknown }[] = []
  const scene = {
    add: {
      image: () => {
        const image = {
          depth: 0,
          setOrigin() {
            return this
          },
          setDisplaySize() {
            return this
          },
          setAlpha() {
            return this
          },
          setDepth(depth: number) {
            this.depth = depth
            return this
          },
        }
        images.push(image)
        return image
      },
    },
  } as unknown as Phaser.Scene
  const occluders = new LazyOccluders(scene, { add() {} } as unknown as BushRustle)
  for (const x of [394, 246, 300, 350]) {
    occluders.update({} as Phaser.Cameras.Scene2D.Camera, 16, false, x)
    expect(images[0].depth).toBeCloseTo(occlusionDepth('dictionary-reader', 308.1, x) - 0.1)
    expect(images[1].depth).toBe(2000)
  }
})
