import { bibleBookName } from '../bible/bibleBooks'
import { buildBiblePath } from '../bible/bibleRoutes'
import type { ResourceLanguage } from '../resources/publicSite'
import type { StrongPageConcordance } from './strong.functions'

/** Verses citing an entry, each linked to its Bible page, with the word highlighted. */
export default function StrongVerseList({
  verses,
  version,
  language,
}: {
  verses: StrongPageConcordance['verses']
  version: string
  language: ResourceLanguage
}) {
  return (
    <ol className="space-y-4">
      {verses.map(verse => (
        <li key={`${verse.book}-${verse.chapter}-${verse.verse}`}>
          <a
            className="resource-link text-sm font-semibold"
            href={buildBiblePath({
              versionId: version,
              book: verse.book,
              chapter: verse.chapter,
              passage: { startVerse: verse.verse },
            })}
          >
            {bibleBookName(verse.book, language)} {verse.chapter}:{verse.verse}
          </a>
          <div className="resource-prose" dangerouslySetInnerHTML={{ __html: verse.html }} />
        </li>
      ))}
    </ol>
  )
}
