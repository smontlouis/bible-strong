import type { BibleContentAccess } from '~features/resources/bibleContentAccess'
import { getBooksForCanon } from './bibleBookCatalog'
import { versions } from './bibleVersions'

export async function selectBibleReferenceVersion(
  version: string,
  books: number[],
  access: Pick<BibleContentAccess, 'loadCoverage' | 'getAvailability'>
): Promise<string> {
  const current = versions[version]
  const containsBooks = (candidate: (typeof versions)[string]) => {
    const canonBooks = getBooksForCanon(candidate.canonId ?? 'protestant-66')
    return books.every(book => canonBooks.some(entry => entry.Numero === book))
  }
  // A missing book permits selection before loading; a text-loading failure does not.
  if (!current || containsBooks(current)) return version

  const candidates = Object.values(versions)
    .filter(candidate => !candidate.hidden && candidate.id !== version && containsBooks(candidate))
    .sort(
      (a, b) => Number(b.language === current.language) - Number(a.language === current.language)
    )

  for (const candidate of candidates) {
    try {
      const availability = await access.getAvailability?.(candidate.id)
      if (availability?.status === 'unavailable') continue
      const coverage = await access.loadCoverage(candidate.id)
      if (books.every(book => coverage.books.includes(book))) return candidate.id
    } catch {
      // An inaccessible candidate cannot be selected for this reference.
    }
  }
  return version
}
