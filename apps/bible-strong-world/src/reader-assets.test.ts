import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'))

describe('shipped reader animations', () => {
  it('ships every frame once, in order, inside a transparent atlas supported by mobile GPUs', async () => {
    const manifests = (await readdir(resolve(root, 'src/generated'))).filter(name =>
      name.endsWith('-reader.json')
    )
    expect(manifests).toHaveLength(7)
    for (const file of manifests) {
      const manifest = await readJson(resolve(root, 'src/generated', file))
      const directory = resolve(root, 'public/assets/characters', file.replace('.json', ''))
      let sequence = 0
      for (const page of manifest.pages) {
        const atlas = await readJson(resolve(directory, `${page.key}.json`))
        const { data, info } = await sharp(resolve(directory, `${page.key}.webp`))
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })
        expect(info.width).toBe(page.width)
        expect(info.height).toBe(page.height)
        expect(Math.max(info.width, info.height)).toBeLessThanOrEqual(2048)
        expect(page.firstFrame).toBe(sequence)
        expect(Object.keys(atlas.frames)).toHaveLength(page.frameCount)
        for (const [name, entry] of Object.entries(atlas.frames)) {
          const { frame } = entry as { frame: { x: number; y: number; w: number; h: number } }
          expect(name).toBe(`reader-${String(sequence++).padStart(3, '0')}`)
          expect(frame.x + frame.w).toBeLessThanOrEqual(info.width)
          expect(frame.y + frame.h).toBeLessThanOrEqual(info.height)
          // A transparent gutter prevents neighboring poses bleeding into the rendered sprite.
          expect(data[((frame.y - 1) * info.width + frame.x - 1) * 4 + 3]).toBe(0)
          let hasSubject = false
          let hasTransparency = false
          for (let y = frame.y; y < frame.y + frame.h && !(hasSubject && hasTransparency); y++) {
            for (let x = frame.x; x < frame.x + frame.w; x++) {
              const alpha = data[(y * info.width + x) * 4 + 3]
              hasSubject ||= alpha > 200
              hasTransparency ||= alpha === 0
            }
          }
          expect(hasSubject, `${file}: ${name} is empty`).toBe(true)
          expect(hasTransparency, `${file}: ${name} is opaque`).toBe(true)
        }
      }
      expect(sequence).toBe(manifest.frameCount)
      expect(sequence / manifest.frameRate).toBe(manifest.duration)
    }
  }, 15000)

  it('keeps the comparison readers on one timeline with separate desk depths', async () => {
    const left = await readJson(resolve(root, 'src/generated/comparison-left-reader.json'))
    const right = await readJson(resolve(root, 'src/generated/comparison-right-reader.json'))
    expect(left.synchronize && right.synchronize).toBe(true)
    expect(left.frameCount).toBe(right.frameCount)
    expect(left.frameRate).toBe(right.frameRate)
    expect(left.depth).toBeLessThan(right.depth)
    expect(left.x + left.width).toBeLessThan(right.x)
  })
})
