import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const source = resolve(process.argv[2])
const manifest = JSON.parse(await readFile(resolve(source, 'avatar-export.json'), 'utf8'))
const shape = process.argv[3] ?? 'rounded-square'
if (!['blob', 'rounded-square', 'short-slime', 'cloud', 'triangle'].includes(shape)) throw new Error('Unsupported avatar shape')
const frameCount = shape === 'blob' ? 24 : 15
const columns = shape === 'blob' ? 8 : 5
const out = resolve(import.meta.dirname, '../public/assets/avatars', shape)
await mkdir(out, { recursive: true })
for (const [direction, files] of Object.entries(manifest.directions)) {
  if (files.length !== frameCount) throw new Error(`Expected ${frameCount} frames`)
  const layers = []
  for (const [index, file] of files.entries()) {
    const image = sharp(resolve(source, file))
    const meta = await image.metadata()
    if (meta.width !== 256 || meta.height !== 256 || !meta.hasAlpha)
      throw new Error('Expected transparent 256 × 256 frame: ' + file)
    const input = await image.png().toBuffer()
    layers.push({ input, left: (index % columns) * 256, top: Math.floor(index / columns) * 256 })
    if (index === 0) {
      const idle = manifest.idles?.[direction]
        ? await sharp(resolve(source, manifest.idles[direction])).png().toBuffer()
        : input
      const idleMeta = await sharp(idle).metadata()
      if (idleMeta.width !== 256 || idleMeta.height !== 256 || !idleMeta.hasAlpha)
        throw new Error('Expected transparent 256 × 256 idle: ' + direction)
      await writeFile(resolve(out, 'idle-' + direction + '.png'), idle)
      if (direction === 'down')
        await sharp(idle).trim().png().toFile(resolve(out, 'thumbnail.png'))
    }
  }
  await sharp({ create: { width: columns * 256, height: 768, channels: 4, background: '#00000000' } })
    .composite(layers).png().toFile(resolve(out, direction + '.png'))
}
await writeFile(resolve(out, 'provenance.json'), JSON.stringify({
  source: manifest.source ?? `${shape} poses reviewed in Pen; back is the front with the eye layers removed`,
  frames: frameCount, columns, rows: 3, frameSize: 256, frameRate: shape === 'cloud' ? 12 : 24,
  idleFrame: manifest.idles ? null : 0,
  originY: shape === 'blob' ? { down: 550 / 576, up: 550 / 576, right: 218 / 224 } : 233 / 256,
  left: 'Mirror right',
}, null, 2) + '\n')
