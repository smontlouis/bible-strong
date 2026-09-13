import {
  placeInlineCommentaries,
  summarizeInlineCommentaryChip,
} from '../inlineCommentaryPlacement'
import type { ReadingIndex } from '~features/resources/commentaryReadingAccess'
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
