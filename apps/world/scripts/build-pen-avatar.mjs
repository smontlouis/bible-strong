import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const source = resolve(process.argv[2])
const manifest = JSON.parse(await readFile(resolve(source, 'avatar-export.json'), 'utf8'))
const shape = process.argv[3] ?? 'rounded-square'
if (!['rounded-square', 'short-slime'].includes(shape)) throw new Error('Unsupported avatar shape')
const out = resolve(import.meta.dirname, '../public/assets/avatars', shape)
for (const [direction, files] of Object.entries(manifest.directions)) {
  if (files.length !== 15) throw new Error('Expected 15 frames')
  const layers = []
  for (const [index, file] of files.entries()) {
    const image = sharp(resolve(source, file))
    const meta = await image.metadata()
    if (meta.width !== 256 || meta.height !== 256 || !meta.hasAlpha)
      throw new Error('Expected transparent 256 × 256 frame: ' + file)
    const input = await image.png().toBuffer()
    layers.push({ input, left: (index % 5) * 256, top: Math.floor(index / 5) * 256 })
    if (index === 0) {
      await writeFile(resolve(out, 'idle-' + direction + '.png'), input)
      if (direction === 'down')
        await sharp(input).trim().png().toFile(resolve(out, 'thumbnail.png'))
    }
  }
  await sharp({ create: { width: 1280, height: 768, channels: 4, background: '#00000000' } })
    .composite(layers).png().toFile(resolve(out, direction + '.png'))
}
await writeFile(resolve(out, 'provenance.json'), JSON.stringify({
  source: `${shape} poses reviewed in Pen; back is the front with the eye layers removed`,
  frames: 15, columns: 5, rows: 3, frameSize: 256, frameRate: 24,
  idleFrame: 0, originY: 233 / 256, left: 'Mirror right',
}, null, 2) + '\n')
