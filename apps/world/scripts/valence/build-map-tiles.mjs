// Valence 1876: progressive map assets from the 4× source, same layout as the archipelago tiles.
// Usage: node scripts/valence/build-map-tiles.mjs /absolute/path/to/hd.png
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

export const WORLD_WIDTH = 1672
export const WORLD_HEIGHT = 941
const TILE_SIZE = 512
const OVERLAP = 2
const SCALES = [2, 4]
const WEBP_QUALITY = 86
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const input = process.argv[2] ? resolve(process.argv[2]) : null
if (!input) {
  console.error('Usage: node scripts/valence/build-map-tiles.mjs /absolute/path/to/hd.png')
  process.exit(1)
}
await stat(input)

const mapRoot = resolve(root, 'public/valence-1876/map')
const finalTiles = resolve(mapRoot, 'tiles')
const temporaryTiles = resolve(mapRoot, `tiles-next-${process.pid}`)
await mkdir(temporaryTiles, { recursive: true })

const source = await sharp(input, { limitInputPixels: false })
  .resize(WORLD_WIDTH * 4, WORLD_HEIGHT * 4, { fit: 'fill' })
  .removeAlpha()
  .png()
  .toBuffer()

const levels = []
let totalBytes = 0
for (const scale of SCALES) {
  const width = WORLD_WIDTH * scale
  const height = WORLD_HEIGHT * scale
  const columns = Math.ceil(width / TILE_SIZE)
  const rows = Math.ceil(height / TILE_SIZE)
  const levelDirectory = resolve(temporaryTiles, String(scale))
  await mkdir(levelDirectory, { recursive: true })
  const { data, info } = await sharp(source, { limitInputPixels: false })
    .resize(width, height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const tasks = []
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++)
      tasks.push(async () => {
        const left = Math.max(0, column * TILE_SIZE - OVERLAP)
        const top = Math.max(0, row * TILE_SIZE - OVERLAP)
        const right = Math.min(width, (column + 1) * TILE_SIZE + OVERLAP)
        const bottom = Math.min(height, (row + 1) * TILE_SIZE + OVERLAP)
        const output = resolve(levelDirectory, `${column}-${row}.webp`)
        await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
          .extract({ left, top, width: right - left, height: bottom - top })
          .webp({ quality: WEBP_QUALITY, smartSubsample: true })
          .toFile(output)
        totalBytes += (await stat(output)).size
      })
  for (let i = 0; i < tasks.length; i += 8) await Promise.all(tasks.slice(i, i + 8).map(t => t()))
  levels.push({ scale, width, height, columns, rows })
}

await sharp(source, { limitInputPixels: false })
  .resize(WORLD_WIDTH, WORLD_HEIGHT, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
  .webp({ quality: 84, smartSubsample: true })
  .toFile(resolve(mapRoot, 'preview.webp'))
await rm(finalTiles, { recursive: true, force: true })
await rename(temporaryTiles, finalTiles)

const manifest = {
  version: 1,
  source: basename(input),
  worldWidth: WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,
  tileSize: TILE_SIZE,
  overlap: OVERLAP,
  format: 'webp',
  levels,
}
await writeFile(
  resolve(root, 'src/valence/generated/map-tiles.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
)
console.log(
  `Valence 1876: ${levels.reduce((n, l) => n + l.columns * l.rows, 0)} tiles, ${(totalBytes / 1048576).toFixed(1)} MiB`
)
