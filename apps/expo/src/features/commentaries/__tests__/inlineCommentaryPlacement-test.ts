import {
  loadReaderInlineCommentaries,
  placeInlineCommentaries,
  readerInlineCommentaryIndexes,
  summarizeInlineCommentaryChip,
} from '../inlineCommentaryPlacement'
import type { ReadingIndex, ReadingIndexRequest } from '~features/resources/commentaryReadingAccess'
const index: ReadingIndex = {
  resource: { kind: 'commentary', resourceId: 'barnes', language: 'fr', revision: 'r1' },
  sections: [
    { id: 'intro', rangeStartVerse: 0, rangeEndVerse: 0, excerpt: 'Introduction' },
    { id: 'range', rangeStartVerse: 1, rangeEndVerse: 5, excerpt: 'Range' },
    { id: 'outside', rangeStartVerse: 8, rangeEndVerse: 9, excerpt: 'Outside' },
  ],
}
it('shows one chip after a full range and the introduction before the chapter', () => {
  const result = placeInlineCommentaries([index], [1, 2, 3, 4, 5], false)
  expect(result.introduction.map(chip => chip.sectionId)).toEqual(['intro'])
  expect(Object.keys(result.afterVerses)).toEqual(['5'])
  expect(result.afterVerses[5][0]).toMatchObject({ sectionId: 'range', revision: 'r1' })
})
it('clips to the focused passage and omits unrelated sections and introduction', () => {
  const result = placeInlineCommentaries([index], [2, 3], true)
  expect(result.introduction).toEqual([])
  expect(Object.keys(result.afterVerses)).toEqual(['3'])
  expect(result.afterVerses[3]).toHaveLength(1)
})

it('preserves coverage through verse 176 without a chapter-wide section cap', () => {
  const verses = Array.from({ length: 176 }, (_, i) => i + 1)
  const longChapter: ReadingIndex = {
    resource: { ...index.resource, resourceId: 'bible-annotee' },
    sections: verses.map(verse => ({
      id: `verse-${verse}`,
      rangeStartVerse: verse,
      rangeEndVerse: verse,
      excerpt: `Preview ${verse}`,
    })),
  }
  const result = placeInlineCommentaries([longChapter], verses, false)
  expect(Object.keys(result.afterVerses).map(Number)).toEqual(verses)
  expect(result.afterVerses[176][0].sections[0].sectionId).toBe('verse-176')
  const focused = placeInlineCommentaries([longChapter], [174, 175, 176], true)
  expect(Object.keys(focused.afterVerses).map(Number)).toEqual([174, 175, 176])
})

it('keeps a dense resource to one chip per anchor while retaining every section and language', () => {
  const dense: ReadingIndex = {
    resource: { ...index.resource, resourceId: 'egw-writings', language: 'en' },
    sections: Array.from({ length: 1238 }, (_, i) => ({
      id: `section-${i}`,
      rangeStartVerse: 1,
      rangeEndVerse: 3,
      excerpt: `Preview ${i}`,
    })),
  }
  const result = placeInlineCommentaries(
    [dense, { ...dense, resource: { ...dense.resource, language: 'fr' } }],
    [1, 2, 3],
    false
  )
  expect(result.afterVerses[3]).toHaveLength(2)
  expect(result.afterVerses[3][0].sections).toHaveLength(1238)
  expect(new Set(result.afterVerses[3][0].sections.map(section => section.sectionId)).size).toBe(
    1238
  )
  expect(result.afterVerses[3][1].language).toBe('fr')
  const summary = summarizeInlineCommentaryChip(result.afterVerses[3][0])
  expect(summary.sectionCount).toBe(1238)
  expect(summary).not.toHaveProperty('sections')
  expect(JSON.stringify(summary).length).toBeLessThan(500)
})

