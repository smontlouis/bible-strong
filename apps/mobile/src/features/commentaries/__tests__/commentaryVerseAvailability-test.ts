import type { Comment } from '../types'
import { buildCommentaryVerseAvailability } from '../commentaryVerseAvailability'

const comment = (code: string, verseId: string): Comment => ({
  id: `${code}-${verseId}`,
  sectionId: `${code}-section-${verseId}`,
  verseId,
  rangeStartVerse: Number(verseId.split('-').at(-1)),
  rangeEndVerse: Number(verseId.split('-').at(-1)),
  content: '<p>Commentary</p>',
  resource: { name: code, code, logo: '', author: code },
  order: 0,
  type: 'comment',
  isSDA: false,
})

describe('commentary verse availability', () => {
  it('distinguishes exact verse, chapter, empty and unavailable resources', () => {
    const result = buildCommentaryVerseAvailability({
      selectedProjectionIds: ['barnes:fr', 'acbc:fr', 'mhy-fr:fr', 'mhcc:en'],
      verseNumber: 1,
      commentsByVerse: {
        '1': [comment('barnes:fr', '41-1-1')],
        '2': [comment('acbc:fr', '41-1-2')],
      },
      unavailableResources: [
        { resourceId: 'mhcc', language: 'en', cause: 'offline-copy-required' },
      ],
    })

    expect(result.map(item => [item.projectionId, item.state])).toEqual([
      ['barnes:fr', 'verse'],
      ['acbc:fr', 'chapter'],
      ['mhy-fr:fr', 'no-content'],
      ['mhcc:en', 'unavailable'],
    ])
    expect(result.map(item => item.comment?.id ?? null)).toEqual([
      'barnes:fr-41-1-1',
      null,
      null,
      null,
    ])
  })
})
