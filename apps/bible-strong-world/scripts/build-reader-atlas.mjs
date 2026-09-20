import { execFileSync } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const input = process.argv[2] && resolve(process.argv[2])
const mask = process.argv[3] && resolve(process.argv[3])
if (!input || !mask)
  throw Error('Usage: node scripts/build-reader-atlas.mjs <12fps-video> <mask-video>')
const config = process.argv[4]
  ? JSON.parse(await readFile(resolve(process.argv[4]), 'utf8'))
  : {
      id: 'lexicon-reader',
      experiment: 'lexicon-reader-v3',
      frames: 96,
      x: 780,
      y: 85,
      width: 230,
      height: 200,
      depth: 254.1,
    }
const work = resolve(root, 'art-workbench/experiments', config.experiment, 'sprite')
const output = resolve(root, 'public/assets/characters', config.id)
for (const dir of ['frames', 'masks']) await mkdir(resolve(work, dir), { recursive: true })
await mkdir(output, { recursive: true })
for (const [video, dir] of [
  [input, 'frames'],
  [mask, 'masks'],
]) {
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-i',
    video,
    '-vf',
    'fps=12',
    '-y',
    resolve(work, dir, '%03d.png'),
  ])
}
const files = (await readdir(resolve(work, 'frames'))).filter(f => f.endsWith('.png')).sort()
const maskFiles = (await readdir(resolve(work, 'masks'))).filter(f => f.endsWith('.png')).sort()
if (files.length !== config.frames || maskFiles.length !== files.length)
  throw Error(`Expected ${config.frames} aligned frames`)
const metadata = await sharp(resolve(work, 'frames', files[0])).metadata()
const width = metadata.width,
  height = metadata.height
let left = width,
  top = height,
  right = 0,
  bottom = 0
const masks = []
for (const file of maskFiles) {
  const pixels = await sharp(resolve(work, 'masks', file))
    .greyscale()
    .raw()
    .toBuffer()
  if (pixels.length !== width * height) throw Error('Mask dimensions do not match the video')
  let count = 0
  for (let i = 0; i < pixels.length; i++) {
    const normalizedX = (i % width) / width
    const inClip =
      !config.clipX || (normalizedX >= config.clipX[0] && normalizedX < config.clipX[1])
    pixels[i] = inClip && pixels[i] > 127 ? 255 : 0
    if (!pixels[i]) continue
    const x = i % width,
      y = Math.floor(i / width)
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x)
    bottom = Math.max(bottom, y)
    count++
  }
  if (count < 1000 || count > width * height * 0.3)
    throw Error('Unexpected mask area; review segmentation')
  masks.push(pixels)
}
left = Math.max(0, left - 2)
top = Math.max(0, top - 2)
right = Math.min(width - 1, right + 2)
bottom = Math.min(height - 1, bottom + 2)
const sourceFW = right - left + 1,
  sourceFH = bottom - top + 1
const scale = config.pixelRatio ? Math.min(1, (config.width / width) * config.pixelRatio) : 1
const fw = Math.max(1, Math.round(sourceFW * scale)),
  fh = Math.max(1, Math.round(sourceFH * scale))
const cw = fw + 4,
  ch = fh + 4
const columns = Math.floor(2048 / cw),
  rows = Math.floor(2048 / ch)
const capacity = columns * rows
const pages = []
for (let offset = 0; offset < files.length; offset += capacity) {
  const count = Math.min(capacity, files.length - offset)
  const atlasWidth = columns * cw,
    atlasHeight = Math.ceil(count / columns) * ch
  const composites = [],
    frames = {}
  const page = pages.length
  for (let index = 0; index < count; index++) {
    const frameIndex = offset + index
    const alpha = await sharp(masks[frameIndex], { raw: { width, height, channels: 1 } })
      .blur(0.5)
      .greyscale()
      .raw()
      .toBuffer()
    const rgb = await sharp(resolve(work, 'frames', files[frameIndex]))
      .removeAlpha()
      .raw()
      .toBuffer()
    const rgba = await sharp(rgb, { raw: { width, height, channels: 3 } })
      .joinChannel(alpha, { raw: { width, height, channels: 1 } })
      .png()
      .toBuffer()
    const sprite = await sharp(rgba)
      .extract({ left, top, width: sourceFW, height: sourceFH })
      .resize(fw, fh)
      .png()
      .toBuffer()
    const x = (index % columns) * cw + 2,
      y = Math.floor(index / columns) * ch + 2
    composites.push({ input: sprite, left: x, top: y })
    frames[`reader-${String(frameIndex).padStart(3, '0')}`] = {
      frame: { x, y, w: fw, h: fh },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: fw, h: fh },
      sourceSize: { w: fw, h: fh },
    }
    if ([0, 24, 48, 72].includes(frameIndex))
      await writeFile(resolve(work, `cutout-${frameIndex}.png`), sprite)
  }
  const name = `reader-${page}`
  await sharp({
    create: { width: atlasWidth, height: atlasHeight, channels: 4, background: '#00000000' },
  })
    .composite(composites)
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(resolve(output, `${name}.webp`))
  await writeFile(
    resolve(output, `${name}.json`),
    JSON.stringify({
      frames,
      meta: { image: `${name}.webp`, size: { w: atlasWidth, h: atlasHeight }, scale: '1' },
    })
  )
  pages.push({
    key: name,
    firstFrame: offset,
    frameCount: count,
    width: atlasWidth,
    height: atlasHeight,
  })
}
const manifest = {
  frameRate: 12,
  frameCount: files.length,
  duration: files.length / 12,
  x: config.x + (left / width) * config.width,
  y: config.y + (top / height) * config.height,
  width: (sourceFW / width) * config.width,
  height: (sourceFH / height) * config.height,
  depth: config.depth,
  synchronize: config.synchronize ?? false,
  pages,
  sourceCrop: {
    left,
    top,
    width: sourceFW,
    height: sourceFH,
    videoWidth: width,
    videoHeight: height,
  },
}
await writeFile(
  resolve(root, `src/generated/${config.id}.json`),
  JSON.stringify(manifest, null, 2) + '\n'
)
console.log(JSON.stringify(manifest, null, 2))

// Remove only obsolete pages from a previous build of this generated atlas.
const expectedPages = new Set(pages.flatMap(page => [`${page.key}.webp`, `${page.key}.json`]))
for (const file of await readdir(output)) {
  if (/^reader-\d+\.(webp|json)$/.test(file) && !expectedPages.has(file))
    await unlink(resolve(output, file))
}
