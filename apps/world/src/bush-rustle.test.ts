import { afterEach, describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { BushRustle, touchesBush, type BushMask } from './bush-rustle'

const shape = { x: 100, y: 100, width: 60, height: 40 }
const mask: BushMask = { width: 60, height: 40, alpha: new Uint8ClampedArray(60 * 40 * 4) }
// An opaque patch inside a mostly transparent cutout.
for (let y = 10; y < 30; y++) for (let x = 20; x < 40; x++) mask.alpha[(y * 60 + x) * 4 + 3] = 255

describe('bush contact', () => {
  it('reacts continuously while moving, and stops immediately when stationary', () => {
    for (let x = 123; x <= 135; x++)
      expect(touchesBush(shape, mask, { x, y: 124, moving: true })).toBe(true)
    expect(touchesBush(shape, mask, { x: 135, y: 124, moving: false })).toBe(false)
  })

  it('includes a small margin around the opaque silhouette', () => {
    expect(touchesBush(shape, mask, { x: 110, y: 124, moving: true })).toBe(true)
    expect(touchesBush(shape, mask, { x: 106, y: 124, moving: true })).toBe(false)
  })

  it('ignores transparent corners and distant avatars', () => {
    expect(touchesBush(shape, mask, { x: 101, y: 104, moving: true })).toBe(false)
    expect(touchesBush(shape, mask, { x: 500, y: 500, moving: true })).toBe(false)
  })
})

// Exercise the animation lifecycle with an opaque 60 × 40 cutout.

afterEach(() => vi.unstubAllGlobals())

function setup() {
  function display() {
    return {
      x: 0,
      y: 0,
      depth: 120,
      rotation: 0,
      visible: true,
      alpha: 1,
      texture: { key: 'bush', getSourceImage: () => ({}) },
      setStrokeStyle() {
        return this
      },
      setOrigin() {
        return this
      },
      setDisplaySize() {
        return this
      },
      setPosition(x: number, y: number) {
        this.x = x
        this.y = y
        return this
      },
      setDepth(depth: number) {
        this.depth = depth
        return this
      },
      setRotation(rotation: number) {
        this.rotation = rotation
        return this
      },
      setVisible(visible: boolean) {
        this.visible = visible
        return this
      },
      setAlpha(alpha: number) {
        this.alpha = alpha
        return this
      },
    }
  }
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray(60 * 40 * 4).fill(255) }),
      }),
    }),
  })
  const rope = { ...display(), vertices: new Float32Array(8), dirty: true }
  const particles: ReturnType<typeof display>[] = []
  const scene = {
    game: { renderer: { type: 2 } },
    add: {
      rope: () => rope,
      ellipse: () => {
        const leaf = display()
        particles.push(leaf)
        return leaf
      },
    },
  }
  const rustle = new BushRustle(scene as unknown as Phaser.Scene, [
    {
      object: { ...shape, id: 'plaza-west-shrub', baseY: 140 },
      image: display() as unknown as Phaser.GameObjects.Image,
    },
  ])
  return { rustle, rope, particles }
}

describe('bush animation lifecycle', () => {
  it('keeps rustling during contact then restores the canopy and stops emitting immediately', () => {
    const { rustle, rope, particles } = setup()
    const rest = [...rope.vertices]
    const contact = { x: 125, y: 125, moving: true }
    for (let i = 0; i < 60; i++) rustle.update(16, [contact], false)
    expect([...rope.vertices]).not.toEqual(rest)
    expect(particles.some(leaf => leaf.visible)).toBe(true)
    rustle.update(16, [{ ...contact, moving: false }], false)
    expect([...rope.vertices]).toEqual(rest)
    for (let i = 0; i < 60; i++) rustle.update(16, [{ ...contact, moving: false }], false)
    expect(particles.every(leaf => !leaf.visible)).toBe(true)
    expect(particles).toHaveLength(64)
  })

  it('reacts to another moving avatar and clears effects when paused or motion is reduced', () => {
    const { rustle, rope, particles } = setup()
    const rest = [...rope.vertices]
    const avatars = [
      { x: 125, y: 125, moving: false },
      { x: 130, y: 125, moving: true },
    ]
    rustle.update(16, avatars, false)
    expect([...rope.vertices]).not.toEqual(rest)
    rustle.update(16, avatars, true)
    expect([...rope.vertices]).toEqual(rest)
    expect(particles.every(leaf => !leaf.visible)).toBe(true)
    rustle.update(16, avatars, false)
    expect([...rope.vertices]).not.toEqual(rest)
  })
})
