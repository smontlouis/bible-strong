import {
  bibleVerseInResource,
  commentaryResourceKey,
  entitiesInReaderChapter,
  groupByResourceChapter,
  loadReaderChapterEntities,
  resourceChaptersForReaderChapter,
  resourcePassageInBible,
  resourceRangeInReaderChapter,
} from '../resourceNumbering'

const MALACHI = 39
const PSALMS = 19
const JOEL = 29
const BARNES = 'commentary:barnes'
const lsg = (book: number, chapter: number) => ({ version: 'LSG', book, chapter })

describe('resource chapters of a reader chapter', () => {
  it('reads LSG Malachi 3 in KJV Malachi 3 and 4', () => {
    expect(resourceChaptersForReaderChapter(lsg(MALACHI, 3), BARNES)).toEqual([3, 4])
  })

  it('reads LSG Joel 3 in KJV Joel 2 and LSG Joel 4 in KJV Joel 3', () => {
    expect(resourceChaptersForReaderChapter(lsg(JOEL, 3), BARNES)).toEqual([2])
    expect(resourceChaptersForReaderChapter(lsg(JOEL, 4), BARNES)).toEqual([3])
  })

  it('keeps the chapter when the numbering is the same or unknown', () => {
    expect(
      resourceChaptersForReaderChapter({ ...lsg(MALACHI, 3), version: 'KJV' }, BARNES)
    ).toEqual([3])
    expect(
      resourceChaptersForReaderChapter({ ...lsg(MALACHI, 3), version: 'UNKNOWN' }, BARNES)
    ).toEqual([3])
    expect(resourceChaptersForReaderChapter(lsg(MALACHI, 3), 'commentary:MHY')).toEqual([3])
  })

  it('groups the items that need the same chapter', () => {
    const items = ['barnes', 'rashi-en', 'MHY']
    expect(groupByResourceChapter(lsg(MALACHI, 3), items, item => `commentary:${item}`)).toEqual([
      { chapter: 3, items: ['barnes', 'rashi-en', 'MHY'] },
      { chapter: 4, items: ['barnes'] },
    ])
  })
})

describe('resource ranges in the reader chapter', () => {
  it('places KJV Malachi 4:5-6 at LSG Malachi 3:23-24', () => {
    expect(resourceRangeInReaderChapter(lsg(MALACHI, 3), BARNES, 4, { start: 5, end: 6 })).toEqual({
      start: 23,
      end: 24,
    })
  })

  it('places KJV Psalm 51:1-4, whose verse 1 holds the title, at LSG Psalm 51:1-6', () => {
    expect(resourceRangeInReaderChapter(lsg(PSALMS, 51), BARNES, 51, { start: 1, end: 4 })).toEqual(
      { start: 1, end: 6 }
    )
  })

  it('clips a range to the reader chapter and drops one outside it', () => {
    expect(resourceRangeInReaderChapter(lsg(JOEL, 3), BARNES, 2, { start: 20, end: 32 })).toEqual({
      start: 1,
      end: 5,
    })
    expect(
      resourceRangeInReaderChapter(lsg(JOEL, 3), BARNES, 2, { start: 1, end: 27 })
    ).toBeUndefined()
  })

  it('keeps the range of the same chapter when nothing is converted', () => {
    const kjv = { ...lsg(MALACHI, 4), version: 'KJV' }
    expect(resourceRangeInReaderChapter(kjv, BARNES, 4, { start: 5, end: 6 })).toEqual({
      start: 5,
      end: 6,
    })
    expect(resourceRangeInReaderChapter(kjv, BARNES, 3, { start: 5, end: 6 })).toBeUndefined()
  })
})

describe('verses between a Bible and a commentary', () => {
  it('keys a commentary by its publication id', () => {
    expect(commentaryResourceKey('barnes')).toBe('commentary:barnes')
    expect(commentaryResourceKey('mhy-fr')).toBe('commentary:MHY')
  })

  it('reads LSG Malachi 3:23 at KJV Malachi 4:5, and keeps unknown numberings', () => {
    expect(bibleVerseInResource('39-3-23', 'LSG', BARNES)).toBe('39-4-5')
    expect(bibleVerseInResource('39-3-23', 'KJV', BARNES)).toBe('39-3-23')
    expect(bibleVerseInResource('39-3-23', undefined, BARNES)).toBe('39-3-23')
  })

  it('opens a KJV passage at the LSG verses that stand for it', () => {
    expect(
      resourcePassageInBible(
        { book: MALACHI, chapter: 4, startVerse: 5, endVerse: 6 },
        BARNES,
        'LSG'
      )
    ).toEqual({ book: MALACHI, chapter: 3, startVerse: 23, endVerse: 24 })
    // The title is left out of the opening verse.
    expect(
      resourcePassageInBible(
        { book: PSALMS, chapter: 51, startVerse: 1, endVerse: 4 },
        BARNES,
        'LSG'
      )
    ).toEqual({ book: PSALMS, chapter: 51, startVerse: 3, endVerse: 6 })
    const kjv = { book: MALACHI, chapter: 4, startVerse: 5, endVerse: 6 }
    expect(resourcePassageInBible(kjv, BARNES, 'KJV')).toBe(kjv)
    expect(resourcePassageInBible(kjv, undefined, 'LSG')).toBe(kjv)
  })
})

describe('entities in the reader chapter', () => {
  const entity = (uniqueName: string, category: string, verses: number[]) => ({
    uniqueName,
    name: uniqueName,
    category,
    type: '',
    verses,
  })

  it('shows Elijah of KJV Malachi 4:5 at LSG Malachi 3:23', async () => {
    const load = jest.fn(async (chapter: number) =>
      chapter === 3
        ? [entity('Levi', 'person', [3]), entity('Jerusalem', 'place', [4])]
        : [entity('Elijah', 'person', [5]), entity('Horeb', 'place', [4])]
    )
    const entities = await loadReaderChapterEntities(lsg(MALACHI, 3), load)
    expect(load.mock.calls.map(([chapter]) => chapter)).toEqual([3, 4])
    expect(entities.map(item => [item.uniqueName, item.verses])).toEqual([
      ['Elijah', [23]],
      ['Levi', [3]],
      ['Horeb', [22]],
      ['Jerusalem', [4]],
    ])
  })

  it('shows the people of KJV Psalm 51:1 on the LSG title and first verse', () => {
    expect(
      entitiesInReaderChapter(lsg(PSALMS, 51), [
        { chapter: 51, entities: [entity('David', 'person', [1]), entity('Zion', 'place', [18])] },
      ]).map(item => [item.uniqueName, item.verses])
    ).toEqual([
      ['David', [1, 2, 3]],
      ['Zion', [20]],
    ])
  })

  it('drops entities whose verses fall in another reader chapter, keeps Strong matches', () => {
    expect(
      entitiesInReaderChapter(lsg(JOEL, 3), [
        {
          chapter: 2,
          entities: [
            entity('Zion', 'place', [1, 32]),
            entity('Egypt', 'place', [20]),
            entity('Strong match', 'person', []),
          ],
        },
      ]).map(item => [item.uniqueName, item.verses])
    ).toEqual([
      ['Zion', [5]],
      ['Strong match', []],
    ])
  })

  it('returns the chapter as it came when nothing is converted', () => {
    const entities = [entity('Elijah', 'person', [5])]
    expect(
      entitiesInReaderChapter({ ...lsg(MALACHI, 4), version: 'KJV' }, [{ chapter: 4, entities }])
    ).toEqual(entities)
  })
})
