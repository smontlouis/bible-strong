// Builds or refreshes the library search index (ADR-0103) from the active publications.
//   yarn workspace @bible-strong/resource-service topics:embeddings:dev   # terminal 1
//   yarn workspace @bible-strong/resource-service library:index [options] # terminal 2
// Options: --dry-run (count passages and characters, no embedding, no write),
// --corpus commentary,dictionary,nave,timeline,entity, --identity commentary:calvin:en,...,
// --rebuild-vector-index (drop the HNSW index during a first load and build it at the end),
// --concurrency 4, --batch 50, --writers 4 (database connections that write batches),
// --refresh-lexemes (count the lexemes even when no passage changed; a run that changes
// passages always does). RESOURCE_DATABASE_URL picks the database (local by default);
// RESOURCE_LIBRARY_EMBEDDING_URL the embedding endpoint (the development Worker by default).
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { indexLibrary } from '../repositories/libraryIndexRepository'
import { LIBRARY_CORPORA, type LibraryCorpus } from './libraryDocuments'
import { makeHttpLibraryEmbeddingProvider } from './libraryEmbedding'

const option = (name: string) => {
  const index = process.argv.indexOf(`--${name}`)
  return index < 0 ? undefined : process.argv[index + 1]
}
const list = (value: string | undefined) =>
  value
    ?.split(',')
    .map(item => item.trim())
    .filter(Boolean)

const main = async () => {
  const corpora = list(option('corpus'))
  if (corpora?.some(corpus => !LIBRARY_CORPORA.includes(corpus as LibraryCorpus)))
    throw new Error(`Unknown corpus; expected ${LIBRARY_CORPORA.join(', ')}`)
  const dryRun = process.argv.includes('--dry-run')
  const started = Date.now()
  const reports = await indexLibrary({
    provider: makeHttpLibraryEmbeddingProvider(
      process.env.RESOURCE_LIBRARY_EMBEDDING_URL ?? 'http://127.0.0.1:8791',
      { maxAttempts: 10, maxStatusAttempts: 3 }
    ),
    corpora: corpora as LibraryCorpus[] | undefined,
    identities: list(option('identity')),
    dryRun,
    rebuildVectorIndex: process.argv.includes('--rebuild-vector-index'),
    concurrency: Number(option('concurrency') ?? 4),
    batchSize: Number(option('batch') ?? 50),
    writers: Number(option('writers') ?? 4),
    refreshLexemes: process.argv.includes('--refresh-lexemes'),
    onProgress: line => console.log(line),
  })
  const total = reports.reduce(
    (sum, report) => ({
      passages: sum.passages + report.passages,
      embedded: sum.embedded + report.embedded,
      kept: sum.kept + report.kept,
      deleted: sum.deleted + report.deleted,
      characters: sum.characters + report.characters,
      embeddedCharacters: sum.embeddedCharacters + report.embeddedCharacters,
    }),
    { passages: 0, embedded: 0, kept: 0, deleted: 0, characters: 0, embeddedCharacters: 0 }
  )
  const refused = reports.flatMap(report => report.failed.map(key => `${report.identity} ${key}`))
  const summary = {
    dryRun,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    publications: reports.length,
    ...total,
    refused,
    // About four characters a token for French and English prose.
    estimatedEmbeddedTokens: Math.round(total.embeddedCharacters / 4),
    reports,
  }
  const output = path.join(__dirname, '../../.local/library-index-report.json')
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ ...summary, reports: undefined, report: output }))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
