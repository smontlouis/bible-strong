import type { AnnotationRange, WordAnnotation, WordAnnotationsObj } from './wordAnnotations'

export interface WordPosition {
  verseKey: string
  wordIndex: number
}

export interface NormalizedWordSelectionRange {
  start: WordPosition
  end: WordPosition
}

export const parseVerseKey = (key: string) => {
  const [book, chapter, verse] = key.split('-').map(Number)
  return { book, chapter, verse }
}

export const compareVerseKeys = (a: string, b: string): number => {
  const pa = parseVerseKey(a)
  const pb = parseVerseKey(b)
  if (pa.book !== pb.book) return pa.book - pb.book
  if (pa.chapter !== pb.chapter) return pa.chapter - pb.chapter
  return pa.verse - pb.verse
}

export const normalizeWordSelectionRange = (
  start: WordPosition,
  end: WordPosition
): NormalizedWordSelectionRange => {
  const verseCompare = compareVerseKeys(start.verseKey, end.verseKey)
  if (verseCompare > 0 || (verseCompare === 0 && start.wordIndex > end.wordIndex)) {
    return { start: end, end: start }
  }
  return { start, end }
}

export const annotationRangeOverlapsSelection = (
  range: AnnotationRange,
  selection: NormalizedWordSelectionRange
): boolean => {
  const rangeVerseCompareStart = compareVerseKeys(range.verseKey, selection.start.verseKey)
  const rangeVerseCompareEnd = compareVerseKeys(range.verseKey, selection.end.verseKey)

  if (rangeVerseCompareStart < 0 || rangeVerseCompareEnd > 0) {
    return false
  }

  if (rangeVerseCompareStart === 0 && rangeVerseCompareEnd === 0) {
    return (
      range.endWordIndex >= selection.start.wordIndex &&
      range.startWordIndex <= selection.end.wordIndex
    )
  }

  if (rangeVerseCompareStart === 0) {
    return range.endWordIndex >= selection.start.wordIndex
  }

  if (rangeVerseCompareEnd === 0) {
    return range.startWordIndex <= selection.end.wordIndex
  }

  return true
}

export const wordAnnotationOverlapsSelection = (
  annotation: WordAnnotation,
  selection: NormalizedWordSelectionRange
): boolean => annotation.ranges.some(range => annotationRangeOverlapsSelection(range, selection))

export const getSelectionRangeFromAnnotation = (
  annotation: WordAnnotation
): NormalizedWordSelectionRange | null => {
  const firstRange = annotation.ranges[0]
  const lastRange = annotation.ranges[annotation.ranges.length - 1]

  if (!firstRange || !lastRange) return null

  return normalizeWordSelectionRange(
    { verseKey: firstRange.verseKey, wordIndex: firstRange.startWordIndex },
    { verseKey: lastRange.verseKey, wordIndex: lastRange.endWordIndex }
  )
}

export const findOverlappingWordAnnotationIds = (
  wordAnnotations: WordAnnotationsObj,
  version: string,
  selection: NormalizedWordSelectionRange
): string[] => {
  const idsToRemove: string[] = []

  for (const id of Object.keys(wordAnnotations)) {
    const annotation = wordAnnotations[id]
    if (annotation.version !== version) continue

    if (wordAnnotationOverlapsSelection(annotation, selection)) {
      idsToRemove.push(id)
    }
  }

  return idsToRemove
}
