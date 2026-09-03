import {
  addHistoryItem,
  HISTORY_SCHEMA_VERSION,
  MAX_HISTORY_ITEMS,
  migrateHistoryItems,
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
    const withAnotherVerse = addHistoryItem(first, verse(11, { verse: 2 }))
    const revisited = addHistoryItem(withAnotherVerse, verse(12))

    expect(revisited).toHaveLength(2)
    expect(revisited[0]).toMatchObject({ type: 'verse', verse: 1, date: 12 })
    expect(revisited[1]).toMatchObject({ type: 'verse', verse: 2, date: 11 })
  })

  it('keeps visits to the same passage in different Bible versions', () => {
    const french = addHistoryItem([], verse(10, { version: 'LSG' }))
    const english = addHistoryItem(french, verse(11, { version: 'KJV' }))

    expect(english).toHaveLength(2)
    expect(english.map(item => (item.type === 'verse' ? item.version : ''))).toEqual(['KJV', 'LSG'])
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

  it('retains only the most recent configured number of items', () => {
    let history: HistoryItem[] = []
    for (let index = 1; index <= MAX_HISTORY_ITEMS + 10; index += 1) {
      history = addHistoryItem(history, verse(index, { verse: index }))
    }

    expect(history).toHaveLength(MAX_HISTORY_ITEMS)
    expect(history[0]).toMatchObject({ date: MAX_HISTORY_ITEMS + 10 })
    expect(history.at(-1)).toMatchObject({ date: 11 })
  })
})
