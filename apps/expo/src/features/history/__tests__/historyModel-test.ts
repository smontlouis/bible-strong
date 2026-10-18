import {
  addHistoryItem,
  getHistoryDayLabel,
  groupHistoryByDay,
  HISTORY_SCHEMA_VERSION,
  matchesHistoryFilter,
  MAX_HISTORY_ITEMS_PER_TYPE,
  migrateHistoryItems,
  removeHistoryItem,
  type HistoryItem,
  type HistoryItemInput,
} from '../historyModel'

const verse = (
  date: number,
  overrides: Partial<Extract<HistoryItemInput, { type: 'verse' }>> = {}
): Extract<HistoryItemInput, { type: 'verse' }> => ({
  type: 'verse',
  book: 1,
  chapter: 1,
  verse: 1,
  version: 'LSG',
  date,
  ...overrides,
})

describe('historyModel', () => {
  it('migrates legacy entries and drops invalid persisted values', () => {
    const result = migrateHistoryItems([
      verse(10),
      { type: 'word', word: 'Grâce', date: 9 },
      { type: 'verse', book: 'invalid', chapter: 1, verse: 1, version: 'LSG', date: 8 },
      null,
    ])

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      type: 'verse',
      book: 1,
      schemaVersion: HISTORY_SCHEMA_VERSION,
    })
    expect(result[0].id).toBeTruthy()
  })

  it('moves a revisited item to the front instead of duplicating it', () => {
    const first = addHistoryItem([], verse(10))
    const withAnotherChapter = addHistoryItem(first, verse(11, { chapter: 2 }))
    const revisited = addHistoryItem(withAnotherChapter, verse(12))

    expect(revisited).toHaveLength(2)
    expect(revisited[0]).toMatchObject({ type: 'verse', chapter: 1, date: 12 })
    expect(revisited[1]).toMatchObject({ type: 'verse', chapter: 2, date: 11 })
  })

  it('keeps one entry per chapter, reopening the latest version and verse', () => {
    const french = addHistoryItem([], verse(10, { version: 'LSG', verse: 3 }))
    const english = addHistoryItem(french, verse(11, { version: 'KJV', verse: 16 }))

    expect(english).toHaveLength(1)
    expect(english[0]).toMatchObject({ version: 'KJV', verse: 16, date: 11 })
  })

  it('merges stored visits of one chapter in several versions', () => {
    const result = migrateHistoryItems([
      verse(12, { version: 'KJV' }),
      verse(11, { version: 'LSG', verse: 5 }),
      verse(10, { chapter: 2 }),
    ])

    expect(result.map(item => item.date)).toEqual([12, 10])
  })

  it('distinguishes dictionary entries with the same label from different resources', () => {
    const base: Extract<HistoryItemInput, { type: 'word' }> = {
      type: 'word',
      word: 'Alliance',
      work: 'westphal',
      language: 'fr',
      date: 10,
    }
    const first = addHistoryItem([], base)
    const second = addHistoryItem(first, {
      ...base,
      work: 'easton-webster',
      language: 'en',
      date: 11,
    })

    expect(second).toHaveLength(2)
  })

  it('retains only the most recent configured number of chapters', () => {
    let history: HistoryItem[] = []
    for (let index = 1; index <= MAX_HISTORY_ITEMS_PER_TYPE + 10; index += 1) {
      history = addHistoryItem(history, verse(index, { chapter: index }))
    }

    expect(history).toHaveLength(MAX_HISTORY_ITEMS_PER_TYPE)
    expect(history[0]).toMatchObject({ date: MAX_HISTORY_ITEMS_PER_TYPE + 10 })
    expect(history.at(-1)).toMatchObject({ date: 11 })
  })

  it('does not let reading evict consulted resources', () => {
    let history = addHistoryItem([], { type: 'nave', name: 'Grâce', name_lower: 'grace', date: 1 })
    for (let index = 2; index <= MAX_HISTORY_ITEMS_PER_TYPE + 10; index += 1) {
      history = addHistoryItem(history, verse(index, { chapter: index }))
    }

    expect(history).toHaveLength(MAX_HISTORY_ITEMS_PER_TYPE + 1)
    expect(history.at(-1)).toMatchObject({ type: 'nave' })
  })

  it('removes one entry by id', () => {
    const history = addHistoryItem(addHistoryItem([], verse(10)), verse(11, { chapter: 2 }))

    expect(removeHistoryItem(history, history[0].id)).toEqual([history[1]])
  })

  it('filters entries by kind', () => {
    const history = addHistoryItem(addHistoryItem([], verse(10)), {
      type: 'word',
      word: 'Grâce',
      date: 11,
    })

    expect(history.filter(item => matchesHistoryFilter(item, 'bible'))).toHaveLength(1)
    expect(history.filter(item => matchesHistoryFilter(item, 'word'))).toHaveLength(1)
    expect(history.filter(item => matchesHistoryFilter(item, 'strong'))).toHaveLength(0)
    expect(history.filter(item => matchesHistoryFilter(item, 'all'))).toHaveLength(2)
  })

  it('keeps one entry per study, note, plan, event and commentary passage', () => {
    let history: HistoryItem[] = []
    const inputs: HistoryItemInput[] = [
      { type: 'study', studyId: 's1', title: 'Grâce', date: 1 },
      { type: 'study', studyId: 's1', title: 'Grâce et vérité', date: 2 },
      { type: 'note', noteId: 'n1', title: 'Note', reference: 'Jean 3:16', date: 3 },
      { type: 'plan', planId: 'p1', title: 'Plan', date: 4 },
      { type: 'plan', planId: 'p1', title: 'Plan', date: 5 },
      { type: 'meditation', collectionId: 'c1', readingId: 'r1', title: 'Matin', date: 6 },
      { type: 'meditation', collectionId: 'c1', readingId: 'r2', title: 'Soir', date: 7 },
      { type: 'timeline', slug: 'exode', title: 'L’Exode', date: 8 },
      { type: 'commentary', verse: '43-3-16', date: 9 },
      {
        type: 'commentary-resource',
        projectionId: 'mhc-fr',
        book: 45,
        chapter: 8,
        title: 'Matthew Henry',
        passage: 'Romains 8',
        date: 10,
      },
    ]
    inputs.forEach(input => {
      history = addHistoryItem(history, input)
    })

    expect(history.map(item => item.type)).toEqual([
      'commentary-resource',
      'commentary',
      'timeline',
      'meditation',
      'meditation',
      'plan',
      'note',
      'study',
    ])
    expect(history.at(-1)).toMatchObject({ title: 'Grâce et vérité' })
  })

  it('groups related kinds under one filter', () => {
    const history = migrateHistoryItems([
      { type: 'meditation', collectionId: 'c1', readingId: 'r1', title: 'Matin', date: 3 },
      { type: 'plan', planId: 'p1', title: 'Plan', date: 2 },
      { type: 'commentary', verse: '43-3-16', date: 1 },
    ])

    expect(history.filter(item => matchesHistoryFilter(item, 'plan'))).toHaveLength(2)
    expect(history.filter(item => matchesHistoryFilter(item, 'commentary'))).toHaveLength(1)
  })

  it('drops stored entries that cannot be reopened', () => {
    const result = migrateHistoryItems([
      { type: 'commentary', verse: 'Jean 3', date: 1 },
      { type: 'study', title: 'Sans identifiant', date: 2 },
      { type: 'commentary-resource', projectionId: 'mhc-fr', book: 0, chapter: 1, date: 3 },
    ])

    expect(result).toEqual([])
  })

  it('groups entries by local day and labels the days', () => {
    const now = new Date(2026, 9, 18, 15).getTime()
    const history = migrateHistoryItems([
      verse(new Date(2026, 9, 18, 9).getTime()),
      verse(new Date(2026, 9, 18, 8).getTime(), { chapter: 2 }),
      verse(new Date(2026, 9, 17, 22).getTime(), { chapter: 3 }),
      verse(new Date(2026, 2, 1).getTime(), { chapter: 4 }),
      verse(new Date(2025, 11, 31).getTime(), { chapter: 5 }),
    ])

    const days = groupHistoryByDay(history)

    expect(days.map(day => day.items.length)).toEqual([2, 1, 1, 1])
    expect(days.map(day => getHistoryDayLabel(day.day, now))).toEqual([
      'today',
      'yesterday',
      'thisYear',
      'older',
    ])
  })
})
