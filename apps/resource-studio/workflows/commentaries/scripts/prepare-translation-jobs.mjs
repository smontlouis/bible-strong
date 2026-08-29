import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(root, '.local/full-export/missing')
const libraryRoot = path.join(root, '.local/library/chunks')
const outputRoot = path.join(root, '.local/translation-jobs')
const maxSourceChars = Number(process.argv[2] ?? 18_000)

const readJson = async file => JSON.parse(await readFile(file, 'utf8'))

const writeJobs = async (resourceId, entries) => {
  const directory = path.join(outputRoot, resourceId)
  await mkdir(directory, { recursive: true })
  const batches = []
  let current = []
  let currentChars = 0

  for (const entry of entries) {
    const size = entry.sourceHtml.length
    if (current.length && currentChars + size > maxSourceChars) {
      batches.push(current)
      current = []
      currentChars = 0
    }
    current.push(entry)
    currentChars += size
  }
  if (current.length) batches.push(current)

  for (const [index, batch] of batches.entries()) {
    const batchId = `${resourceId}-${String(index + 1).padStart(4, '0')}`
    const payload = {
      schemaVersion: 1,
      resourceId,
      batchId,
      sourceCharacters: batch.reduce((total, entry) => total + entry.sourceHtml.length, 0),
      entries: batch,
    }
    await writeFile(path.join(directory, `${batchId}.json`), `${JSON.stringify(payload, null, 2)}\n`)
  }

  return { resourceId, entryCount: entries.length, batchCount: batches.length }
}

const findAquiferGap = async () => {
  const file = path.join(libraryRoot, '42/17/aquifer-fr.json')
  const chunk = await readJson(file)
  return chunk.entries
    .filter(entry => !entry.translation)
    .map(entry => ({
      id: entry.id,
      passage: entry.passage,
      sourceSha256: entry.source.sha256,
      sourceHtml: entry.source.html,
    }))
}

const summaries = []
for (const resourceId of ['acbc', 'barnes']) {
  summaries.push(await writeJobs(resourceId, await readJson(path.join(sourceRoot, `${resourceId}.json`))))
}
summaries.push(await writeJobs('aquifer-fr', await findAquiferGap()))

await writeFile(
  path.join(outputRoot, 'manifest.json'),
  `${JSON.stringify({ schemaVersion: 1, maxSourceChars, resources: summaries }, null, 2)}\n`,
)

process.stdout.write(`${summaries.map(item => `${item.resourceId}: ${item.entryCount} entrées / ${item.batchCount} lots`).join('\n')}\n`)
