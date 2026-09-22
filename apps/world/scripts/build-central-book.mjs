import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const work = resolve(root, 'art-workbench/experiments/central-book-v1')
const output = resolve(root, 'public/assets/ambience/central-book')
const { worldRegion } = JSON.parse(await readFile(resolve(work, 'crop.json'), 'utf8'))
const count = 120, frameRate = 12
await mkdir(output, { recursive: true })
for (const [video, folder] of [['input-12fps.mp4', 'frames'], ['mask.mp4', 'masks']]) {
  await mkdir(resolve(work, folder), { recursive: true })
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', resolve(work, video), '-vf', 'fps=12',
    '-frames:v', String(count), resolve(work, folder, '%03d.png')])
}
const filename = index => `${String(index + 1).padStart(3, '0')}.png`
const { width, height } = await sharp(resolve(work, 'frames', filename(0))).metadata()
const masks = []
let left = width, top = height, right = 0, bottom = 0
for (let f = 0; f < count; f++) {
  const mask = await sharp(resolve(work, 'masks', filename(f))).greyscale().raw().toBuffer()
  if (mask.length !== width * height) throw Error('Mask and video dimensions differ')
  let area = 0
  for (let i = 0; i < mask.length; i++) {
    mask[i] = mask[i] > 127 ? 255 : 0
    if (!mask[i]) continue
    const x = i % width, y = Math.floor(i / width)
    if (x < width * .14 || x > width * .85 || y > height * .69)
      throw Error('Book segmentation escaped its reviewed region')
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
    area++
  }
  if (area < width * height * .18 || area > width * height * .4)
    throw Error(`Unexpected book mask area at frame ${f}`)
  masks.push(mask)
}
left = Math.max(0, left - 8); top = Math.max(0, top - 8)
right = Math.min(width - 1, right + 8); bottom = Math.min(height - 1, bottom + 8)
const crop = { left, top, width: right - left + 1, height: bottom - top + 1 }
const fw = Math.round(crop.width / width * worldRegion.width * 2)
const fh = Math.round(crop.height / height * worldRegion.height * 2)
const sprites = []
for (let f = 0; f < count; f++) {
  // Cover the original book footprint too: moving paper must not reveal a second book.
  const union = Buffer.from(masks[f].map((value, i) => Math.max(value, masks[0][i])))
  const alpha = await sharp(union, { raw: { width, height, channels: 1 } })
    .dilate(2).blur(.5).greyscale().raw().toBuffer()
  const rgb = await sharp(resolve(work, 'frames', filename(f))).removeAlpha().raw().toBuffer()
  const joined = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png().toBuffer()
  const rgba = await sharp(joined).extract(crop).resize(fw, fh).raw().toBuffer()
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++)
    if (x < 2 || y < 2 || x >= fw - 2 || y >= fh - 2) rgba[(y * fw + x) * 4 + 3] = 0
  sprites.push(rgba)
}
// The pages have settled by this point; close the loop to one identical resting pose.
for (let f = count - 6; f < count; f++) {
  const blend = (f - (count - 7)) / 6
  for (let i = 0; i < sprites[f].length; i++)
    sprites[f][i] = Math.round(sprites[f][i] * (1 - blend) + sprites[0][i] * blend)
}
const cw = fw + 4, ch = fh + 4
const columns = Math.floor(2048 / cw), capacity = columns * Math.floor(2048 / ch)
const pages = []
for (let offset = 0; offset < count; offset += capacity) {
  const frameCount = Math.min(capacity, count - offset)
  const atlasWidth = columns * cw, atlasHeight = Math.ceil(frameCount / columns) * ch
  const composites = [], frames = {}, key = `book-${pages.length}`
  for (let i = 0; i < frameCount; i++) {
    const f = offset + i, x = i % columns * cw + 2, y = Math.floor(i / columns) * ch + 2
    const input = await sharp(sprites[f], { raw: { width: fw, height: fh, channels: 4 } }).png().toBuffer()
    composites.push({ input, left: x, top: y })
    frames[`book-${f}`] = { frame: { x, y, w: fw, h: fh }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: fw, h: fh }, sourceSize: { w: fw, h: fh } }
    if ([0, 18, 30, 66, 80, 119].includes(f)) await writeFile(resolve(work, `cutout-${f}.png`), input)
  }
  await sharp({ create: { width: atlasWidth, height: atlasHeight, channels: 4, background: '#00000000' } })
    .composite(composites).webp({ quality: 92, alphaQuality: 100 }).toFile(resolve(output, `${key}.webp`))
  await writeFile(resolve(output, `${key}.json`), JSON.stringify({ frames,
    meta: { image: `${key}.webp`, size: { w: atlasWidth, h: atlasHeight } } }))
  pages.push({ key, firstFrame: offset, frameCount })
}
const manifest = { frameCount: count, frameRate,
  x: 836 + (worldRegion.x + left / width * worldRegion.width - 836) / 2,
  y: 460 + (worldRegion.y + top / height * worldRegion.height - 470) / 2,
  width: crop.width / width * worldRegion.width / 2, height: crop.height / height * worldRegion.height / 2,
  depth: 469.6, pages,
  sourceCrop: { ...crop, videoWidth: width, videoHeight: height },
}
await writeFile(resolve(root, 'src/generated/central-book.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify(manifest, null, 2))
