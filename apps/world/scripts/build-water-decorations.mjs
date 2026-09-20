import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = process.argv[2]
if (!source)
  throw new Error('Usage: node scripts/build-water-decorations.mjs <transparent-2x2-atlas>')
const metadata = await sharp(source).metadata()
if (!metadata.hasAlpha || !metadata.width || !metadata.height) {
  throw new Error('The reviewed atlas must have a transparent background.')
}
const width = Math.floor(metadata.width / 2)
const height = Math.floor(metadata.height / 2)
const variants = ['rock', 'stones', 'rock-reeds', 'reeds']
for (const [index, variant] of variants.entries()) {
  const cell = await sharp(source)
    .extract({ left: (index % 2) * width, top: Math.floor(index / 2) * height, width, height })
    .png()
    .toBuffer()
  await sharp(cell)
    .trim()
    .resize(224, 224, { fit: 'contain', background: '#00000000' })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: '#00000000' })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(resolve(root, `public/assets/map/water-${variant}.webp`))
}
console.log('Built four 256 × 256 transparent water decoration sprites.')
