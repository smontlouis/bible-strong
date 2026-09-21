import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import { getBooksForCanon, isBibleCanonId } from '~helpers/bibleBookCatalog'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { staticResourceQueryOptions } from '~helpers/queryOptions'
import { useResourceAccess } from '~features/resources/resourceAccess'
import type { VersionCode } from '~state/tabs'
import type { SearchEntityResult } from './shared/searchResultTypes'
import { getReferenceSearchItemsFromSegments } from './shared/searchItems'

export type PassageBrowserProps = {
  version: VersionCode
  requireVerse?: boolean
  onSelect: (item: SearchEntityResult) => void
}

export function usePassageBrowser(version: VersionCode) {
  const resources = useResourceAccess()
  const { data: coverage } = useQuery({
    queryKey: resourceQueryKeys.bibleCoverage(version),
    queryFn: () => resources.bibleContent.loadCoverage(version),
    ...staticResourceQueryOptions,
  })
  const canon = coverage?.canon?.id
  const books = getBooksForCanon(
    canon && isBibleCanonId(canon) ? canon : getBibleVersionCanonId(version),
    coverage?.books
  )
  const [selectedBook, setSelectedBook] = useState<number | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const book = books.find(candidate => candidate.Numero === selectedBook)
  const chapters = book
    ? (coverage?.chaptersByBook[book.Numero] ??
      Array.from({ length: book.Chapitres }, (_, index) => index + 1))
    : []
  const verseCount = (chapter: number) =>
    coverage?.verseCountByBookChapter[`${book!.Numero}-${chapter}`] ??
    countLsgChapters[`${book!.Numero}-${chapter}`] ??
    1
  const verses = selectedChapter
    ? Array.from({ length: verseCount(selectedChapter) }, (_, i) => i + 1)
    : []
  const chapterResult = (chapter: number, verse?: number) =>
    getReferenceSearchItemsFromSegments(
      [
        {
          book: book!.Numero,
          chapter,
          startVerse: verse ?? 1,
          endVerse: verse ?? verseCount(chapter),
          isWholeChapter: verse === undefined,
        },
      ],
      { mode: 'navigation', version }
    )[0]
  return {
    books,
    book,
    chapters,
    verses,
    selectedChapter,
    setSelectedChapter,
    setSelectedBook,
    chapterResult,
  }
}
