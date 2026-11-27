import type { Comment } from '../types'
import {
  buildCommentaryVerseAvailability,
  buildReaderCommentaryVerseAvailability,
  getCommentaryChaptersForVerse,
} from '../commentaryVerseAvailability'

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

  it('keeps why a resource is unavailable so offline rows can ask for a download', () => {
    const result = buildCommentaryVerseAvailability({
      selectedProjectionIds: ['barnes:fr', 'acbc:fr', 'mhcc:en'],
      verseNumber: 1,
      commentsByVerse: {},
      unavailableResources: [
        { resourceId: 'barnes', language: 'fr', cause: 'offline-copy-required' },
        { resourceId: 'acbc', language: 'fr', cause: 'invalid-offline-copy' },
        { resourceId: 'mhcc', language: 'en', cause: 'temporary-unavailable' },
      ],
    })

    expect(result.map(item => [item.projectionId, item.state, item.unavailableCause])).toEqual([
      ['barnes:fr', 'unavailable', 'offline-copy-required'],
      ['acbc:fr', 'unavailable', 'invalid-offline-copy'],
      ['mhcc:en', 'unavailable', 'temporary-unavailable'],
    ])
  })
})

describe('commentary availability in the reader numbering', () => {
  const selectedProjectionIds = ['barnes:fr', 'mhy-fr:fr']
  const elijah = { ...comment('barnes:fr', '39-4-5'), rangeEndVerse: 6 }

  it('reads each commentary at its own verse: LSG Malachi 3:23 is KJV Malachi 4:5', () => {
    expect(
      getCommentaryChaptersForVerse({ selectedProjectionIds, verse: '39-3-23', version: 'LSG' })
    ).toEqual([
      { chapter: 3, items: [expect.objectContaining({ projectionId: 'mhy-fr:fr' })] },
      { chapter: 4, items: [expect.objectContaining({ projectionId: 'barnes:fr' })] },
    ])
    const result = buildReaderCommentaryVerseAvailability({
      selectedProjectionIds,
      verse: '39-3-23',
      version: 'LSG',
      chapters: [
        { chapter: 3, commentsByVerse: {}, unavailableResources: [] },
        { chapter: 4, commentsByVerse: { '5': [elijah] }, unavailableResources: [] },
      ],
    })
    expect(result.map(item => [item.projectionId, item.state, item.location])).toEqual([
      ['barnes:fr', 'verse', { book: 39, chapter: 4, verse: 5 }],
      ['mhy-fr:fr', 'no-content', { book: 39, chapter: 3, verse: 23 }],
    ])
    expect(result[0].passageRange).toEqual({ rangeStartVerse: 23, rangeEndVerse: 24 })
  })

  it('keeps the verse of a KJV reader and of an unknown numbering', () => {
    for (const version of ['KJV', undefined]) {
      expect(
        getCommentaryChaptersForVerse({ selectedProjectionIds, verse: '39-4-5', version })
      ).toEqual([{ chapter: 4, items: expect.any(Array) }])
      const [barnes] = buildReaderCommentaryVerseAvailability({
        selectedProjectionIds,
        verse: '39-4-5',
        version,
        chapters: [{ chapter: 4, commentsByVerse: { '5': [elijah] }, unavailableResources: [] }],
      })
      expect(barnes).toMatchObject({
        state: 'verse',
        location: { book: 39, chapter: 4, verse: 5 },
        passageRange: { rangeStartVerse: 5, rangeEndVerse: 6 },
      })
    }
  })
})
