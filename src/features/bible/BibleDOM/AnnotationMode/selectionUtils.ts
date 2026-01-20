'use dom'

import { Verse as TVerse } from '~common/types'
import { WordToken, getTokenByWordIndex } from '~helpers/wordTokenizer'

export interface WordPosition {
  verseKey: string
  wordIndex: number
}

export interface SelectionRange {
  start: WordPosition
  end: WordPosition
}

export interface AnnotationRangeData {
  verseKey: string
  startWordIndex: number
  endWordIndex: number
  text: string
}

/** Returns negative if a < b, 0 if equal, positive if a > b */
export const comparePositions = (a: WordPosition, b: WordPosition, verses: TVerse[]): number => {
  const aVerseIdx = verses.findIndex(v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === a.verseKey)
  const bVerseIdx = verses.findIndex(v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === b.verseKey)

  if (aVerseIdx !== bVerseIdx) {
    return aVerseIdx - bVerseIdx
  }
  return a.wordIndex - b.wordIndex
}

export const normalizeRange = (
  range: SelectionRange,
  verses: TVerse[]
): { start: WordPosition; end: WordPosition } => {
  if (comparePositions(range.start, range.end, verses) > 0) {
    return { start: range.end, end: range.start }
  }
  return { start: range.start, end: range.end }
}

export const getVersesBetween = (
  allVerses: TVerse[],
  startKey: string,
  endKey: string
): TVerse[] => {
  const startIdx = allVerses.findIndex(v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === startKey)
  const endIdx = allVerses.findIndex(v => `${v.Livre}-${v.Chapitre}-${v.Verset}` === endKey)

  if (startIdx === -1 || endIdx === -1) return []

  const minIdx = Math.min(startIdx, endIdx)
  const maxIdx = Math.max(startIdx, endIdx)

  return allVerses.slice(minIdx, maxIdx + 1)
}

export const buildRangesFromSelection = (
  selection: SelectionRange,
  verses: TVerse[],
  getTokens: (verseKey: string, text: string) => WordToken[]
): AnnotationRangeData[] => {
  const { start: normalizedStart, end: normalizedEnd } = normalizeRange(selection, verses)
  const selectedVerses = getVersesBetween(verses, normalizedStart.verseKey, normalizedEnd.verseKey)
  const ranges: AnnotationRangeData[] = []

  selectedVerses.forEach((verse, idx) => {
    if (verse.Verset === 0) return

    const verseKey = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`
    const tokens = getTokens(verseKey, verse.Texte)
    const wordTokens = tokens.filter(t => !t.isWhitespace)
    if (wordTokens.length === 0) return

    const isFirst = idx === 0
    const isLast = idx === selectedVerses.length - 1

    const startWordIdx = isFirst ? normalizedStart.wordIndex : 0
    const endWordIdx = isLast ? normalizedEnd.wordIndex : wordTokens[wordTokens.length - 1].index

    const startToken = getTokenByWordIndex(tokens, startWordIdx)
    const endToken = getTokenByWordIndex(tokens, endWordIdx)
    if (!startToken || !endToken) return

    const text = verse.Texte.substring(startToken.charStart, endToken.charEnd)

    ranges.push({
      verseKey,
      startWordIndex: startWordIdx,
      endWordIndex: endWordIdx,
      text,
    })
  })

  return ranges
}
