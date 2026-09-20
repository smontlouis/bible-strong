import { fal } from '@fal-ai/client'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const WORLD_WIDTH = 1671
const WORLD_HEIGHT = 941
const SCALE = 4
const PAD = 32
const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDirectory, '..')
const repositoryRoot = resolve(root, '../..')
const sourceArgument = process.argv.find(argument => argument.startsWith('--source='))?.slice(9)
if (!sourceArgument) {
  console.error('Usage: yarn segment:benchmark --source=/absolute/path/to/upscale.png [--only=id]')
  process.exit(1)
}
const source = resolve(sourceArgument)
const only = process.argv.find(argument => argument.startsWith('--only='))?.slice(7)
const refresh = process.argv.includes('--refresh')
const runAll = process.argv.includes('--all')
const output = resolve(root, 'segmentation-qa/sam3-benchmark')
const cropsDirectory = resolve(output, 'crops')
const resultsDirectory = resolve(output, 'results')
const normalizedMaster = resolve(output, 'normalized-master.png')

process.loadEnvFile(resolve(repositoryRoot, '.env'))
if (!process.env.FAL_KEY) throw new Error('FAL_KEY is missing from the repository .env file.')
await stat(source)
await mkdir(cropsDirectory, { recursive: true })
await mkdir(resultsDirectory, { recursive: true })

const details = JSON.parse(await readFile(resolve(scriptDirectory, 'detail-objects.json'), 'utf8'))
const benchmark = JSON.parse(
  await readFile(resolve(scriptDirectory, 'sam3-benchmark-targets.json'), 'utf8')
)
const baseTargets = [
  { id: 'tree-west', name: 'Arbre ouest', box: [669, 310, 735, 391], baseY: 380, positive: [[702, 340], [705, 380]], negative: [[693, 399], [735, 354]] },
  {
    id: 'central-table',
    name: 'Table et Bible',
    box: [742, 386, 932, 520],
    baseY: 489,
    positive: [
      [821, 459],
      [834, 423],
      [811, 497],
    ],
    negative: [
      [833, 524],
      [737, 451],
      [934, 451],
    ],
  },
  { id: 'tree-north-east', name: 'Arbre nord-est', box: [875, 310, 940, 382], baseY: 374, positive: [[909, 341], [906, 371]], negative: [[914, 392], [941, 350]] },
  { id: 'cypress-east', name: 'Arbre du pont est', box: [1045, 349, 1100, 438], baseY: 427, positive: [[1072, 388], [1074, 425]], negative: [[1050, 431], [1098, 433]] },
  { id: 'sign-west', name: 'Panneau ouest', box: [625, 415, 678, 492], baseY: 483, positive: [[642, 465], [657, 456], [654, 437]], negative: [[630, 457], [666, 475]] },
  { id: 'sign-east', name: 'Panneau est', box: [1011, 412, 1057, 488], baseY: 480, positive: [[1028, 470], [1043, 455], [1040, 436]], negative: [[1015, 450], [1047, 478]] },
  { id: 'dictionary-desk', name: 'Bureau dictionnaire', box: [232, 222, 405, 330], baseY: 308, positive: [[301, 284], [329, 248], [365, 289]], negative: [[322, 338], [225, 273], [408, 289]] },
  { id: 'lexicon-desk', name: 'Table lexique', box: [815, 185, 944, 266], baseY: 254, positive: [[878, 234], [876, 217], [855, 249]], negative: [[947, 232], [885, 275]] },
  { id: 'themes-table', name: 'Table thèmes', box: [235, 677, 367, 772], baseY: 747, positive: [[298, 710], [294, 727], [302, 754]], negative: [[285, 775], [365, 749]] },
  { id: 'comparison-left', name: 'Table comparaison gauche', box: [684, 726, 808, 821], baseY: 799, positive: [[745, 764], [731, 749], [735, 802]], negative: [[742, 825], [689, 792]] },
  { id: 'comparison-right', name: 'Table comparaison droite', box: [874, 737, 992, 833], baseY: 812, positive: [[935, 775], [935, 757], [938, 813]], negative: [[937, 840], [991, 811]] },
  { id: 'commentary-table', name: 'Table commentaires', box: [1282, 679, 1495, 791], baseY: 765, positive: [[1386, 747], [1395, 711], [1321, 773]], negative: [[1410, 790], [1286, 778], [1499, 738]] },
  {
    id: 'pergola-west-column',
    name: 'Pilier ouest de la pergola',
    box: [1207, 522, 1255, 700],
    baseY: 692,
    positive: [
      [1225, 598],
      [1225, 674],
      [1228, 542],
    ],
    negative: [
      [1259, 615],
      [1200, 615],
    ],
  },
  { id: 'pergola-east-column', name: 'Pilier est de la pergola', box: [1498, 581, 1559, 788], baseY: 773, positive: [[1519, 637], [1520, 715], [1518, 765]], negative: [[1570, 666], [1556, 705], [1574, 750]] },
  { id: 'rail-west', name: 'Rambarde avant ouest', box: [478, 302, 595, 391], baseY: 410, always: true, positive: [[543, 357], [517, 339], [560, 366], [488, 316]], negative: [[531, 326], [573, 355], [604, 400], [520, 360]] },
  { id: 'rail-south-west', name: 'Rambarde avant sud-ouest', box: [545, 510, 678, 607], baseY: 610, always: true, positive: [[589, 553], [633, 534], [603, 575], [555, 581]], negative: [[589, 535], [636, 514], [595, 591]] },
  {
    id: 'rail-east',
    name: 'Rambarde avant est',
    box: [1078, 292, 1187, 384],
    baseY: 409,
    positive: [
      [1116, 362],
      [1150, 335],
      [1170, 320],
    ],
    negative: [
      [1132, 316],
      [1090, 375],
      [1150, 359],
    ],
  },
  { id: 'rail-south-east', name: 'Rambarde avant sud-est', box: [993, 502, 1155, 625], baseY: 626, always: true, positive: [[1004, 521], [1068, 556], [1128, 602], [1034, 540], [1106, 579]], negative: [[1040, 523], [1100, 556], [1150, 587], [1060, 589]] },
]
const allTargets = [...details, ...baseTargets]
const currentManifest = JSON.parse(
  await readFile(resolve(root, 'src/generated/occlusion-manifest.json'), 'utf8')
)

