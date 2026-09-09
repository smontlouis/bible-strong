import {
  createBibleReferenceParser,
  type BibleReferenceParser,
} from '@bible-strong/bible-reference-parser/reference-parser'

import { getLanguage } from '../../i18n'
import { getSupportedOsisBookNumber, normalizeOsisReference } from './osisReference'

export type BcvLanguage = 'fr' | 'en'

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

const bcvByLanguage: Record<BcvLanguage, BibleReferenceParser> = {
  fr: createBibleReferenceParser('fr'),
  en: createBibleReferenceParser('en'),
}

const getBcvParser = (parserLanguage: BcvLanguage = getLanguage()) => bcvByLanguage[parserLanguage]

const getBookNumber = (book: string, _parserLanguage?: BcvLanguage): number | undefined =>
  getSupportedOsisBookNumber(book)

const parseOsisRef = (osisRef: string, parserLanguage?: BcvLanguage) => {
  const [book, chapterStr, verseStr] = osisRef.split('.')
  const bookNumber = getBookNumber(book, parserLanguage)
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

const getFocusVersesFromOsis = (osis: string, parserLanguage?: BcvLanguage) => {
  const focusVerses: number[] = []
  let commonBook: string | undefined
  let commonChapter: number | undefined

  for (const segment of osis.split(',')) {
    const [startRef, endRef] = segment.split('-')
    const start = parseOsisRef(startRef, parserLanguage)

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

    const end = parseOsisRef(endRef, parserLanguage)

    if (!end?.verse || end.book !== commonBook || end.chapter !== commonChapter) {
      return undefined
    }

    for (let verse = start.verse; verse <= end.verse; verse += 1) {
      focusVerses.push(verse)
    }
  }

  return [...new Set(focusVerses)]
}

export const osisToBibleReferenceTarget = (
  osis: string,
  parserLanguage?: BcvLanguage
): BibleReferenceTarget | undefined => {
  const normalizedOsis = normalizeOsisReference(osis)
  const firstSegment = normalizedOsis.split(',')[0]
  const firstRef = firstSegment.split('-')[0]
  const start = parseOsisRef(firstRef, parserLanguage)

  if (!start) {
    return undefined
  }

  return {
    book: start.bookNumber,
    chapter: start.chapter,
    verse: start.verse ?? 1,
    focusVerses: getFocusVersesFromOsis(normalizedOsis, parserLanguage),
    osis: normalizedOsis,
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

export const parseInlineBibleReferences = (
  text: string,
  parserLanguage?: BcvLanguage
): InlineBibleReference[] => {
  const references = getBcvParser(parserLanguage).parse(text).osis_and_indices() as OsisAndIndices[]

  const parsedReferences = references
    .map(({ osis, indices }) => {
      const [start, end] = indices
      const target = osisToBibleReferenceTarget(osis, parserLanguage)

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

const coversWholeInput = (text: string, references: InlineBibleReference[]): boolean => {
  if (!text || !references.length || references[0].start !== 0) return false
  let previousEnd = 0
  for (const reference of references) {
    if (!/^[,;\s]*$/u.test(text.slice(previousEnd, reference.start))) return false
    previousEnd = reference.end
  }
  return previousEnd === text.length
}

export const isExactBibleReferenceInput = (text: string, parserLanguage?: BcvLanguage): boolean => {
  const trimmed = text.trim()
  return coversWholeInput(trimmed, parseInlineBibleReferences(trimmed, parserLanguage))
}

export interface BibleReferenceSegment {
  book: number
  chapter: number
  startVerse: number
  endVerse: number
  isWholeChapter: boolean
}

const segmentsFromOsis = (osis: string, parserLanguage: BcvLanguage): BibleReferenceSegment[] =>
  osis.split(',').flatMap(segment => {
    const [startRef, endRef] = segment.split('-')
    const start = parseOsisRef(startRef)
    const end = endRef ? parseOsisRef(endRef) : start
    // Cross-book ranges have no supported reading surface yet.
    if (!start || !end || start.book !== end.book) return []
    const segments: BibleReferenceSegment[] = []
    for (let chapter = start.chapter; chapter <= end.chapter; chapter += 1) {
      const startVerse = chapter === start.chapter ? (start.verse ?? 1) : 1
      const endVerse =
        chapter === end.chapter && end.verse
          ? end.verse
          : getBcvParser(parserLanguage).lastVerse(start.book, chapter)
      if (!endVerse || startVerse > endVerse) continue
      segments.push({
        book: start.bookNumber,
        chapter,
        startVerse,
        endVerse,
        isWholeChapter:
          (chapter !== start.chapter || !start.verse) && (chapter !== end.chapter || !end.verse),
      })
    }
    return segments
  })

/** Parse once; all consumers use the same recognized text and chapter segments. */
export function parseBibleReferenceInput(
  text: string,
  parserLanguage: BcvLanguage = getLanguage()
) {
  const trimmed = text.trim()
  const references = parseInlineBibleReferences(trimmed, parserLanguage)
  return {
    references,
    isExact: coversWholeInput(trimmed, references),
    segments: references.flatMap(reference =>
      segmentsFromOsis(reference.target.osis, parserLanguage)
    ),
  }
}

export const parseBibleReferenceSegments = (text: string, parserLanguage?: BcvLanguage) =>
  parseBibleReferenceInput(text, parserLanguage).segments
