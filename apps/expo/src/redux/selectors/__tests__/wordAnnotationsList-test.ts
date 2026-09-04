import {
  buildGroupedWordAnnotations,
  getAnnotationGroupVerseKey,
} from '~features/entityListQuery/wordAnnotationsQuery'
import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'

describe('buildGroupedWordAnnotations', () => {
  it('does not truncate collections over 100 items and retains every range', () => {
    const annotations = Object.fromEntries(
      Array.from({ length: 125 }, (_, index) => [
        `annotation-${index}`,
        {
          id: `annotation-${index}`,
          version: 'LSG',
          ranges: [
            { verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 0, text: 'Début' },
            { verseKey: '40-1-1', startWordIndex: 0, endWordIndex: 0, text: 'Suite' },
          ],
          color: 'color1',
          type: 'background' as const,
          date: index,
        },
      ])
    ) as WordAnnotationsObj

    const result = buildGroupedWordAnnotations(annotations)

    expect(result).toHaveLength(125)
    expect(result[0].verseKeys).toEqual(['1-1-1', '40-1-1'])
  })

  it('groups a multi-range annotation under the range matching the active Bible scope', () => {
    const annotation = {
      ranges: [
        { verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 0, text: 'Début' },
        { verseKey: '40-1-1', startWordIndex: 0, endWordIndex: 0, text: 'Suite' },
      ],
    }

    expect(getAnnotationGroupVerseKey(annotation, { book: 40, testament: 'new' })).toBe('40-1-1')
    expect(getAnnotationGroupVerseKey(annotation, { book: null, testament: 'old' })).toBe('1-1-1')
  })
})
