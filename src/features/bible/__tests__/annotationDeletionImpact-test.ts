import type { WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import {
  getSelectionAnnotationDeletionImpact,
  requiresSelectionAnnotationDeletionConfirmation,
} from '../annotationDeletionImpact'

const wordAnnotations: WordAnnotationsObj = {
  note: {
    id: 'note',
    version: 'LSG',
    ranges: [{ verseKey: '1-1-1', startWordIndex: 1, endWordIndex: 2, text: 'note' }],
    color: '#fff',
    type: 'background',
    date: 1,
    noteId: 'annotation:note',
  },
  tags: {
    id: 'tags',
    version: 'LSG',
    ranges: [{ verseKey: '1-1-2', startWordIndex: 0, endWordIndex: 1, text: 'tags' }],
    color: '#fff',
    type: 'underline',
    date: 2,
    tags: { faith: { id: 'faith', name: 'Foi' } },
  },
  relation: {
    id: 'relation',
    version: 'LSG',
    ranges: [{ verseKey: '1-1-3', startWordIndex: 4, endWordIndex: 5, text: 'relation' }],
    color: '#fff',
    type: 'circle',
    date: 3,
  },
  empty: {
    id: 'empty',
    version: 'LSG',
    ranges: [{ verseKey: '1-1-4', startWordIndex: 2, endWordIndex: 3, text: 'empty' }],
    color: '#fff',
    type: 'background',
    date: 4,
  },
  otherVersion: {
    id: 'otherVersion',
    version: 'S21',
    ranges: [{ verseKey: '1-1-2', startWordIndex: 0, endWordIndex: 1, text: 'other' }],
    color: '#fff',
    type: 'background',
    date: 5,
    noteId: 'annotation:otherVersion',
  },
}

describe('getSelectionAnnotationDeletionImpact', () => {
  it('aggregates metadata from all overlapping annotations in the selected version', () => {
    expect(
      getSelectionAnnotationDeletionImpact({
        wordAnnotations,
        version: 'LSG',
        start: { verseKey: '1-1-1', wordIndex: 2 },
        end: { verseKey: '1-1-3', wordIndex: 4 },
        relationCountsByEndpointIdentity: { 'annotation:relation': 1 },
      })
    ).toEqual({
      annotationCount: 3,
      hasNote: true,
      hasTags: true,
      hasRelations: true,
    })
  })

  it('ignores annotations outside the selection', () => {
    expect(
      getSelectionAnnotationDeletionImpact({
        wordAnnotations,
        version: 'LSG',
        start: { verseKey: '1-1-1', wordIndex: 3 },
        end: { verseKey: '1-1-1', wordIndex: 4 },
        relationCountsByEndpointIdentity: { 'annotation:relation': 1 },
      })
    ).toEqual({
      annotationCount: 0,
      hasNote: false,
      hasTags: false,
      hasRelations: false,
    })
  })

  it('normalizes a backwards selection before finding overlaps', () => {
    expect(
      getSelectionAnnotationDeletionImpact({
        wordAnnotations,
        version: 'LSG',
        start: { verseKey: '1-1-2', wordIndex: 1 },
        end: { verseKey: '1-1-2', wordIndex: 0 },
        relationCountsByEndpointIdentity: {},
      })
    ).toEqual({
      annotationCount: 1,
      hasNote: false,
      hasTags: true,
      hasRelations: false,
    })
  })

  it('reports an overlapping annotation even when it has no associated items', () => {
    const impact = getSelectionAnnotationDeletionImpact({
      wordAnnotations,
      version: 'LSG',
      start: { verseKey: '1-1-4', wordIndex: 2 },
      end: { verseKey: '1-1-4', wordIndex: 3 },
      relationCountsByEndpointIdentity: {},
    })

    expect(impact).toEqual({
      annotationCount: 1,
      hasNote: false,
      hasTags: false,
      hasRelations: false,
    })
    expect(requiresSelectionAnnotationDeletionConfirmation(impact)).toBe(true)
  })
})
