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
      const sprite = {
        visible: false,
        paused: true,
        anims: {
          pause: () => {
            sprite.paused = true
          },
          resume: () => {
            sprite.paused = false
          },
        },
        setVisible(value: boolean) {
          this.visible = value
          return this
        },
        setOrigin() {
          return this
        },
        setDisplaySize() {
          return this
        },
        setDepth() {
          return this
        },
        play() {
          return this
        },
      }
      return sprite
    }
    const sprites: ReturnType<typeof makeSprite>[] = []
    const scene = {
      anims: { exists: () => false, create: vi.fn() },
      add: {
        sprite: () => {
          const sprite = makeSprite()
          sprites.push(sprite)
          return sprite
        },
      },
    }
    const ambient = new AmbientTiles(scene as unknown as Phaser.Scene)
    for (const [animation] of scene.anims.create.mock.calls as [
      { repeat: number; repeatDelay: number },
    ][]) {
      expect(animation.repeat).toBe(-1)
      expect(animation.repeatDelay).toBe(0)
    }
    const camera = {
      width: 1671,
      height: 941,
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
    } as Phaser.Cameras.Scene2D.Camera
    ambient.update(camera, false)
    expect(sprites.every(sprite => sprite.visible && !sprite.paused)).toBe(true)
    ambient.update(camera, true)
    expect(sprites.every(sprite => sprite.paused)).toBe(true)
    camera.scrollX = 5000
    ambient.update(camera, false)
    expect(sprites.every(sprite => !sprite.visible && sprite.paused)).toBe(true)
    camera.scrollX = 0
    media.matches = true
    ambient.update(camera, false)
    expect(sprites.every(sprite => !sprite.visible && sprite.paused)).toBe(true)
    media.matches = false
    ambient.update(camera, false)
    expect(sprites.every(sprite => sprite.visible && !sprite.paused)).toBe(true)
  })
  it.each(ambientTileManifests)(
    'keeps $id inside its tile with a closed loop and transparent borders',
    async tile => {
      const directory = new URL(`../public/assets/ambience/${tile.id}/`, import.meta.url)
      const json = JSON.parse(await readFile(new URL('atlas.json', directory), 'utf8'))
      const atlas = new URL('atlas.webp', directory)
      const image = await readFile(atlas)
      const metadata = await sharp(image).metadata()
      expect(metadata.width!).toBeLessThanOrEqual(2048)
      expect(metadata.height!).toBeLessThanOrEqual(2048)
      expect((await stat(atlas)).size).toBeLessThan(2 * 1024 * 1024)
      // Decode once: checking every frame must not repeatedly decompress the full atlas.
      const decoded = await sharp(image).ensureAlpha().raw().toBuffer()
      const [scale, coordinates] = tile.sourceTile.split('/')
      const [column, row] = coordinates.split('-').map(Number)
      const level = mapTileManifest.levels.find(level => level.scale === Number(scale))!
      const placement = tilePlacement(mapTileManifest, { level, column, row })
      const bounds = [
        placement.x,
        placement.y,
        placement.x + placement.width,
        placement.y + placement.height,
      ]
      expect(tile.x).toBeGreaterThan(bounds[0])
      expect(tile.x + tile.width).toBeLessThan(bounds[2])
      expect(tile.y).toBeGreaterThan(bounds[1])
      expect(tile.y + tile.height).toBeLessThan(bounds[3])
      let first: Buffer | undefined
      let changed = false
      for (let i = 0; i < tile.frameCount; i++) {
        const f = json.frames[`ambient-${i}`].frame
        const pixels = Buffer.alloc(f.w * f.h * 4)
        for (let y = 0; y < f.h; y++) {
          const start = ((f.y + y) * metadata.width! + f.x) * 4
          decoded.copy(pixels, y * f.w * 4, start, start + f.w * 4)
        }
        let transparentBorder = true
        for (let y = 0; y < f.h; y++)
          for (let x = 0; x < f.w; x++) {
            const index = (y * f.w + x) * 4
            if (x === 0 || y === 0 || x === f.w - 1 || y === f.h - 1)
              transparentBorder &&= pixels[index + 3] === 0
            // Lossless WebP may discard RGB beneath fully transparent pixels.
            if (!pixels[index + 3]) pixels.fill(0, index, index + 3)
          }
        expect(transparentBorder, `${tile.id} frame ${i} border`).toBe(true)
        if (i === 0) first = pixels
        if (tile.id.startsWith('living-')) {
          const visible = pixels.some((value, index) => index % 4 === 3 && value > 127)
          expect(visible, `${tile.id} frame ${i} must retain its animal`).toBe(true)
          if (first && !pixels.equals(first)) changed = true
        }
        if (i === tile.frameCount - 1) expect(pixels.equals(first!)).toBe(true)
      }
      if (tile.id.startsWith('living-'))
        expect(changed, `${tile.id} must actually animate`).toBe(true)
    }
  )
  it('ships all ten approved wildlife scenes within the combined texture budget', async () => {
    const wildlife = ambientTileManifests.filter(tile => tile.id.startsWith('living-'))
    expect(wildlife).toHaveLength(10)
    expect(new Set(wildlife.map(tile => tile.sourceTile)).size).toBe(10)
    let decodedBytes = 0
    for (const tile of wildlife) {
      const image = await readFile(
        new URL(`../public/assets/ambience/${tile.id}/atlas.webp`, import.meta.url)
      )
      const metadata = await sharp(image).metadata()
      decodedBytes += metadata.width! * metadata.height! * 4
    }
    expect(decodedBytes).toBeLessThan(32 * 1024 * 1024)
  })
})
