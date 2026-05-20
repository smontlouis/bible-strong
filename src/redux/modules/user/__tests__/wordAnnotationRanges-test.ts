import {
  annotationRangeOverlapsSelection,
  findOverlappingWordAnnotationIds,
  normalizeWordSelectionRange,
} from '../wordAnnotationRanges'
import type { WordAnnotation } from '../wordAnnotations'

const makeAnnotation = (
  id: string,
  version: WordAnnotation['version'],
  ranges: WordAnnotation['ranges']
): WordAnnotation => ({
  id,
  version,
  ranges,
  color: '#ff0000',
  type: 'background',
  date: 1,
})

describe('wordAnnotationRanges', () => {
  describe('normalizeWordSelectionRange', () => {
    it('keeps an ordered range as-is', () => {
      expect(
        normalizeWordSelectionRange(
          { verseKey: '1-1-1', wordIndex: 2 },
          { verseKey: '1-1-2', wordIndex: 1 }
        )
      ).toEqual({
        start: { verseKey: '1-1-1', wordIndex: 2 },
        end: { verseKey: '1-1-2', wordIndex: 1 },
      })
    })

    it('reverses a backwards range in the same verse', () => {
      expect(
        normalizeWordSelectionRange(
          { verseKey: '1-1-1', wordIndex: 5 },
          { verseKey: '1-1-1', wordIndex: 2 }
        )
      ).toEqual({
        start: { verseKey: '1-1-1', wordIndex: 2 },
        end: { verseKey: '1-1-1', wordIndex: 5 },
      })
    })
  })

  describe('annotationRangeOverlapsSelection', () => {
    it('detects overlap inside a single verse', () => {
      const selection = normalizeWordSelectionRange(
        { verseKey: '1-1-1', wordIndex: 2 },
        { verseKey: '1-1-1', wordIndex: 5 }
      )

      expect(
        annotationRangeOverlapsSelection(
          { verseKey: '1-1-1', startWordIndex: 4, endWordIndex: 8, text: 'text' },
          selection
        )
      ).toBe(true)
    })

    it('ignores ranges outside a single verse selection', () => {
      const selection = normalizeWordSelectionRange(
        { verseKey: '1-1-1', wordIndex: 2 },
        { verseKey: '1-1-1', wordIndex: 5 }
      )

      expect(
        annotationRangeOverlapsSelection(
          { verseKey: '1-1-1', startWordIndex: 6, endWordIndex: 8, text: 'text' },
          selection
        )
      ).toBe(false)
    })

    it('detects a whole middle verse in a multi-verse selection', () => {
      const selection = normalizeWordSelectionRange(
        { verseKey: '1-1-1', wordIndex: 6 },
        { verseKey: '1-1-3', wordIndex: 2 }
      )

      expect(
        annotationRangeOverlapsSelection(
          { verseKey: '1-1-2', startWordIndex: 0, endWordIndex: 10, text: 'text' },
          selection
        )
      ).toBe(true)
    })
  })

  describe('findOverlappingWordAnnotationIds', () => {
    it('returns only ids matching the version and overlapping the selection', () => {
      const selection = normalizeWordSelectionRange(
        { verseKey: '1-1-1', wordIndex: 2 },
        { verseKey: '1-1-2', wordIndex: 4 }
      )

      const annotations = {
        overlapping: makeAnnotation('overlapping', 'LSG', [
          { verseKey: '1-1-2', startWordIndex: 1, endWordIndex: 2, text: 'text' },
        ]),
        otherVersion: makeAnnotation('otherVersion', 'KJV', [
          { verseKey: '1-1-2', startWordIndex: 1, endWordIndex: 2, text: 'text' },
        ]),
        outside: makeAnnotation('outside', 'LSG', [
          { verseKey: '1-1-3', startWordIndex: 1, endWordIndex: 2, text: 'text' },
        ]),
      }

      expect(findOverlappingWordAnnotationIds(annotations, 'LSG', selection)).toEqual([
        'overlapping',
      ])
    })
  })
})
