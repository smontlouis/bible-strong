import type { CommentaryVerseAvailability } from './commentaryVerseAvailability'

type CommentaryCoverage = {
  books: readonly number[]
  chaptersByBook: Record<number, readonly number[]>
}

type CommentarySectionRange = {
  rangeStartVerse: number
  rangeEndVerse: number
}

const DEFAULT_CHAPTER_CONTEXT_THRESHOLD = 8
const CHAPTER_CONTEXT_RATIO = 0.6

const getSectionSpan = (section: CommentarySectionRange) =>
  section.rangeEndVerse - section.rangeStartVerse + 1

export const getCommentarySectionsForVerse = <Section extends CommentarySectionRange>(
  sections: readonly Section[],
  verse: number | undefined
) => {
  if (verse === undefined || !Number.isSafeInteger(verse) || verse < 1) return [...sections]
  return sections.filter(
    section => verse >= section.rangeStartVerse && verse <= section.rangeEndVerse
  )
}

export const groupCommentarySectionsForVerse = <Section extends CommentarySectionRange>({
  sections,
  verse,
  chapterVerseCount,
}: {
  sections: readonly Section[]
  verse: number
  chapterVerseCount?: number
}) => {
  const matchingSections = getCommentarySectionsForVerse(sections, verse)
  const chapterContextThreshold = chapterVerseCount
    ? Math.max(3, Math.ceil(chapterVerseCount * CHAPTER_CONTEXT_RATIO))
    : DEFAULT_CHAPTER_CONTEXT_THRESHOLD
  const directSections: Section[] = []
  const chapterContextSections: Section[] = []

  for (const section of matchingSections) {
    const target =
      getSectionSpan(section) >= chapterContextThreshold ? chapterContextSections : directSections
    target.push(section)
  }

  const bySpecificity = (left: Section, right: Section) =>
    getSectionSpan(left) - getSectionSpan(right) ||
    left.rangeStartVerse - right.rangeStartVerse ||
    left.rangeEndVerse - right.rangeEndVerse

  return {
    directSections: directSections.sort(bySpecificity),
    chapterContextSections: chapterContextSections.sort(bySpecificity),
  }
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

  if (item.state === 'verse' && item.comment && (item.comment.matchingSectionCount ?? 1) === 1) {
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

  if (item.state === 'verse' && item.comment) {
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

  if (item.state === 'chapter') {
    return {
      pathname: '/commentary-chapter',
      params: {
        projectionId: item.projectionId,
        book: String(location.book),
        chapter: String(location.chapter),
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
