import sharp from 'sharp'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const root = resolve(import.meta.dirname, '..')
const work = resolve(root, 'art-workbench/experiments/living-world-v1')
const layouts = JSON.parse(await readFile(resolve(import.meta.dirname, 'living-world-layout.json')))
const map = JSON.parse(await readFile(resolve(root, 'src/generated/map-tiles.json')))
const manifests = []
const count = 120
const frameRate = 12
const density = 2

for (const layout of layouts) {
  const dir = resolve(work, layout.id)
  const output = resolve(root, 'public/assets/ambience', layout.id)
  if (
    existsSync(resolve(dir, 'build.json')) &&
    existsSync(resolve(output, 'atlas.webp')) &&
    !process.argv.includes('--rebuild')
  ) {
    manifests.push(JSON.parse(await readFile(resolve(dir, 'build.json'))).manifest)
    console.log(layout.id, 'already built')
    continue
  }
  if (!existsSync(resolve(dir, 'mask.mp4'))) {
    console.log(layout.id, 'waiting for mask')
    continue
  }
  for (const [video, folder] of [
    ['input-12fps.mp4', 'frames'],
    ['mask.mp4', 'masks'],
  ]) {
    await mkdir(resolve(dir, folder), { recursive: true })
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      resolve(dir, video),
      '-vf',
      'fps=12',
      '-frames:v',
      String(count),
      resolve(dir, folder, '%03d.png'),
    ])
    const files = (await readdir(resolve(dir, folder))).filter(name => /^\d{3}\.png$/.test(name))
    if (files.length !== count) throw new Error(`${layout.id}: expected ${count} ${folder}`)
  }
  const meta = await sharp(resolve(dir, 'frames/001.png')).metadata()
  const vw = meta.width,
    vh = meta.height
  const masks = []
  let left = vw,
    top = vh,
    right = 0,
    bottom = 0
  const areas = []
  for (let f = 1; f <= count; f++) {
    const { data: mask, info } = await sharp(
      resolve(dir, `masks/${String(f).padStart(3, '0')}.png`)
    )
      .removeAlpha()
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true })
    if (info.width !== vw || info.height !== vh)
      throw new Error(`${layout.id}: mask dimensions differ`)
    let area = 0,
      escaped = 0
    for (let i = 0; i < mask.length; i++) {
      mask[i] = mask[i] > 127 ? 255 : 0
      if (!mask[i]) continue
      const x = i % vw,
        y = Math.floor(i / vw)
      const [x0, y0, x1, y1] = layout.region
      if (x < x0 * vw || x > x1 * vw || y < y0 * vh || y > y1 * vh) {
        escaped++
        mask[i] = 0
        continue
      }
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
      area++
    }
    if (escaped > 12)
      throw new Error(
        `${layout.id}: frame ${f} has ${escaped} mask pixels outside the reviewed region`
      )
    if (area < 35 || area > vw * vh * 0.2)
      throw new Error(`${layout.id}: frame ${f} has unexpected mask area ${area}`)
    areas.push(area)
    masks.push(mask)
  }
  if (Math.max(...areas) / Math.min(...areas) > 4)
    throw new Error(`${layout.id}: unstable segmentation area`)
  left = Math.max(0, left - 8)
  top = Math.max(0, top - 8)
  right = Math.min(vw - 1, right + 8)
  bottom = Math.min(vh - 1, bottom + 8)
  const sw = right - left + 1,
    sh = bottom - top + 1
  const [scaleText, coordinate] = layout.sourceTile.split('/')
  const scale = Number(scaleText),
    [column, row] = coordinate.split('-').map(Number)
  const level = map.levels.find(level => level.scale === scale)
  const tileLeft = Math.max(0, column * map.tileSize - map.overlap)
  const tileTop = Math.max(0, row * map.tileSize - map.overlap)
  const tileRight = Math.min(level.width, (column + 1) * map.tileSize + map.overlap)
  const tileBottom = Math.min(level.height, (row + 1) * map.tileSize + map.overlap)
  const tileWidth = (tileRight - tileLeft) / scale,
    tileHeight = (tileBottom - tileTop) / scale
  const fw = Math.round((sw / vw) * tileWidth * density),
    fh = Math.round((sh / vh) * tileHeight * density)
  const sprites = []
  for (let f = 0; f < count; f++) {
    const alpha = await sharp(masks[f], { raw: { width: vw, height: vh, channels: 1 } })
      .blur(0.5)
      .greyscale()
      .raw()
      .toBuffer()
    const rgb = await sharp(resolve(dir, `frames/${String(f + 1).padStart(3, '0')}.png`))
      .removeAlpha()
      .raw()
      .toBuffer()
    const rgba = Buffer.alloc(vw * vh * 4)
    for (let i = 0; i < vw * vh; i++) {
      rgba[i * 4] = rgb[i * 3]
      rgba[i * 4 + 1] = rgb[i * 3 + 1]
      rgba[i * 4 + 2] = rgb[i * 3 + 2]
      rgba[i * 4 + 3] = alpha[i]
    }
    const frame = await sharp(rgba, { raw: { width: vw, height: vh, channels: 4 } })
      .extract({ left, top, width: sw, height: sh })
      .resize(fw, fh)
      .raw()
      .toBuffer()
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++)
        if (x < 2 || y < 2 || x >= fw - 2 || y >= fh - 2) frame[(y * fw + x) * 4 + 3] = 0
    sprites.push(frame)
  }
  // Same image anchors the generated video; a brief closing blend removes residual drift.
  for (let f = count - 6; f < count; f++) {
    const t = (f - (count - 7)) / 6
    for (let i = 0; i < sprites[f].length; i++)
      sprites[f][i] = Math.round(sprites[f][i] * (1 - t) + sprites[0][i] * t)
  }
  const cellW = fw + 4,
    cellH = fh + 4
  const columns = Math.min(Math.floor(2048 / cellW), Math.ceil(Math.sqrt((count * cellH) / cellW)))
  const width = columns * cellW,
    height = Math.ceil(count / columns) * cellH
  if (height > 2048) throw new Error(`${layout.id}: texture budget exceeded`)
  const frames = {},
    composites = [],
    review = []
  const original = await sharp(resolve(root, `public/assets/map/tiles/${layout.sourceTile}.webp`))
    .resize(516, 516)
    .png()
    .toBuffer()
  for (let f = 0; f < count; f++) {
    const input = await sharp(sprites[f], { raw: { width: fw, height: fh, channels: 4 } })
      .png()
      .toBuffer()
    const x = (f % columns) * cellW + 2,
      y = Math.floor(f / columns) * cellH + 2
    composites.push({ input, left: x, top: y })
    frames[`ambient-${f}`] = {
      frame: { x, y, w: fw, h: fh },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: fw, h: fh },
      sourceSize: { w: fw, h: fh },
    }
    if ([0, 30, 60, 90, 119].includes(f)) {
      await writeFile(resolve(dir, `cutout-${f}.png`), input)
      const overlay = await sharp(input)
        .resize(Math.round((sw / vw) * 516), Math.round((sh / vh) * 516))
        .toBuffer()
      const preview = await sharp(original)
        .composite([
          {
            input: overlay,
            left: Math.round((left / vw) * 516),
            top: Math.round((top / vh) * 516),
          },
        ])
        .png()
        .toBuffer()
      await writeFile(resolve(dir, `preview-${f}.png`), preview)
      review.push({
        input: await sharp(preview).resize(258, 258).toBuffer(),
        left: review.length * 258,
        top: 0,
      })
    }
  }
  await mkdir(output, { recursive: true })
  await sharp({ create: { width, height, channels: 4, background: '#00000000' } })
    .composite(composites)
    .webp({ lossless: true })
    .toFile(resolve(output, 'atlas.webp'))
  await writeFile(
    resolve(output, 'atlas.json'),
    JSON.stringify({ frames, meta: { image: 'atlas.webp', size: { w: width, h: height } } })
  )
  await sharp({ create: { width: 1290, height: 258, channels: 3, background: '#142b35' } })
    .composite(review)
    .png()
    .toFile(resolve(dir, 'review.png'))
  const manifest = {
    id: layout.id,
    x: tileLeft / scale + (left / vw) * tileWidth,
    y: tileTop / scale + (top / vh) * tileHeight,
    width: (sw / vw) * tileWidth,
    height: (sh / vh) * tileHeight,
    frameCount: count,
    frameRate,
    sourceTile: layout.sourceTile,
    depth: layout.depth,
  }
  manifests.push(manifest)
  await writeFile(
    resolve(dir, 'build.json'),
    JSON.stringify(
      {
        manifest,
        atlas: { width, height },
        source: { vw, vh, left, top, sw, sh },
        maskArea: { min: Math.min(...areas), max: Math.max(...areas) },
      },
      null,
      2
    )
  )
  console.log(layout.id, `${fw}x${fh} frames; ${width}x${height} atlas`)
}
if (manifests.length === layouts.length)
  await writeFile(
    resolve(root, 'src/generated/living-world.json'),
    JSON.stringify(manifests, null, 2) + '\n'
  )
