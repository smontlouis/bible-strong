// Reconciles the Vectorize indexes of the library with Neon (amendment of 2026-11-12 to ADR-0103):
// every passage of an active publication gets its vector, read from Neon, and every other vector
// is deleted. Run it after a publication import that replaced a commentary or a dictionary (its
// old passages go by cascade), or whenever the indexes may have drifted:
//   yarn workspace @bible-strong/resource-service library:vectors:sync [--dry-run] [--language fr]
// RESOURCE_DATABASE_URL picks the database (local by default: production indexes must be compared
// with the production database). CLOUDFLARE_ACCOUNT_ID, with CLOUDFLARE_API_TOKEN or the logged-in
// Wrangler session. A run that would delete more than a quarter of an index stops, unless
// --allow-mass-delete. About 11 min, most of it listing the English index.
import { reconcileLibraryVectorIndexes } from '../repositories/libraryVectorSync'
import type { LibraryLanguage } from './libraryDocuments'
import { makeRestLibraryVectorStore } from './libraryVectorizeRest'

const option = (name: string) => {
  const index = process.argv.indexOf(`--${name}`)
  return index < 0 ? undefined : process.argv[index + 1]
}

const main = async () => {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!account) throw new Error('CLOUDFLARE_ACCOUNT_ID is needed to reach the Vectorize indexes')
  if (!process.env.RESOURCE_DATABASE_URL)
    console.warn('RESOURCE_DATABASE_URL is not set: comparing with the local database.')
  const language = option('language')
  if (language && language !== 'fr' && language !== 'en') throw new Error('--language fr|en')
  const started = Date.now()
  const report = await reconcileLibraryVectorIndexes(makeRestLibraryVectorStore(account), {
    dryRun: process.argv.includes('--dry-run'),
    languages: language ? [language as LibraryLanguage] : undefined,
    allowMassDelete: process.argv.includes('--allow-mass-delete'),
    onProgress: line => console.log(line),
  })
  console.log(JSON.stringify({ ...report, durationMs: Date.now() - started }))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
