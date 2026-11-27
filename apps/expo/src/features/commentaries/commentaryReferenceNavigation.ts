import { getBook } from '~helpers/bibleBookCatalog'
import { osisToBibleReferenceTarget } from '~helpers/bcvParser'
import { resourcePassageInBible } from '~features/resources/resourceNumbering'

/**
 * The resource whose numbering a passage is written in (`commentary:barnes`), and the version
 * that will show it when the route names none (the default version).
 */
export type PassageNumbering = { resource: string; shownVersion?: string }

const rangeOf = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index)

/**
 * A passage a commentary or dictionary names opens focused, in the version being read when the
 * caller knows it (the active Bible tab), else in the default version. Given the numbering of
 * the resource, it opens the verses that stand for the passage in that version (KJV Malachi 4:5
 * in LSG Malachi 3:23); nothing opens when none has an equivalent.
 */
export const getCommentaryBibleViewRoute = (
  osis: string,
  version?: string,
  numbering?: PassageNumbering
) => {
  const target = osisToBibleReferenceTarget(osis)
  if (!target) return undefined
  const targetFocusVerses = target.focusVerses ?? [target.verse]
  const passage = resourcePassageInBible(
    {
      book: target.book,
      chapter: target.chapter,
      startVerse: Math.min(...targetFocusVerses),
      endVerse: Math.max(...targetFocusVerses),
    },
    numbering?.resource,
    numbering?.shownVersion ?? version
  )
  if (!passage) return undefined
  const converted = passage.chapter !== target.chapter || passage.book !== target.book
  const unchanged =
    !converted &&
    passage.startVerse === Math.min(...targetFocusVerses) &&
    passage.endVerse === Math.max(...targetFocusVerses)
  const focusVerses = unchanged ? targetFocusVerses : rangeOf(passage.startVerse, passage.endVerse)

  return {
    pathname: '/bible-view' as const,
    params: {
      contextDisplayMode: 'focused' as const,
      book: JSON.stringify(getBook(passage.book)),
      chapter: String(passage.chapter),
      verse: String(unchanged ? target.verse : passage.startVerse),
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
  numbering,
}: {
  book: number
  chapter: number
  startVerse: number
  endVerse?: number
  version?: string
  numbering?: PassageNumbering
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
  const passage = resourcePassageInBible(
    { book, chapter, startVerse, endVerse },
    numbering?.resource,
    numbering?.shownVersion ?? version
  )
  if (!passage) return undefined

  return {
    pathname: '/bible-view' as const,
    params: {
      contextDisplayMode: 'focused' as const,
      book: JSON.stringify(getBook(passage.book)),
      chapter: String(passage.chapter),
      verse: String(passage.startVerse),
      focusVerses: JSON.stringify(rangeOf(passage.startVerse, passage.endVerse)),
      ...(version && { version }),
    },
  }
}
