import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const WORLD_WIDTH = 1671
const WORLD_HEIGHT = 941
const TILE_SIZE = 512
const OVERLAP = 2
const SCALES = [2, 4]
const WEBP_QUALITY = 88
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '..')
const input = process.argv[2] ? resolve(process.argv[2]) : null

if (!input) {
  console.error('Usage: yarn workspace @bible-strong/world tiles /absolute/path/to/map.png')
  process.exit(1)
}

await stat(input)

const mapRoot = resolve(root, 'public/assets/map')
const finalTiles = resolve(mapRoot, 'tiles')
const temporaryTiles = resolve(mapRoot, `tiles-next-${process.pid}`)
const generatedDirectory = resolve(root, 'src/generated')
await mkdir(temporaryTiles, { recursive: true })
await mkdir(generatedDirectory, { recursive: true })

// Reviewed ground repair and original table/book at half size, anchored at (836, 460).
// Apply to the normalized original so future tile rebuilds retain the art change.
const source = await sharp(input, { limitInputPixels: false })
  .resize(WORLD_WIDTH * 4, WORLD_HEIGHT * 4, { fit: 'fill' })
  .composite([
    { input: resolve(mapRoot, 'edits/central-table-half.webp'), left: 736 * 4, top: 388 * 4 },
    { input: resolve(mapRoot, 'edits/community-board.webp'), left: 880 * 4, top: 325 * 4 },
  ])
  .png()
  .toBuffer()

async function inBatches(tasks, size = 8) {
  for (let index = 0; index < tasks.length; index += size) {
    await Promise.all(tasks.slice(index, index + size).map(task => task()))
  }
}

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
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const tasks = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      tasks.push(async () => {
        const coreLeft = column * TILE_SIZE
        const coreTop = row * TILE_SIZE
        const left = Math.max(0, coreLeft - OVERLAP)
        const top = Math.max(0, coreTop - OVERLAP)
        const right = Math.min(width, coreLeft + TILE_SIZE + OVERLAP)
        const bottom = Math.min(height, coreTop + TILE_SIZE + OVERLAP)
        const output = resolve(levelDirectory, `${column}-${row}.webp`)
        await sharp(data, {
          raw: { width: info.width, height: info.height, channels: info.channels },
        })
          .extract({ left, top, width: right - left, height: bottom - top })
          .webp({ quality: WEBP_QUALITY, smartSubsample: true })
          .toFile(output)
        totalBytes += (await stat(output)).size
      })
    }
  }
  await inBatches(tasks)
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
  resolve(generatedDirectory, 'map-tiles.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8'
)

const tileCount = levels.reduce((sum, level) => sum + level.columns * level.rows, 0)
const directories = await readdir(finalTiles)
console.log(
  `Generated ${tileCount} WebP tiles (${(totalBytes / 1024 / 1024).toFixed(1)} MiB) across ${directories.length} levels plus preview.webp.`
)
