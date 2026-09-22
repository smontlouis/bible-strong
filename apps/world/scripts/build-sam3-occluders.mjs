import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SCALE = 4
const OUTPUT_SCALE = 2
const scriptDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)))
const root = resolve(scriptDirectory, '..')
const reviewRoot = resolve(root, 'segmentation-qa/sam3-benchmark')
const productionRoot = resolve(root, 'segmentation-qa/sam3-production')
const spritesRoot = resolve(productionRoot, 'assets/occlusion')
const master = resolve(reviewRoot, 'normalized-master.png')
const rows = JSON.parse(await readFile(resolve(reviewRoot, 'results.json'), 'utf8'))
const currentManifest = JSON.parse(
  await readFile(resolve(root, 'src/generated/occlusion-manifest.json'), 'utf8')
)

await stat(master)
await mkdir(spritesRoot, { recursive: true })

function cleanComponents(pixels, width, height) {
  const visited = new Uint8Array(pixels.length)
  const components = []
  const queue = new Int32Array(pixels.length)
  const neighbors = [-1, 1, -width, width]
  for (let start = 0; start < pixels.length; start += 1) {
    if (visited[start] || pixels[start] < 128) continue
    let head = 0
    let tail = 1
    queue[0] = start
    visited[start] = 1
    const members = []
    while (head < tail) {
      const index = queue[head++]
      members.push(index)
      const x = index % width
      for (const delta of neighbors) {
        const next = index + delta
        if (next < 0 || next >= pixels.length || visited[next] || pixels[next] < 128) continue
        if ((delta === -1 && x === 0) || (delta === 1 && x === width - 1)) continue
        visited[next] = 1
        queue[tail++] = next
      }
    }
    components.push(members)
  }
  components.sort((left, right) => right.length - left.length)
  const minimum = Math.max(32, Math.round((components[0]?.length ?? 0) * 0.003))
  pixels.fill(0)
  for (const component of components) {
    if (component.length < minimum) continue
    for (const index of component) pixels[index] = 255
  }
}

function fillInternalHoles(pixels, width, height) {
  const exterior = new Uint8Array(pixels.length)
  const queue = new Int32Array(pixels.length)
  let head = 0
  let tail = 0
  const enqueue = index => {
    if (exterior[index] || pixels[index] >= 128) return
    exterior[index] = 1
    queue[tail++] = index
  }
  for (let x = 0; x < width; x += 1) {
    enqueue(x)
    enqueue((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width)
    enqueue(y * width + width - 1)
  }
  while (head < tail) {
    const index = queue[head++]
    const x = index % width
    if (x > 0) enqueue(index - 1)
    if (x < width - 1) enqueue(index + 1)
    if (index >= width) enqueue(index - width)
    if (index < pixels.length - width) enqueue(index + width)
  }
  for (let index = 0; index < pixels.length; index += 1) {
    if (pixels[index] < 128 && !exterior[index]) pixels[index] = 255
  }
}

function boundsOf(pixels, width, height) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let index = 0; index < pixels.length; index += 1) {
    if (pixels[index] < 128) continue
    const x = index % width
    const y = Math.floor(index / width)
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x)
    bottom = Math.max(bottom, y)
  }
  if (right < 0) return null
  return { left, top, right: right + 1, bottom: bottom + 1 }
}