describe('inline commentaries in the reader numbering', () => {
  const barnes = (chapter: number, sections: ReadingIndex['sections']): ReadingIndex => ({
    resource: { kind: 'commentary', resourceId: 'barnes', language: 'en', revision: 'b1' },
    sections: sections.map(section => ({ ...section, id: `${chapter}-${section.id}` })),
  })
  const section = (id: string, rangeStartVerse: number, rangeEndVerse: number) => ({
    id,
    rangeStartVerse,
    rangeEndVerse,
    excerpt: id,
  })
  const malachi = (chapter: number) =>
    barnes(chapter, [section('intro', 0, 0), section('first', 1, 1), section('elijah', 5, 6)])
  const loadIndex = jest.fn(async (request: ReadingIndexRequest) => ({
    indexes: request.resources.some(resource => resource.resourceId === 'barnes')
      ? [malachi(request.chapter)]
      : [],
    unavailable: [],
    cached: false,
  }))
  const verses = (count: number) => Array.from({ length: count }, (_, index) => index + 1)

  beforeEach(() => loadIndex.mockClear())

  it('places KJV Malachi 4:5-6 after LSG Malachi 3:24, read in its own chapter', async () => {
    const reader = { version: 'LSG', book: 39, chapter: 3 }
    const { indexes } = await loadReaderInlineCommentaries(
      reader,
      [
        { resourceId: 'barnes', language: 'en' },
        { resourceId: 'MHY', language: 'fr' },
      ],
      loadIndex
    )
    expect(loadIndex.mock.calls.map(([request]) => [request.chapter, request.resources])).toEqual([
      [
        3,
        [
          { resourceId: 'barnes', language: 'en' },
          { resourceId: 'MHY', language: 'fr' },
        ],
      ],
      [4, [{ resourceId: 'barnes', language: 'en' }]],
    ])
    const result = placeInlineCommentaries(indexes, verses(24), false)
    // The introduction of KJV Malachi 4 does not introduce LSG Malachi 3.
    expect(result.introduction.map(chip => chip.sectionId)).toEqual(['3-intro'])
    expect(result.afterVerses[23]).toBeUndefined()
    expect(result.afterVerses[24]).toEqual([
      expect.objectContaining({
        sectionId: '4-elijah',
        chapter: 4,
        rangeStartVerse: 23,
        rangeEndVerse: 24,
      }),
    ])
    expect(result.afterVerses[19]).toEqual([
      expect.objectContaining({ sectionId: '4-first', chapter: 4 }),
    ])
    expect(result.afterVerses[6]).toEqual([
      expect.objectContaining({ sectionId: '3-elijah', chapter: 3, rangeStartVerse: 5 }),
    ])
  })

  it('places KJV Psalm 51:1-4, whose verse 1 holds the title, over LSG Psalm 51:1-6', () => {
    const indexes = readerInlineCommentaryIndexes({ version: 'LSG', book: 19, chapter: 51 }, [
      { chapter: 51, index: barnes(51, [section('intro', 0, 0), section('prayer', 1, 4)]) },
    ])
    const result = placeInlineCommentaries(indexes, verses(21), false)
    expect(result.introduction.map(chip => chip.sectionId)).toEqual(['51-intro'])
    expect(result.afterVerses[6]).toEqual([
      expect.objectContaining({ sectionId: '51-prayer', rangeStartVerse: 1, rangeEndVerse: 6 }),
    ])
  })

  it('keeps the commentary numbers for a KJV reader or an unknown numbering', async () => {
    for (const version of ['KJV', 'UNKNOWN']) {
      loadIndex.mockClear()
      const { indexes } = await loadReaderInlineCommentaries(
        { version, book: 39, chapter: 4 },
        [{ resourceId: 'barnes', language: 'en' }],
        loadIndex
      )
      expect(loadIndex).toHaveBeenCalledTimes(1)
      expect(indexes).toEqual([{ ...malachi(4), chapter: 4, resource: malachi(4).resource }])
      expect(placeInlineCommentaries(indexes, verses(6), false).afterVerses[6]).toEqual([
        expect.objectContaining({ sectionId: '4-elijah', rangeStartVerse: 5, rangeEndVerse: 6 }),
      ])
    }
  })
})