async function ensureNormalizedMaster() {
  let fresh = false
  try {
    const [masterInfo, sourceInfo] = await Promise.all([stat(normalizedMaster), stat(source)])
    fresh = masterInfo.mtimeMs >= sourceInfo.mtimeMs
  } catch {}
  if (fresh) return
  console.log(`Normalizing ${basename(source)} to ${WORLD_WIDTH * SCALE} × ${WORLD_HEIGHT * SCALE}…`)
  await sharp(source, { limitInputPixels: false })
    .resize(WORLD_WIDTH * SCALE, WORLD_HEIGHT * SCALE, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .removeAlpha()
    .png()
    .toFile(normalizedMaster)
}

function cropGeometry(target) {
  const [x0, y0, x1, y1] = target.box
  const left = Math.max(0, (x0 - PAD) * SCALE)
  const top = Math.max(0, (y0 - PAD) * SCALE)
  const right = Math.min(WORLD_WIDTH * SCALE, (x1 + PAD) * SCALE)
  const bottom = Math.min(WORLD_HEIGHT * SCALE, (y1 + PAD) * SCALE)
  return { left, top, width: right - left, height: bottom - top }
}

function localPoint([x, y], crop) {
  return { x: x * SCALE - crop.left, y: y * SCALE - crop.top }
}

async function maskAlpha(maskBuffer, crop) {
  const metadata = await sharp(maskBuffer).metadata()
  const pipeline = metadata.hasAlpha
    ? sharp(maskBuffer).extractChannel('alpha')
    : sharp(maskBuffer).greyscale()
  return pipeline
    .resize(crop.width, crop.height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .threshold(128)
    .png()
    .toBuffer()
}

async function spriteFromAlpha(cropPath, alpha, destination) {
  const { data: rgb, info } = await sharp(cropPath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const alphaPixels = await sharp(alpha)
    .resize(info.width, info.height, { fit: 'fill' })
    .extractChannel(0)
    .raw()
    .toBuffer()
  const rgba = Buffer.alloc(info.width * info.height * 4)
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const rgbOffset = pixel * 3
    const rgbaOffset = pixel * 4
    rgba[rgbaOffset] = rgb[rgbOffset]
    rgba[rgbaOffset + 1] = rgb[rgbOffset + 1]
    rgba[rgbaOffset + 2] = rgb[rgbOffset + 2]
    rgba[rgbaOffset + 3] = alphaPixels[pixel]
  }
  await sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(destination)
}

async function oldAlpha(target, crop) {
  const entry = currentManifest.find(candidate => candidate.id === target.id)
  if (!entry) return null
  const sprite = resolve(root, 'public', entry.url.replace(/^\.\//, ''))
  const resized = await sharp(sprite)
    .resize(entry.width * SCALE, entry.height * SCALE, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer()
  const canvas = await sharp({
    create: {
      width: crop.width,
      height: crop.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: resized,
        left: entry.x * SCALE - crop.left,
        top: entry.y * SCALE - crop.top,
      },
    ])
    .png()
    .toBuffer()
  return sharp(canvas).extractChannel('alpha').png().toBuffer()
}

function imageUrl(path) {
  return path.replace(`${output}/`, './')
}

function promptForTarget(target) {
  const id = target.id
  if (id.includes('arch')) return 'one complete flower-covered wooden pergola arch, including all flowers, vines, the horizontal top beam, and both vertical posts'
  if (id.includes('library')) return 'one complete bookshelf, including its outer frame, every shelf, and all books inside and beside it'
  if (id.includes('books')) return 'one complete stack of books'
  if (id.includes('cypress')) return 'one complete tall cypress tree, including its foliage and trunk'
  if (id.includes('tree')) return 'one complete leafy tree, including its full canopy and trunk'
  if (id.includes('grasses') || id.includes('grass')) return 'one complete cluster of ornamental grasses and leaves'
  if (id.includes('aloe')) return 'one complete aloe plant with all its leaves'
  if (id.includes('shrub')) return 'one complete dense shrub cluster, including all attached leaves and flowers'
  if (id.includes('flowers')) return 'one complete flower bed, including all flowers and attached leaves'
  if (id.includes('vine')) return 'one complete climbing vine growing at the base of the wall panel'
  if (id.includes('pot')) return 'one complete potted plant, including the pot and all foliage'
  if (id.includes('cabinet')) return 'one complete cabinet, including its frame, shelves or drawers'
  if (id.includes('pillar') || id.includes('column')) return 'one complete stone column, from its capital to its base'
  if (id.includes('bench')) return 'one complete garden bench, including its seat and all legs'
  if (id.includes('heart')) return 'one complete circular stone medallion with a heart symbol'
  if (id.includes('mountain')) return 'one complete circular stone medallion with a mountain symbol'
  if (id.includes('flame')) return 'one complete circular stone medallion with a flame symbol'
  if (id.includes('desk')) return 'one complete wooden study desk and everything resting on top of it'
  if (id.includes('table') || id.includes('comparison-')) return 'one complete study table, including its top, books, and every leg'
  if (id.includes('rail')) return 'one complete wooden bridge railing in the foreground, including all posts and rails'
  if (id.includes('sign')) return 'one complete wooden direction sign, including all sign boards and its post'
  return `one complete foreground object: ${target.name}`
}

await ensureNormalizedMaster()
let rows = []
try {
  rows = JSON.parse(await readFile(resolve(output, 'results.json'), 'utf8'))
} catch {}
const benchmarkById = new Map(benchmark.map(item => [item.id, item]))
const selected = (runAll
  ? allTargets.map(target => ({
      id: target.id,
      prompt: promptForTarget(target),
      ...benchmarkById.get(target.id),
    }))
  : benchmark
).filter(item => !only || item.id === only)
if (selected.length === 0) throw new Error(`Unknown benchmark target: ${only}`)

for (const item of selected) {
  const annotatedTarget = allTargets.find(candidate => candidate.id === item.id)
  if (!annotatedTarget) throw new Error(`Missing annotations for ${item.id}`)
  const target = { ...annotatedTarget, ...(item.box ? { box: item.box } : {}) }
  const crop = cropGeometry(target)
  const cropPath = resolve(cropsDirectory, `${target.id}.png`)
  await sharp(normalizedMaster).extract(crop).png().toFile(cropPath)
  const cached = rows.find(row => row.id === target.id)
  if (cached && !refresh) {
    console.log(`Rebuilding cached review for ${target.id}…`)
    const candidates = []
    for (const candidate of cached.candidates) {
      const rawPath = resolve(output, candidate.raw.replace(/^\.\//, ''))
      const alpha = await maskAlpha(await readFile(rawPath), crop)
      const alphaPath = resolve(resultsDirectory, `${target.id}-alpha-${candidate.index}.png`)
      const spritePath = resolve(resultsDirectory, `${target.id}-candidate-${candidate.index}.png`)
      await writeFile(alphaPath, alpha)
      await spriteFromAlpha(cropPath, alpha, spritePath)
      candidates.push({
        ...candidate,
        alpha: imageUrl(alphaPath),
        sprite: imageUrl(spritePath),
      })
    }
    const previousAlpha = await oldAlpha(target, crop)
    let previous = null
    if (previousAlpha) {
      const previousPath = resolve(resultsDirectory, `${target.id}-previous.png`)
      await spriteFromAlpha(cropPath, previousAlpha, previousPath)
      previous = imageUrl(previousPath)
    }
    Object.assign(cached, {
      name: target.name,
      prompt: item.prompt,
      crop: imageUrl(cropPath),
      previous,
      candidates,
      geometry: crop,
    })
    continue
  }
  const cropFile = new File([await readFile(cropPath)], `${target.id}.png`, { type: 'image/png' })
  console.log(`Uploading ${target.id} (${crop.width} × ${crop.height})…`)
  let uploadedUrl
  try {
    uploadedUrl = await fal.storage.upload(cropFile, { lifecycle: { expiresIn: '1h' } })
  } catch (error) {
    if (error?.status === 403 && error?.body?.detail?.includes('Exhausted balance')) {
      console.error('fal.ai refused the upload because the account balance is exhausted.')
      process.exit(2)
    }
    throw error
  }
  const box = target.box.map((coordinate, index) =>
    Math.round(coordinate * SCALE - (index % 2 === 0 ? crop.left : crop.top))
  )
  const positivePoints = item.positive ?? target.positive
  const negativePoints = item.negative ?? target.negative ?? []
  const pointPrompts = [
    ...positivePoints.map(point => ({ ...localPoint(point, crop), label: 1, object_id: 1 })),
    ...negativePoints.map(point => ({
      ...localPoint(point, crop),
      label: 0,
      object_id: 1,
    })),
  ]
  console.log(`Segmenting ${target.id} with SAM 3…`)
  let result
  try {
    result = await fal.subscribe('fal-ai/sam-3/image', {
      input: {
        image_url: uploadedUrl,
        prompt: item.prompt,
        point_prompts: pointPrompts,
        box_prompts: [
          {
            x_min: box[0],
            y_min: box[1],
            x_max: box[2],
            y_max: box[3],
            object_id: 1,
          },
        ],
        apply_mask: false,
        output_format: 'png',
        return_multiple_masks: true,
        max_masks: 3,
        include_scores: true,
        include_boxes: true,
      },
      storageSettings: { expiresIn: '1h' },
    })
  } catch (error) {
    if (error?.status === 403 && error?.body?.detail?.includes('Exhausted balance')) {
      console.error('fal.ai refused the segmentation because the account balance is exhausted.')
      process.exit(2)
    }
    throw error
  }
  const data = result.data
  const candidates = []
  for (const [index, mask] of (data.masks ?? []).entries()) {
    const raw = await fetch(mask.url).then(response => {
      if (!response.ok) throw new Error(`Cannot download mask ${response.status}`)
      return response.arrayBuffer()
    })
    const rawPath = resolve(resultsDirectory, `${target.id}-raw-${index}.png`)
    await writeFile(rawPath, Buffer.from(raw))
    const alpha = await maskAlpha(Buffer.from(raw), crop)
    const alphaPath = resolve(resultsDirectory, `${target.id}-alpha-${index}.png`)
    const spritePath = resolve(resultsDirectory, `${target.id}-candidate-${index}.png`)
    await writeFile(alphaPath, alpha)
    await spriteFromAlpha(cropPath, alpha, spritePath)
    candidates.push({
      index,
      score: data.scores?.[index] ?? data.metadata?.[index]?.score ?? null,
      alpha: imageUrl(alphaPath),
      sprite: imageUrl(spritePath),
      raw: imageUrl(rawPath),
    })
  }
  const previousAlpha = await oldAlpha(target, crop)
  let previous = null
  if (previousAlpha) {
    const previousPath = resolve(resultsDirectory, `${target.id}-previous.png`)
    await spriteFromAlpha(cropPath, previousAlpha, previousPath)
    previous = imageUrl(previousPath)
  }
  const row = {
    id: target.id,
    name: target.name,
    prompt: item.prompt,
    crop: imageUrl(cropPath),
    previous,
    candidates,
    requestId: result.requestId,
    geometry: crop,
  }
  rows = [...rows.filter(candidate => candidate.id !== target.id), row]
  await writeFile(resolve(output, 'results.json'), `${JSON.stringify(rows, null, 2)}\n`)
}

rows.sort(
  (left, right) =>
    (runAll ? allTargets : benchmark).findIndex(item => item.id === left.id) -
    (runAll ? allTargets : benchmark).findIndex(item => item.id === right.id)
)
await writeFile(resolve(output, 'results.json'), `${JSON.stringify(rows, null, 2)}\n`)

const cards = rows
  .map(
    row => `<article>
      <h2>${row.name} <code>${row.id}</code></h2>
      <p>${row.prompt}</p>
      <div class="images">
        <figure><img src="${row.crop}"><figcaption>Crop haute définition</figcaption></figure>
        ${row.previous ? `<figure><img src="${row.previous}"><figcaption>Ancien masque reprojeté</figcaption></figure>` : ''}
        ${row.candidates
          .map(
            candidate => `<figure><img src="${candidate.sprite}"><figcaption>SAM 3 · candidat ${candidate.index} · score ${candidate.score ?? '—'}</figcaption></figure>`
          )
          .join('')}
      </div>
    </article>`
  )
  .join('\n')
await writeFile(
  resolve(output, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>Benchmark SAM 3 · Bible Strong</title>
  <style>body{font:15px system-ui;margin:24px;background:#eef1f6;color:#173845}article{background:white;padding:20px;border-radius:16px;margin:0 0 24px}h2{margin-top:0}.images{display:flex;gap:12px;overflow:auto;align-items:start}figure{margin:0;min-width:240px}img{display:block;width:240px;height:240px;object-fit:contain;background:repeating-conic-gradient(#e8e8e8 0 25%,white 0 50%) 50%/20px 20px;border:1px solid #ccd5d8}figcaption{margin-top:6px;font-size:12px}code{font-size:12px;color:#64777d}</style>
  <h1>Benchmark SAM 3 · Bible Strong</h1>${cards}`
)
console.log(`Review ready: ${resolve(output, 'index.html')}`)
