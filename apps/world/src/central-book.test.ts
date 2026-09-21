import { afterEach, describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { CentralBook } from './central-book'
import book from './generated/central-book.json'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

function setup() {
  const media = { matches: false }
  vi.stubGlobal('window', { matchMedia: () => media })
  const sprite = {
    visible: true, frame: 'book-0',
    setOrigin() { return this }, setDisplaySize() { return this }, setDepth() { return this },
    setVisible(value: boolean) { this.visible = value; return this },
    setTexture(_key: string, frame: string) { this.frame = frame; return this },
  }
  const scene = { add: { image: () => sprite } } as unknown as Phaser.Scene
  const animation = new CentralBook(scene)
  const camera = { width: 1671, height: 941, zoom: 1, scrollX: 0, scrollY: 0 } as Phaser.Cameras.Scene2D.Camera
  const advance = (milliseconds: number, paused = false) => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 100)
      animation.update(camera, Math.min(100, milliseconds - elapsed), paused)
  }
  return { animation, sprite, camera, media, advance }
}

describe('central book', () => {
  it('chooses a fresh 2–5 second rest after each full loop, holding the settled pose', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(1)
    const { sprite, advance } = setup()
    advance(10_000)
    expect(random).toHaveBeenCalledTimes(1)
    advance(1900)
    expect(sprite.frame).toBe('book-0')
    advance(100)
    expect(sprite.frame).toBe('book-0')
    advance(100)
    expect(sprite.frame).toBe('book-1')
    advance(9900)
    expect(random).toHaveBeenCalledTimes(2)
    advance(4900)
    expect(sprite.frame).toBe('book-0')
    advance(100)
    expect(sprite.frame).toBe('book-0')
    advance(100)
    expect(sprite.frame).toBe('book-1')
  })

  it('freezes page turns and rest countdowns while paused, offscreen or reduced motion', () => {
    vi.spyOn(Math, 'random').mockReturnValue(.5)
    const { sprite, camera, media, advance } = setup()
    advance(1500)
    const turningFrame = sprite.frame
    advance(8000, true)
    expect(sprite.frame).toBe(turningFrame)
    camera.scrollX = 5000
    advance(8000)
    expect(sprite.frame).toBe(turningFrame)
    expect(sprite.visible).toBe(false)
    camera.scrollX = 0; media.matches = true
    advance(8000)
    expect(sprite.frame).toBe(turningFrame)
    expect(sprite.visible).toBe(false)
    media.matches = false
    advance(8500)
    expect(sprite.visible).toBe(true)
    expect(sprite.frame).toBe('book-0')
    advance(2000)
    advance(8000, true)
    camera.scrollX = 5000; advance(8000); camera.scrollX = 0
    media.matches = true; advance(8000); media.matches = false
    advance(1400)
    expect(sprite.frame).toBe('book-0')
    advance(100)
    expect(sprite.frame).toBe('book-0')
    advance(100)
    expect(sprite.frame).toBe('book-1')
  })

  it('ships transparent, bounded atlases with real page motion and identical resting endpoints', async () => {
    const sprites: Buffer[] = []
    let bytes = 0
    for (const page of book.pages) {
      const directory = new URL('../public/assets/ambience/central-book/', import.meta.url)
      const image = await readFile(new URL(`${page.key}.webp`, directory))
      bytes += image.length
      const atlas = JSON.parse(await readFile(new URL(`${page.key}.json`, directory), 'utf8'))
      const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      expect(info.width).toBeLessThanOrEqual(2048)
      expect(info.height).toBeLessThanOrEqual(2048)
      for (let f = page.firstFrame; f < page.firstFrame + page.frameCount; f++) {
        const { x, y, w, h } = atlas.frames[`book-${f}`].frame
        expect(x + w).toBeLessThanOrEqual(info.width)
        expect(y + h).toBeLessThanOrEqual(info.height)
        const pixels = Buffer.alloc(w * h * 4)
        let opaque = 0, cream = 0
        for (let row = 0; row < h; row++) for (let column = 0; column < w; column++) {
          const source = ((y + row) * info.width + x + column) * 4
          const target = (row * w + column) * 4
          if (data[source + 3]) { data.copy(pixels, target, source, source + 4); opaque++ }
          if (data[source + 3] > 200 && data[source] > 200 && data[source + 1] > 180 && data[source + 2] > 140) cream++
          if (!row || !column || row === h - 1 || column === w - 1)
            expect(data[source + 3]).toBe(0)
        }
        expect(opaque).toBeGreaterThan(w * h * .2)
        expect(opaque).toBeLessThan(w * h * .9)
        expect(cream).toBeGreaterThan(w * h * .15)
        sprites.push(pixels)
      }
    }
    expect(bytes).toBeLessThan(4 * 1024 * 1024)
    expect(sprites).toHaveLength(book.frameCount)
    let endpointDifference = 0
    for (let i = 0; i < sprites[0].length; i++)
      endpointDifference += Math.abs(sprites[0][i] - sprites.at(-1)![i])
    expect(endpointDifference / sprites[0].length).toBeLessThan(2)
    expect(sprites[0].equals(sprites[18])).toBe(false)
    expect(book.depth).toBe(489.1)
  })
})
