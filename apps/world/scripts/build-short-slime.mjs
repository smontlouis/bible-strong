import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const source = process.argv[2]
if (!source) throw new Error('Pass the directory containing short-slime-{face,droite,haut}-24.png')
const shape = process.argv[3] ?? 'short-slime'
if (!['short-slime', 'rounded-square'].includes(shape)) throw new Error('Unsupported shape')
const idleIndex = shape === 'rounded-square' ? 3 : 1
const out = resolve(import.meta.dirname, `../public/assets/avatars/${shape}`)
await mkdir(out, { recursive: true })
for (const [direction, file] of Object.entries({ down: 'face', right: 'droite', up: 'haut' })) {
  const { data, info } = await sharp(resolve(source, `${shape}-${file}-24.png`))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.width !== 1536 || info.height !== 1024)
    throw new Error('Expected a 6 × 4 sheet of 256px cells')
  const frames = []
  for (let i = 0; i < 24; i++) {
    const rgba = Buffer.alloc(256 * 256 * 4)
    let left = 256,
      right = 0,
      bottom = 0
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const p = ((Math.floor(i / 6) * 256 + y) * info.width + (i % 6) * 256 + x) * 3
        const [r, g, b] = data.subarray(p, p + 3)
        const excess = g - Math.max(r, b)
        const alpha = excess > 25 ? (Math.max(r, b) < 100 ? Math.max(0, 1 - g / 215) : 0) : 1
        const a = alpha < 0.08 ? 0 : Math.round(alpha * 255)
        const gray = a && excess > 25 ? 0 : Math.round((r + b) / 2)
        const q = (y * 256 + x) * 4
        rgba[q] = rgba[q + 1] = rgba[q + 2] = gray
        rgba[q + 3] = a
        if (a > 128) {
          left = Math.min(left, x)
          right = Math.max(right, x)
          bottom = Math.max(bottom, y)
        }
      }
    if (left >= right) throw new Error(`Empty frame ${direction} ${i}`)
    frames.push({ rgba, left, right, bottom })
  }
  const layers = []
  for (let i = 0; i < 24; i++) {
    const row = Math.floor(i / 6)
    const baseline = Math.max(...frames.slice(row * 6, row * 6 + 6).map(f => f.bottom))
    const f = frames[i]
    const dx = Math.round(128 - (f.left + f.right) / 2),
      dy = 228 - baseline
    const aligned = Buffer.alloc(256 * 256 * 4)
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const tx = x + dx,
          ty = y + dy
        if (tx >= 0 && tx < 256 && ty >= 0 && ty < 256)
          f.rgba.copy(aligned, (ty * 256 + tx) * 4, (y * 256 + x) * 4, (y * 256 + x) * 4 + 4)
      }
    const png = await sharp(aligned, { raw: { width: 256, height: 256, channels: 4 } })
      .png()
      .toBuffer()
    layers.push({ input: png, left: (i % 6) * 256, top: Math.floor(i / 6) * 256 })
    if (i === idleIndex) {
      const idle = await sharp(png).trim().toBuffer()
      const meta = await sharp(idle).metadata()
      const idleFrame = await sharp({
        create: { width: 256, height: 256, channels: 4, background: '#00000000' },
      })
        .composite([
          { input: idle, left: Math.round((256 - meta.width) / 2), top: 229 - meta.height },
        ])
        .png()
        .toBuffer()
      await writeFile(resolve(out, `idle-${direction}.png`), idleFrame)
      if (direction === 'down') await writeFile(resolve(out, 'thumbnail.png'), idleFrame)
    }
  }
  await sharp({ create: { width: 1536, height: 1024, channels: 4, background: '#00000000' } })
    .composite(layers)
    .png()
    .toFile(resolve(out, `${direction}.png`))
}
await writeFile(
  resolve(out, 'provenance.json'),
  JSON.stringify(
    {
      source: `Approved imagegen ${shape} sheets`,
      idleFrame: idleIndex,
      frames: 24,
      columns: 6,
      rows: 4,
      frameSize: 256,
      frameRate: 24,
      originY: 229 / 256,
      left: 'Mirror right',
      processing: 'Remove green, neutralize RGB for tint, center and align row baselines',
    },
    null,
    2
  ) + '\n'
)
console.log(out)
