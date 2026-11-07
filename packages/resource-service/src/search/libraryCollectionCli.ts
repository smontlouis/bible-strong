// Imports a document collection of the library (ADR-0106) from a prepared file of JSON lines,
// whose first line describes the collection:
//   yarn workspace @bible-strong/resource-service library:collection --file /path/to/prepared.jsonl
// RESOURCE_DATABASE_URL picks the database (local by default). With CLOUDFLARE_ACCOUNT_ID passages
// are embedded through the Workers AI REST API, otherwise through the development embedding Worker
// (RESOURCE_LIBRARY_EMBEDDING_URL). Options: --concurrency 8, --batch 50, --writers 4. A file whose
// documents did not change leaves the collection as it is.
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { importLibraryCollection } from '../repositories/libraryCollectionRepository'
import { parseCollectionHeader } from './libraryCollections'
import { makeHttpLibraryEmbeddingProvider } from './libraryEmbedding'
import { makeRestLibraryEmbeddingProvider } from './libraryEmbeddingRest'

const option = (name: string) => {
  const index = process.argv.indexOf(`--${name}`)
  return index < 0 ? undefined : process.argv[index + 1]
}

const main = async () => {
  const file = option('file')
  if (!file) throw new Error('--file <prepared JSON lines>')
  const [header, ...records] = (await readFile(file, 'utf8'))
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as Record<string, unknown>)
  const collection = parseCollectionHeader(header ?? {})
  const started = Date.now()
  const report = await importLibraryCollection({
    provider: process.env.CLOUDFLARE_ACCOUNT_ID
      ? makeRestLibraryEmbeddingProvider(process.env.CLOUDFLARE_ACCOUNT_ID, { maxAttempts: 4 })
      : makeHttpLibraryEmbeddingProvider(
          process.env.RESOURCE_LIBRARY_EMBEDDING_URL ?? 'http://127.0.0.1:8791',
          { maxAttempts: 10, maxStatusAttempts: 3 }
        ),
    collection,
    records,
    source: path.basename(file),
    concurrency: Number(option('concurrency') ?? 8),
    batchSize: Number(option('batch') ?? 50),
    writers: Number(option('writers') ?? 4),
    onProgress: line => console.log(line),
  })
  console.log(JSON.stringify({ ...report, durationMs: Date.now() - started }))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