function convexHull(points) {
  points.sort((left, right) => left[0] - right[0] || left[1] - right[1])
  const cross = (origin, left, right) =>
    (left[0] - origin[0]) * (right[1] - origin[1]) -
    (left[1] - origin[1]) * (right[0] - origin[0])
  const lower = []
  for (const point of points) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop()
    lower.push(point)
  }
  const upper = []
  for (const point of [...points].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop()
    upper.push(point)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

async function filledOuterContour(pixels, width, height) {
  const inset = Math.min(128, Math.floor(Math.min(width, height) / 4))
  const points = []
  for (let y = inset; y < height - inset; y += 1) {
    let first = -1
    let last = -1
    for (let x = inset; x < width - inset; x += 1) {
      if (pixels[y * width + x] < 128) continue
      if (first < 0) first = x
      last = x
    }
    if (first >= 0) {
      points.push([first, y])
      if (last !== first) points.push([last, y])
    }
  }
  if (points.length < 3) return pixels
  const hull = convexHull(points)
  const polygon = hull.map(([x, y]) => `${x},${y}`).join(' ')
  return sharp(
    Buffer.from(
      `<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="black"/><polygon points="${polygon}" fill="white"/></svg>`
    )
  )
    .extractChannel(0)
    .threshold(128)
    .raw()
    .toBuffer()
}

function needsFilledOuterContour(id) {
  return /(books|table|desk|bench|cabinet|library|pillar|column|heart|mountain|flame|pot|aloe|sign)/.test(
    id
  )
}

async function cleanedAlpha(path, row) {
  const closed = await sharp(path)
    .extractChannel(0)
    .dilate(3)
    .erode(3)
    .threshold(128)
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (needsFilledOuterContour(row.id)) {
    closed.data = await filledOuterContour(closed.data, closed.info.width, closed.info.height)
  }
  cleanComponents(closed.data, closed.info.width, closed.info.height)
  fillInternalHoles(closed.data, closed.info.width, closed.info.height)
  return closed
}

async function makeSprite(row, alpha, logicalBounds, destination) {
  const sourceLeft = logicalBounds.left * SCALE
  const sourceTop = logicalBounds.top * SCALE
  const sourceWidth = (logicalBounds.right - logicalBounds.left) * SCALE
  const sourceHeight = (logicalBounds.bottom - logicalBounds.top) * SCALE
  const alphaLeft = sourceLeft - row.geometry.left
  const alphaTop = sourceTop - row.geometry.top
  const alphaCrop = Buffer.alloc(sourceWidth * sourceHeight)
  for (let y = 0; y < sourceHeight; y += 1) {
    const from = (alphaTop + y) * alpha.info.width + alphaLeft
    alpha.data.copy(alphaCrop, y * sourceWidth, from, from + sourceWidth)
  }
  const { data: rgb } = await sharp(master)
    .extract({ left: sourceLeft, top: sourceTop, width: sourceWidth, height: sourceHeight })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const rgba = Buffer.alloc(sourceWidth * sourceHeight * 4)
  for (let pixel = 0; pixel < alphaCrop.length; pixel += 1) {
    rgba[pixel * 4] = rgb[pixel * 3]
    rgba[pixel * 4 + 1] = rgb[pixel * 3 + 1]
    rgba[pixel * 4 + 2] = rgb[pixel * 3 + 2]
    rgba[pixel * 4 + 3] = alphaCrop[pixel]
  }
  await sharp(rgba, { raw: { width: sourceWidth, height: sourceHeight, channels: 4 } })
    .resize(
      (logicalBounds.right - logicalBounds.left) * OUTPUT_SCALE,
      (logicalBounds.bottom - logicalBounds.top) * OUTPUT_SCALE,
      { kernel: sharp.kernel.lanczos3 }
    )
    .webp({ lossless: true })
    .toFile(destination)
}

const manifest = []
let totalBytes = 0
for (const row of rows) {
  const current = currentManifest.find(item => item.id === row.id)
  if (!current || !row.candidates[0]) throw new Error(`Missing production metadata for ${row.id}`)
  const alpha = await cleanedAlpha(
    resolve(reviewRoot, row.candidates[0].alpha.replace(/^\.\//, '')),
    row
  )
  const localBounds = boundsOf(alpha.data, alpha.info.width, alpha.info.height)
  if (!localBounds) throw new Error(`Empty mask for ${row.id}`)
  const logicalBounds = {
    left: Math.floor((row.geometry.left + localBounds.left) / SCALE),
    top: Math.floor((row.geometry.top + localBounds.top) / SCALE),
    right: Math.ceil((row.geometry.left + localBounds.right) / SCALE),
    bottom: Math.ceil((row.geometry.top + localBounds.bottom) / SCALE),
  }
  const destination = resolve(spritesRoot, `${row.id}.webp`)
  await makeSprite(row, alpha, logicalBounds, destination)
  totalBytes += (await stat(destination)).size
  manifest.push({
    id: row.id,
    name: current.name,
    x: logicalBounds.left,
    y: logicalBounds.top,
    width: logicalBounds.right - logicalBounds.left,
    height: logicalBounds.bottom - logicalBounds.top,
    pixelRatio: OUTPUT_SCALE,
    baseY: current.baseY,
    always: current.always,
    url: `./assets/occlusion/${row.id}.webp`,
  })
}

await writeFile(resolve(productionRoot, 'occlusion-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `Built ${manifest.length} staged 2× occluders (${(totalBytes / 1024 / 1024).toFixed(1)} MiB) in ${productionRoot}`
)
