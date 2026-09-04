import { osisToBibleReferenceTarget } from '~helpers/bcvParser'
import { getBook } from '~helpers/bibleBookCatalog'
import { normalizeOsisReference } from '~helpers/osisReference'
import verseToReference from '~helpers/verseToReference'

type OsisPoint = {
  book: string
  bookNumber: number
  chapter: number
  verse?: number
}

const parseOsisPoint = (value: string): OsisPoint | undefined => {
  const [book, chapterValue, verseValue] = value.split('.')
  const target = osisToBibleReferenceTarget(value)
  const chapter = Number(chapterValue)
  const verse = verseValue == null ? undefined : Number(verseValue)
  if (
    !target ||
    !book ||
    !Number.isInteger(chapter) ||
    (verse != null && !Number.isInteger(verse))
  ) {
    return undefined
  }
  return { book, bookNumber: target.book, chapter, verse }
}

const formatOsisPoint = (point: OsisPoint): string =>
  verseToReference({
    bookNum: point.bookNumber,
    chapterNum: point.chapter,
    verses: point.verse == null ? undefined : [point.verse],
  })

const formatOsisSegment = (segment: string): string => {
  const [startValue, endValue] = segment.split('-')
  const start = parseOsisPoint(startValue)
  if (!start) return segment
  if (!endValue) return formatOsisPoint(start)

  const end = parseOsisPoint(endValue)
  if (!end) return segment
  const startLabel = formatOsisPoint(start)

  if (start.book !== end.book) {
    return `${startLabel}-${formatOsisPoint(end)}`
  }
  if (start.chapter === end.chapter && end.verse != null) {
    return `${startLabel}-${end.verse}`
  }

  return `${startLabel}-${end.chapter}${end.verse == null ? '' : `:${end.verse}`}`
}

export const formatStrongOsisReference = (osis: string): string => {
  const target = osisToBibleReferenceTarget(osis)
  if (!target) return osis

  if (target.focusVerses) {
    return verseToReference({
      bookNum: target.book,
      chapterNum: target.chapter,
      verses: target.focusVerses,
    })
  }

  return normalizeOsisReference(osis).split(',').map(formatOsisSegment).join('; ')
}

export const getBibleViewRouteForStrongOsisReference = (osis: string) => {
  const target = osisToBibleReferenceTarget(osis)
  if (!target) return undefined

  return {
    pathname: '/bible-view' as const,
    params: {
      contextDisplayMode: 'focused' as const,
      book: JSON.stringify(getBook(target.book)),
      chapter: String(target.chapter),
      verse: String(target.verse),
      ...(target.focusVerses ? { focusVerses: JSON.stringify(target.focusVerses) } : {}),
    },
  }
}
