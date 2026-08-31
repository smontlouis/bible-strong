import type { CommentaryVerseAvailability } from './commentaryVerseAvailability'

type CommentaryCoverage = {
  books: readonly number[]
  chaptersByBook: Record<number, readonly number[]>
}

export const getCoveredCommentaryLocation = (
  coverage: CommentaryCoverage,
  current: { book: number; chapter: number }
) => {
  if (coverage.chaptersByBook[current.book]?.includes(current.chapter)) return current
  const book = coverage.books[0]
  const chapter = book === undefined ? undefined : coverage.chaptersByBook[book]?.[0]
  return book === undefined || chapter === undefined ? undefined : { book, chapter }
}

export type CommentaryResourceRoute =
  | {
      pathname: '/commentary-entry'
      params: {
        projectionId: string
        book: string
        chapter: string
        sectionId: string
      }
    }
  | {
      pathname: '/commentary-chapter'
      params: {
        projectionId: string
        book: string
        chapter: string
        focusVerse?: string
      }
    }

export const getCommentaryResourceRoute = (
  item: CommentaryVerseAvailability,
  location: { book: number; chapter: number; verse: number }
): CommentaryResourceRoute | undefined => {
  if (item.state === 'unavailable') return undefined

  if (item.state === 'verse' && item.comment) {
    return {
      pathname: '/commentary-entry',
      params: {
        projectionId: item.projectionId,
        book: String(location.book),
        chapter: String(location.chapter),
        sectionId: item.comment.sectionId,
      },
    }
  }

  if (item.state === 'chapter') {
    return {
      pathname: '/commentary-chapter',
      params: {
        projectionId: item.projectionId,
        book: String(location.book),
        chapter: String(location.chapter),
        focusVerse: String(location.verse),
      },
    }
  }

  return {
    pathname: '/commentary-chapter',
    params: {
      projectionId: item.projectionId,
      book: '1',
      chapter: '1',
    },
  }
}
