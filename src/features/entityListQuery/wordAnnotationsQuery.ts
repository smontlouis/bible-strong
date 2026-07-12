import type { WordAnnotation } from '~redux/modules/user/wordAnnotations'

export type GroupedWordAnnotationRow = {
  id: string
  date: number
  color: string
  type: 'background' | 'underline' | 'circle'
  version: string
  text: string
  verseKey: string
  verseKeys: string[]
  tags?: WordAnnotation['tags']
}

export const buildGroupedWordAnnotations = (
  wordAnnotations: Record<string, WordAnnotation>
): GroupedWordAnnotationRow[] =>
  Object.entries(wordAnnotations)
    .map(([id, annotation]) => ({
      id,
      date: annotation.date,
      color: annotation.color,
      type: annotation.type,
      version: annotation.version,
      text: annotation.ranges[0]?.text || '',
      verseKey: annotation.ranges[0]?.verseKey || '',
      verseKeys: annotation.ranges.map(range => range.verseKey),
      tags: annotation.tags,
    }))
    .sort((a, b) => b.date - a.date || a.id.localeCompare(b.id))

const compareVerseKeys = (left: string, right: string) => {
  const leftParts = left.split('-').map(Number)
  const rightParts = right.split('-').map(Number)
  return (
    leftParts[0] - rightParts[0] || leftParts[1] - rightParts[1] || leftParts[2] - rightParts[2]
  )
}

export const getAnnotationGroupVerseKey = (
  annotation: Pick<WordAnnotation, 'ranges'>,
  scope: { book: number | null; testament: 'all' | 'old' | 'new' }
): string | undefined =>
  annotation.ranges
    .map(range => range.verseKey)
    .filter(verseKey => {
      const book = Number(verseKey.split('-')[0])
      if (scope.book) return book === scope.book
      if (scope.testament === 'old') return book <= 39
      if (scope.testament === 'new') return book >= 40
      return true
    })
    .sort(compareVerseKeys)[0]
