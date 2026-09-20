import { afterEach, describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { readFile, stat } from 'node:fs/promises'
import sharp from 'sharp'
import { AmbientTiles, ambientTileManifests } from './ambient-tiles'
import { mapTileManifest, tilePlacement } from './map-tiles'

afterEach(() => vi.unstubAllGlobals())
describe('animated ambient tiles', () => {
  it('pauses offscreen, during world pause and reduced motion, then resumes', () => {
    const media = { matches: false }
    vi.stubGlobal('window', { matchMedia: () => media })
    const makeSprite = () => {
    const sprite = { visible: false, paused: true,
      anims: { pause: () => { sprite.paused = true }, resume: () => { sprite.paused = false } },
      setVisible(value: boolean) { this.visible = value; return this },
      setOrigin() { return this }, setDisplaySize() { return this }, setDepth() { return this }, play() { return this },
    }
    return sprite
    }
    const sprites: ReturnType<typeof makeSprite>[] = []
    const scene = { anims: {exists: () => false, create: vi.fn()}, add: {sprite: () => { const sprite = makeSprite(); sprites.push(sprite); return sprite }} }
    const ambient = new AmbientTiles(scene as unknown as Phaser.Scene)
    for (const [animation] of scene.anims.create.mock.calls as [{ repeat: number; repeatDelay: number }][]) {
      expect(animation.repeat).toBe(-1)
      expect(animation.repeatDelay).toBe(0)
    }
    const camera = { width: 1671, height: 941, zoom: 1, scrollX: 0, scrollY: 0 } as Phaser.Cameras.Scene2D.Camera
    ambient.update(camera, false)
    expect(sprites.every(sprite => sprite.visible && !sprite.paused)).toBe(true)
    ambient.update(camera, true)
    expect(sprites.every(sprite => sprite.paused)).toBe(true)
    camera.scrollX = 5000
    ambient.update(camera, false)
    expect(sprites.every(sprite => !sprite.visible && sprite.paused)).toBe(true)
    camera.scrollX = 0; media.matches = true
    ambient.update(camera, false)
    expect(sprites.every(sprite => !sprite.visible && sprite.paused)).toBe(true)
    media.matches = false
    ambient.update(camera, false)
    expect(sprites.every(sprite => sprite.visible && !sprite.paused)).toBe(true)
  })
  it.each(ambientTileManifests)('keeps $id inside its tile with a closed loop and transparent borders', async (tile) => {
    const directory = new URL(`../public/assets/ambience/${tile.id}/`, import.meta.url)
    const json = JSON.parse(await readFile(new URL('atlas.json', directory), 'utf8'))
    const atlas = new URL('atlas.webp', directory)
    const image = await readFile(atlas)
    const metadata = await sharp(image).metadata()
    expect(metadata.width!).toBeLessThanOrEqual(2048)
    expect(metadata.height!).toBeLessThanOrEqual(2048)
    expect((await stat(atlas)).size).toBeLessThan(2 * 1024 * 1024)
    const [scale, coordinates] = tile.sourceTile.split('/')
    const [column, row] = coordinates.split('-').map(Number)
    const level = mapTileManifest.levels.find(level => level.scale === Number(scale))!
    const placement = tilePlacement(mapTileManifest, { level, column, row })
    const bounds = [placement.x, placement.y, placement.x + placement.width, placement.y + placement.height]
    expect(tile.x).toBeGreaterThan(bounds[0])
    expect(tile.x + tile.width).toBeLessThan(bounds[2])
    expect(tile.y).toBeGreaterThan(bounds[1])
    expect(tile.y + tile.height).toBeLessThan(bounds[3])
    let first: Buffer | undefined
    for (let i = 0; i < tile.frameCount; i++) {
      const f = json.frames[`ambient-${i}`].frame
      const pixels = await sharp(image).extract({left:f.x,top:f.y,width:f.w,height:f.h}).ensureAlpha().raw().toBuffer()
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
        if (x === 0 || y === 0 || x === f.w-1 || y === f.h-1) expect(pixels[(y*f.w+x)*4+3]).toBe(0)
      }
      if (i === 0) first = pixels
      if (i === tile.frameCount-1) {
        for (let pixel = 0; pixel < pixels.length; pixel += 4) {
          expect(pixels[pixel+3]).toBe(first![pixel+3])
          // Lossless WebP may discard RGB beneath fully transparent pixels.
          if (pixels[pixel+3]) for (let channel = 0; channel < 3; channel++)
            expect(pixels[pixel+channel]).toBe(first![pixel+channel])
        }
      }
    }
  })
})
