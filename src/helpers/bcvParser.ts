import { bcv_parser } from 'bible-passage-reference-parser/esm/bcv_parser.js'
import * as en from 'bible-passage-reference-parser/esm/lang/en.js'
import * as fr from 'bible-passage-reference-parser/esm/lang/fr.js'

// import structuredClone from '@ungap/structured-clone'
import { getLanguage } from '../../i18n'

// if (!('structuredClone' in globalThis)) {
//   globalThis.structuredClone = structuredClone
// }

const language = getLanguage()

interface BcvParserWithTranslations extends bcv_parser {
  translations: {
    systems: Record<string, { chapters: Record<string, number[]>; order: Record<string, number> }>
  }
}

interface OsisAndIndices {
  osis: string
  indices: number[]
  translations: string[]
}

export interface BibleReferenceTarget {
  book: number
  chapter: number
  verse: number
  focusVerses?: number[]
  osis: string
}

export interface InlineBibleReference {
  text: string
  start: number
  end: number
  target: BibleReferenceTarget
}

export const bcv = new bcv_parser(language === 'fr' ? fr : en) as BcvParserWithTranslations

bcv.set_options({
  consecutive_combination_strategy: 'separate',
  sequence_combination_strategy: 'separate',
})

type BookID = string

const trans = 'default'

function getLastVerseInChapter(book: BookID, chapter: number): number {
  return bcv.translations.systems[trans].chapters[book][chapter - 1]
}

const getBookNumber = (book: BookID): number | undefined => {
  return bcv.translations.systems[trans].order[book]
}

const parseOsisRef = (osisRef: string) => {
  const [book, chapterStr, verseStr] = osisRef.split('.')
  const bookNumber = getBookNumber(book)
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

export const osisToBibleReferenceTarget = (osis: string): BibleReferenceTarget | undefined => {
  const firstSegment = osis.split(',')[0]
  const firstRef = firstSegment.split('-')[0]
  const start = parseOsisRef(firstRef)

  if (!start) {
    return undefined
  }

  return {
    book: start.bookNumber,
    chapter: start.chapter,
    verse: start.verse ?? 1,
    focusVerses: getFocusVersesFromOsis(osis),
    osis,
  }
}

const mergeSameChapterSequence = (
  text: string,
  references: InlineBibleReference[]
): InlineBibleReference[] => {
  const merged: InlineBibleReference[] = []

  for (const reference of references) {
    const previous = merged.at(-1)
    const separator = previous ? text.slice(previous.end, reference.start) : ''

    if (
      previous &&
      /^[,\s]+$/.test(separator) &&
      previous.target.book === reference.target.book &&
      previous.target.chapter === reference.target.chapter
    ) {
      const focusVerses = [
        ...(previous.target.focusVerses ?? [previous.target.verse]),
        ...(reference.target.focusVerses ?? [reference.target.verse]),
      ]

      merged[merged.length - 1] = {
        text: text.slice(previous.start, reference.end),
        start: previous.start,
        end: reference.end,
        target: {
          ...previous.target,
          osis: `${previous.target.osis},${reference.target.osis}`,
          focusVerses: [...new Set(focusVerses)],
        },
      }
      continue
    }

    merged.push(reference)
  }

  return merged
}

export const parseInlineBibleReferences = (text: string): InlineBibleReference[] => {
  const references = bcv.parse(text).osis_and_indices() as OsisAndIndices[]

  const parsedReferences = references
    .map(({ osis, indices }) => {
      const [start, end] = indices
      const target = osisToBibleReferenceTarget(osis)

      if (!target || start === undefined || end === undefined || end <= start) {
        return undefined
      }

      return {
        text: text.slice(start, end),
        start,
        end,
        target,
      }
    })
    .filter((reference): reference is InlineBibleReference => Boolean(reference))

  return mergeSameChapterSequence(text, parsedReferences)
}

export function getIntermediateChapters(startRef: string, endRef: string) {
  const [startBook, startChapterStr, startVerseStr] = startRef.split('.')
  const [endBook, endChapterStr, endVerseStr] = endRef.split('.')

  const startChapter = parseInt(startChapterStr, 10)
  const endChapter = parseInt(endChapterStr, 10)
  const startVerse = startVerseStr ? parseInt(startVerseStr, 10) : null
  const endVerse = endVerseStr ? parseInt(endVerseStr, 10) : null

  if (startBook !== endBook) {
    throw new Error('Multi-book range not supported in this version')
  }

  const results: string[] = []

  // Cas 1 : premier chapitre, partiel ou complet
  if (startVerse) {
    const lastVerse = getLastVerseInChapter(startBook, startChapter)
    results.push(
      `${startBook}.${startChapter}.${startVerse}-${startBook}.${startChapter}.${lastVerse}`
    )
  } else {
    results.push(`${startBook}.${startChapter}`)
  }

  // Cas 2 : chapitres intermédiaires entiers
  for (let c = startChapter + 1; c < endChapter; c++) {
    results.push(`${startBook}.${c}`)
  }

  // Cas 3 : dernier chapitre, partiel ou complet
  if (endChapter > startChapter) {
    if (endVerse) {
      results.push(`${startBook}.${endChapter}.1-${startBook}.${endChapter}.${endVerse}`)
    } else {
      results.push(`${startBook}.${endChapter}`)
    }
  }

  return results
}

export const parseResponse = (res: string) => {
  const str: string = bcv.parse(res).osis()

  const parsedArray = str
    .split(',')
    .map(s => {
      const [startRef, endRef] = s.split('-')

      if (!endRef) {
        return s
      }

      const [sb, sc] = startRef.split('.')
      const [eb, ec] = endRef.split('.')

      if (sb !== eb) {
        return undefined
      }

      if (sc !== ec) {
        return getIntermediateChapters(startRef, endRef)
      }

      return s
    })
    .filter((x): x is string => Boolean(x))
    .flat()
    .map(s => {
      const [startRef, endRef] = s.split('-')
      const [sb, sc, sv] = startRef.split('.')
      const ev = endRef?.split('.')[2]

      const sbNum = getBookNumber(sb)

      if (!sbNum || !sc) {
        return undefined
      }

      if (!sv) {
        return `${sbNum}_${sc}`
      }

      if (!ev) {
        return `${sbNum}_${sc}:${sv}`
      }

      return `${sbNum}_${sc}:${sv}-${ev}`
    })
    .join(',')

  return { original: str, parsed: parsedArray }
}
