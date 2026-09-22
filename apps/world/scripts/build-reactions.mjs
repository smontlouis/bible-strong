import sharp from 'sharp'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

// Only optimized layers ship; preserve approved Image Gen originals outside public.
const source = resolve(process.argv[2] || '../../output/imagegen/slime-reactions-bold')
const output = resolve('public/assets/reactions/slime')
const selected = {
  hello: 'hello-v3',
  love: 'love',
  laugh: 'laugh',
  wow: 'wow',
  think: 'think',
  sad: 'sad',
  bravo: 'bravo-v3',
}
await mkdir(output, { recursive: true })
const manifest = { size: 128, source: 'Image Gen; slime reactions with bold outlines', images: {} }
let total = 0
for (const [id, file] of Object.entries(selected)) {
  const original = await readFile(resolve(source, `${file}.png`))
  const { data, info } = await sharp(original)
    .trim({ threshold: 10 })
    .resize(116, 116, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const body = Buffer.alloc(data.length)
  const detail = Buffer.from(data)
  // Neutral pixels form the tintable body; colored details stay in an untinted layer.
  // Complementary alpha preserves antialiased boundaries without doubling opacity.
  for (let i = 0; i < data.length; i += 4) {
    const chroma =
      Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])
    const colorWeight = Math.max(0, Math.min(1, (chroma - 8) / 24))
    const alpha = data[i + 3] / 255
    const detailAlpha = alpha * colorWeight
    const bodyAlpha = detailAlpha === 1 ? 0 : (alpha - detailAlpha) / (1 - detailAlpha)
    const grey = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3)
    body[i] = body[i + 1] = body[i + 2] = grey
    body[i + 3] = Math.round(bodyAlpha * 255)
    detail[i + 3] = Math.round(detailAlpha * 255)
  }
  const left = Math.floor((128 - info.width) / 2),
    top = Math.floor((128 - info.height) / 2)
  for (const [layer, pixels] of [
    ['body', body],
    ['detail', detail],
  ]) {
    const path = resolve(output, `${id}-${layer}.webp`)
    await sharp(pixels, { raw: info })
      .extend({
        left,
        right: 128 - info.width - left,
        top,
        bottom: 128 - info.height - top,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ lossless: true, effort: 6 })
      .toFile(path)
    total += (await stat(path)).size
  }
  manifest.images[id] = {
    original: `${file}.png`,
    sha256: createHash('sha256').update(original).digest('hex'),
  }
}
await writeFile(resolve(output, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`7 reactions, 14 transparent 128px WebP layers: ${total} bytes total`)
