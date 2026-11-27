// Snapshots the last verse of every chapter of the published Bibles, read from the public
// coverage of the Resource API, for the versification conformance test. Read-only.
//
//   yarn workspace @bible-strong/resource-domain versification:coverage [VERSION…]
//
// Without versions, the Bibles of the current snapshot are read again.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://api.bible-strong.app'
const output = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/fixtures/bibleCoverageLastVerses.json'
)

interface Coverage {
  books: number[]
  chaptersByBook: Record<string, number[]>
  verseCountByBookChapter: Record<string, number>
  verseNumbersByBookChapter?: Record<string, number[]>
}

const lastVerses = (coverage: Coverage): Record<string, number[]> => {
  const books: Record<string, number[]> = {}
  for (const book of coverage.books.filter(book => book <= 66)) {
    books[String(book)] = (coverage.chaptersByBook[String(book)] ?? []).map(chapter => {
      const key = `${book}-${chapter}`
      const numbers = coverage.verseNumbersByBookChapter?.[key]
      return numbers && numbers.length > 0
        ? Math.max(...numbers)
        : (coverage.verseCountByBookChapter[key] ?? 0)
    })
  }
  return books
}

const versions =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : Object.keys(JSON.parse(await readFile(output, 'utf8')).bibles)

const bibles: Record<string, Record<string, number[]>> = {}
for (const version of versions) {
  const response = await fetch(`${API}/v1/bibles/${encodeURIComponent(version)}/coverage`, {
    headers: { accept: 'application/json', 'user-agent': 'bible-strong-resource-domain' },
  })
  if (!response.ok) throw new Error(`coverage-${version}-${response.status}`)
  bibles[version] = lastVerses((await response.json()) as Coverage)
}

await writeFile(
  output,
  `${JSON.stringify({ source: `${API}/v1/bibles/:version/coverage`, capturedOn: new Date().toISOString().slice(0, 10), note: 'Last verse number of each chapter, books 1-66; chapters numbered from 1 in each array.', bibles })}\n`
)
console.log(`Wrote ${versions.length} Bibles to ${path.relative(process.cwd(), output)}`)
