import { bibleBookName, bibleBookSlug } from '../bible/bibleBooks'
import type { ResourceLanguage } from '../resources/publicSite'
import type { StrongPageConcordance } from './strong.functions'
import { buildStrongConcordancePath } from './strongRoutes'

/** Occurrences per book, each opening the concordance restricted to that book. */
export default function StrongBookCounts({
  entry,
  books,
  selectedBook,
}: {
  entry: { language: ResourceLanguage; code: string }
  books: StrongPageConcordance['books']
  selectedBook?: number
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {books.map(count => (
        <li key={count.book}>
          <a
            className="resource-chip"
            aria-current={count.book === selectedBook ? 'true' : undefined}
            href={buildStrongConcordancePath(entry.language, entry.code, {
              book: bibleBookSlug(count.book),
            })}
          >
            {bibleBookName(count.book, entry.language)}
            <span className="font-semibold">{count.verseCount}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
