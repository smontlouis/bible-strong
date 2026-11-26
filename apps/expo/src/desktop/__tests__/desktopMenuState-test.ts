import type { HistoryItem } from '~features/history/historyModel'
import type { TabItem } from '~state/tabs'

import {
  buildDesktopMenuState,
  parseRecentPassageId,
  recentPassageId,
  recentPassages,
} from '../desktopMenuState'

const reading = (date: number, book: number, chapter: number, version = 'LSG'): HistoryItem => ({
  id: `verse-${date}`,
  schemaVersion: 2,
  date,
  type: 'verse',
  book,
  chapter,
  verse: 1,
  version,
})

const tab = (id: string, title: string) => ({ id, title }) as TabItem

describe('the recent passages of the menu', () => {
  it('lists each chapter once, newest first, in the version last read', () => {
    const history = [
      reading(1, 43, 3),
      reading(3, 1, 1),
      reading(2, 43, 3, 'NBS'),
      { ...reading(4, 0, 0), type: 'nave', name: 'Amour', name_lower: 'amour' } as HistoryItem,
    ]
    expect(recentPassages(history, 0)).toEqual([
      { version: 'LSG', book: 1, chapter: 1, date: 3 },
      { version: 'NBS', book: 43, chapter: 3, date: 2 },
    ])
  })

  it('hides what was read before the menu was cleared, and keeps ten', () => {
    const history = Array.from({ length: 14 }, (_, index) => reading(index + 1, 1, index + 1))
    const passages = recentPassages(history, 2)
    expect(passages).toHaveLength(10)
    expect(passages[0].chapter).toBe(14)
    expect(passages.at(-1)?.chapter).toBe(5)
  })

  it('names a passage by an id the menu hands back', () => {
    const passage = { version: 'LSG', book: 43, chapter: 3 }
    expect(parseRecentPassageId(recentPassageId(passage))).toEqual(passage)
    expect(parseRecentPassageId('LSG:x:3')).toBeUndefined()
    expect(parseRecentPassageId('')).toBeUndefined()
  })
})

describe('the menu state', () => {
  it('lists the tabs of the active group with the active one checked', () => {
    const state = buildDesktopMenuState({
      language: 'en-US',
      group: {
        tabs: [tab('a', 'Jean 3'), tab('b', '  '), tab('c', 'x'.repeat(80))],
        activeTabIndex: 1,
      },
      history: [reading(1, 43, 3)],
      clearedAt: 0,
      untitledTab: 'New tab',
      passageLabel: ({ book, chapter, version }) => `${book} ${chapter} · ${version}`,
    })
    expect(state.language).toBe('fr')
    expect(state.tabs.map(({ title, active }) => [title, active])).toEqual([
      ['Jean 3', false],
      ['New tab', true],
      [`${'x'.repeat(59)}…`, false],
    ])
    expect(state.recents).toEqual([{ id: 'LSG:43:3', label: '43 3 · LSG' }])
  })

  it('speaks English only when the app does', () => {
    const state = buildDesktopMenuState({
      language: 'en',
      group: undefined,
      history: [],
      clearedAt: 0,
      untitledTab: 'New tab',
      passageLabel: () => '',
    })
    expect(state).toEqual({ language: 'en', tabs: [], recents: [] })
  })
})
