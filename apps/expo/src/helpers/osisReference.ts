import {
  getSupportedOsisBookNumber,
  normalizeOsisReference,
} from '@bible-strong/bible-reference-parser/osis-reference'

export {
  getSupportedOsisBookId,
  getSupportedOsisBookNumber,
  normalizeOsisReference,
} from '@bible-strong/bible-reference-parser/osis-reference'

export interface BibleReferenceTarget {
  book: number
  chapter: number
  verse: number
  focusVerses?: number[]
  osis: string
}

/** One OSIS reference, `Gen.1.1`: its book, its chapter, and its verse when it names one. */
export const parseOsisRef = (osisRef: string) => {
  const [book, chapterStr, verseStr] = osisRef.split('.')
  const bookNumber = getSupportedOsisBookNumber(book)
  const chapter = Number(chapterStr)
  const verse = verseStr ? Number(verseStr) : undefined

  if (!bookNumber || !Number.isFinite(chapter)) {
    return undefined
  }

  return {
    book,
    bookNumber,
    chapter,
    verse: verse && Number.isFinite(verse) ? verse : undefined,
  }
}

const getFocusVersesFromOsis = (osis: string) => {
  const focusVerses: number[] = []
  let commonBook: string | undefined
  let commonChapter: number | undefined

  for (const segment of osis.split(',')) {
    const [startRef, endRef] = segment.split('-')
    const start = parseOsisRef(startRef)

    if (!start?.verse) {
      return undefined
    }

    if (commonBook === undefined) commonBook = start.book
    if (commonChapter === undefined) commonChapter = start.chapter

    if (commonBook !== start.book || commonChapter !== start.chapter) {
      return undefined
    }

    if (!endRef) {
      focusVerses.push(start.verse)
      continue
    }

    const end = parseOsisRef(endRef)

    if (!end?.verse || end.book !== commonBook || end.chapter !== commonChapter) {
      return undefined
    }

    for (let verse = start.verse; verse <= end.verse; verse += 1) {
      focusVerses.push(verse)
    }
  }

  return [...new Set(focusVerses)]
}

/**
 * Where an OSIS reference leads: its first verse, and the verses to focus when they all lie in one
 * chapter. It needs no reference parser, so the Bible reader page reads it too.
 */
export const osisToBibleReferenceTarget = (
  osis: string,
  _parserLanguage?: 'fr' | 'en'
): BibleReferenceTarget | undefined => {
  const normalizedOsis = normalizeOsisReference(osis)
  const firstSegment = normalizedOsis.split(',')[0]
  const firstRef = firstSegment.split('-')[0]
  const start = parseOsisRef(firstRef)

  if (!start) {
    return undefined
  }

  return {
    book: start.bookNumber,
    chapter: start.chapter,
    verse: start.verse ?? 1,
    focusVerses: getFocusVersesFromOsis(normalizedOsis),
    osis: normalizedOsis,
  }
}
