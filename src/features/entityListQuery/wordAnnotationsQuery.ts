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
