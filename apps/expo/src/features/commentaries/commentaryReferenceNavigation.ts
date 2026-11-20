import { getBook } from '~helpers/bibleBookCatalog'
import { osisToBibleReferenceTarget } from '~helpers/bcvParser'

/**
 * A passage a commentary or dictionary names opens focused, in the version being read when the
 * caller knows it (the active Bible tab), else in the default version.
 */
export const getCommentaryBibleViewRoute = (osis: string, version?: string) => {
  const target = osisToBibleReferenceTarget(osis)
  if (!target) return undefined
  const focusVerses = target.focusVerses ?? [target.verse]

  return {
    pathname: '/bible-view' as const,
    params: {
      contextDisplayMode: 'focused' as const,
      book: JSON.stringify(getBook(target.book)),
      chapter: String(target.chapter),
      verse: String(target.verse),
      focusVerses: JSON.stringify(focusVerses),
      ...(version && { version }),
    },
  }
}

export const getCommentaryPassageBibleViewRoute = ({
  book,
  chapter,
  startVerse,
  endVerse = startVerse,
  version,
}: {
  book: number
  chapter: number
  startVerse: number
  endVerse?: number
  version?: string
}) => {
  const bookEntry = getBook(book)
  if (
    !bookEntry ||
    !Number.isSafeInteger(chapter) ||
    chapter < 1 ||
    !Number.isSafeInteger(startVerse) ||
    startVerse < 1 ||
    !Number.isSafeInteger(endVerse) ||
    endVerse < startVerse
  ) {
    return undefined
  }

  return {
    pathname: '/bible-view' as const,
    params: {
      contextDisplayMode: 'focused' as const,
      book: JSON.stringify(bookEntry),
      chapter: String(chapter),
      verse: String(startVerse),
      focusVerses: JSON.stringify(
        Array.from({ length: endVerse - startVerse + 1 }, (_, index) => startVerse + index)
      ),
      ...(version && { version }),
    },
  }
}
