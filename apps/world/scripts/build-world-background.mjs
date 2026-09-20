import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [shoreSource, waterSource] = process.argv.slice(2)
if (!shoreSource || !waterSource) {
  throw new Error('Usage: node scripts/build-world-background.mjs <aligned-outpaint> <water-tile>')
}
const margin = 200
const worldWidth = 1671
const worldHeight = 941
const width = worldWidth + margin * 2
const height = worldHeight + margin * 2
const output = resolve(root, 'public/assets/map')
await mkdir(output, { recursive: true })
const source = await sharp(resolve(output, 'preview.webp')).removeAlpha().raw().toBuffer()
const generated = await sharp(shoreSource)
  .resize(width, height, { fit: 'fill' })
  .removeAlpha()
  .raw()
  .toBuffer()
const size = 512
const water = await sharp(waterSource).resize(size, size).removeAlpha().raw().toBuffer()
const clamp = value => Math.max(0, Math.min(1, value))
const smooth = value => {
  const t = clamp(value)
  return t * t * (3 - 2 * t)
}
// Cyan water, including pale wave strokes; excludes blue roofs, foliage and gray rock.
const waterWeight = (r, g, b) =>
  smooth((g - 140) / 25) * smooth((g - r - 35) / 25) * smooth((b - g + 5) / 20)

// Match the repeat's average color to the existing water along the map perimeter.
const average = [0, 0, 0]
let count = 0
for (let y = 0; y < worldHeight; y++) {
  for (let x = 0; x < worldWidth; x++) {
    if (Math.min(x, y, worldWidth - 1 - x, worldHeight - 1 - y) > 35) continue
    const i = (y * worldWidth + x) * 3
    if (waterWeight(...source.subarray(i, i + 3)) < 0.99) continue
    for (let c = 0; c < 3; c++) average[c] += source[i + c]
    count++
  }
}
const tileAverage = [0, 0, 0]
for (let i = 0; i < water.length; i++) tileAverage[i % 3] += water[i] / (size * size)
for (let i = 0; i < water.length; i++) {
  water[i] = Math.round(
    Math.max(0, Math.min(255, water[i] + average[i % 3] / count - tileAverage[i % 3]))
  )
}
// Reconcile opposite edges so the generated texture is exactly periodic.
for (const horizontal of [true, false]) {
  for (let row = 0; row < size; row++) {
    for (let inset = 0; inset < 24; inset++) {
      const a = (horizontal ? row * size + inset : inset * size + row) * 3
      const b = (horizontal ? row * size + size - 1 - inset : (size - 1 - inset) * size + row) * 3
      const weight = (1 - inset / 24) * 0.5
      for (let c = 0; c < 3; c++) {
        const first = water[a + c]
        const last = water[b + c]
        water[a + c] = Math.round(first + (last - first) * weight)
        water[b + c] = Math.round(last + (first - last) * weight)
      }
    }
  }
}
await sharp(water, { raw: { width: size, height: size, channels: 3 } })
  .webp({ lossless: true })
  .toFile(resolve(output, 'water.webp'))

// Reviewed completion windows in original world coordinates. Ignore invented scenery
// elsewhere in the generated image. Only these clipped silhouettes are retained.
const completions = [
  [700, -80, 1000, 0], // blue roof
  [1100, -90, 1260, 0], // northern rock and reeds
  [1360, -85, 1580, 0], // coral tree
  [-45, 370, 0, 445], // western rock
  [1671, 410, 1735, 570], // eastern tree
  [590, 941, 1160, 1005], // southern island coastline
  [1390, 941, 1520, 1030], // southeastern rock
]
// Keep only generated silhouettes connected to a clipped edge. This rejects
// isolated rocks the generator added within otherwise useful completion windows.
const connected = new Uint8Array(width * height)
const candidates = new Uint8Array(width * height)
const queue = []
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const wx = x - margin,
      wy = y - margin
    if (wx >= 0 && wx < worldWidth && wy >= 0 && wy < worldHeight) continue
    if (!completions.some(([l, t, r, b]) => wx >= l && wx <= r && wy >= t && wy <= b)) continue
    const p = y * width + x
    if (waterWeight(...generated.subarray(p * 3, p * 3 + 3)) > 0.95) continue
    candidates[p] = 1
    if (wx === -1 || wx === worldWidth || wy === -1 || wy === worldHeight) {
      connected[p] = 1
      queue.push(p)
    }
  }
}
for (let head = 0; head < queue.length; head++) {
  const p = queue[head]
  for (const offset of [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1]) {
    const next = p + offset
    if (candidates[next] && !connected[next]) {
      connected[next] = 1
      queue.push(next)
    }
  }
}
const silhouette = await sharp(Buffer.from(connected.map(value => value * 255)), {
  raw: { width, height, channels: 1 },
})
  .blur(0.5)
  .greyscale()
  .raw()
  .toBuffer()
const shore = Buffer.alloc(width * height * 4)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const wx = x - margin
    const wy = y - margin
    const inside = wx >= 0 && wx < worldWidth && wy >= 0 && wy < worldHeight
    const i = (y * width + x) * 4
    const tileX = ((wx % size) + size) % size
    const tileY = ((wy % size) + size) % size
    const wi = (tileY * size + tileX) * 3
    if (inside) {
      // Blend only water in a narrow inner rim above the unmodified terrain tiles.
      const si = (wy * worldWidth + wx) * 3
      const distance = Math.min(wx, wy, worldWidth - 1 - wx, worldHeight - 1 - wy)
      const alpha = (1 - smooth(distance / 48)) * waterWeight(...source.subarray(si, si + 3))
      for (let c = 0; c < 3; c++) shore[i + c] = water[wi + c]
      shore[i + 3] = Math.round(alpha * 255)
    } else {
      const gi = (y * width + x) * 3
      const patch = completions.find(
        ([left, top, right, bottom]) => wx >= left && wx <= right && wy >= top && wy <= bottom
      )
      if (!patch) continue
      const [left, top, right, bottom] = patch
      // Fade the three outer sides of each patch, never its join to the source.
      const distances = [
        left === worldWidth ? Infinity : wx - left,
        right === 0 ? Infinity : right - wx,
        top === worldHeight ? Infinity : wy - top,
        bottom === 0 ? Infinity : bottom - wy,
      ]
      const alpha = (smooth(Math.min(...distances) / 12) * silhouette[y * width + x]) / 255
      const waterMix = waterWeight(...generated.subarray(gi, gi + 3))
      for (let c = 0; c < 3; c++) {
        shore[i + c] = Math.round(generated[gi + c] * (1 - waterMix) + water[wi + c] * waterMix)
      }
      shore[i + 3] = Math.round(alpha * 255)
    }
  }
}
await sharp(shore, { raw: { width, height, channels: 4 } })
  .webp({ quality: 95, alphaQuality: 100 })
  .toFile(resolve(output, 'shore.webp'))
console.log('Built shore.webp and seamless water.webp; original map tiles unchanged.')
