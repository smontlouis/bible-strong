import type { Verse } from '~common/types'
import verseToReference from '~helpers/verseToReference'
import { getTokenByWordIndex, tokenizeVerseText } from '~helpers/wordTokenizer'
import type { AnnotationType, SelectionRange } from './hooks/annotationSession'

/** The words of one verse that the reader selected or annotated, counted in words and in characters. */
export type AnnotatedWordRange = {
  verseKey: string
  startWordIndex: number
  endWordIndex: number
  /** Offsets in the verse text, the end excluded: where the words' Strong entries are found. */
  charStart: number
  charEnd: number
  text: string
}

type WordIndexRange = Pick<AnnotatedWordRange, 'verseKey' | 'startWordIndex' | 'endWordIndex'>

const getVerseKey = (verse: Verse) => `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`

const toWordRange = (range: WordIndexRange, verse: Verse): AnnotatedWordRange | undefined => {
  const tokens = tokenizeVerseText(verse.Texte)
  const start = getTokenByWordIndex(tokens, range.startWordIndex)
  const end = getTokenByWordIndex(tokens, range.endWordIndex)
  if (!start || !end) return undefined
  return {
    ...range,
    charStart: start.charStart,
    charEnd: end.charEnd,
    text: verse.Texte.slice(start.charStart, end.charEnd),
  }
}

/**
 * The words between the two ends of a selection, verse by verse, as an annotation of them would
 * hold them: the ends may come in either order, and verse 0 (a title) holds none.
 */
export const getSelectionWordRanges = (
  selection: SelectionRange,
  verses: readonly Verse[]
): AnnotatedWordRange[] => {
  const startIndex = verses.findIndex(verse => getVerseKey(verse) === selection.start.verseKey)
  const endIndex = verses.findIndex(verse => getVerseKey(verse) === selection.end.verseKey)
  if (startIndex === -1 || endIndex === -1) return []

  const isReversed =
    startIndex > endIndex ||
    (startIndex === endIndex && selection.start.wordIndex > selection.end.wordIndex)
  const [first, last] = isReversed
    ? [selection.end, selection.start]
    : [selection.start, selection.end]
  const covered = verses.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1)

  return covered.flatMap((verse, index) => {
    if (verse.Verset === 0) return []
    const wordCount = tokenizeVerseText(verse.Texte).filter(token => !token.isWhitespace).length
    if (wordCount === 0) return []
    const range = toWordRange(
      {
        verseKey: getVerseKey(verse),
        startWordIndex: index === 0 ? first.wordIndex : 0,
        endWordIndex: index === covered.length - 1 ? last.wordIndex : wordCount - 1,
      },
      verse
    )
    return range ? [range] : []
  })
}

/** The words an annotation holds, found again in the verses on screen. */
export const getAnnotationWordRanges = (
  ranges: readonly WordIndexRange[],
  verses: readonly Verse[]
): AnnotatedWordRange[] =>
  ranges.flatMap(range => {
    const verse = verses.find(candidate => getVerseKey(candidate) === range.verseKey)
    const wordRange = verse && toWordRange(range, verse)
    return wordRange ? [wordRange] : []
  })

/** The verses the words belong to, in reading order. */
export const getWordRangesVerseKeys = (ranges: readonly AnnotatedWordRange[]): string[] => [
  ...new Set(ranges.map(range => range.verseKey)),
]

/** The words themselves, verse after verse. */
export const getWordRangesText = (ranges: readonly AnnotatedWordRange[]): string =>
  ranges.map(range => range.text.trim()).join(' ')

/**
 * The words as they are copied or shared: quoted, without the commas or colons the selection took
 * from around them, followed by where they are read.
 */
export const formatWordsQuote = (
  ranges: readonly AnnotatedWordRange[],
  version: string,
  quote: (text: string) => string
): string => {
  const reference = verseToReference(getWordRangesVerseKeys(ranges))
  const text = getWordRangesText(ranges).replace(/^[\s,;:]+|[\s,;:]+$/gu, '')
  return `${quote(text)}\n${reference} (${version})`
}

/** The color and type of the latest annotation, which annotate words when no mark is chosen. */
export const getLastAnnotationMark = (
  annotations: Readonly<Record<string, { color: string; type: AnnotationType; date: number }>>
): { color: string; type: AnnotationType } => {
  let last: { color: string; type: AnnotationType; date: number } | undefined
  for (const annotation of Object.values(annotations)) {
    if (!last || annotation.date > last.date) last = annotation
  }
  return last ? { color: last.color, type: last.type } : { color: 'color1', type: 'background' }
}
