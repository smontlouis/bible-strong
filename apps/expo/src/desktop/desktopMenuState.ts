import type { HistoryItem, HistoryVerseItem } from '~features/history/historyModel'
import type { TabGroup } from '~state/tabs'

/** What the native menu lists of the workspace (`apps/desktop/src-tauri/src/menu.rs`). */
export type DesktopMenuState = {
  language: 'fr' | 'en'
  /** The tabs of the active group, in the Window menu. */
  tabs: { id: string; title: string; active: boolean }[]
  /** The last passages read, newest first, in File › Open Recent. */
  recents: { id: string; label: string }[]
}

/** A recent passage: one chapter of the Bible, in the version it was last read in. */
export type RecentPassage = { version: string; book: number; chapter: number }

const RECENT_PASSAGES = 10
// A menu item is one line: a long tab title is cut, as the system cuts a window title.
const MAX_TITLE_LENGTH = 60

const shorten = (title: string) =>
  title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : title

export const recentPassageId = ({ version, book, chapter }: RecentPassage) =>
  `${version}:${book}:${chapter}`

export const parseRecentPassageId = (id: string): RecentPassage | undefined => {
  const [version, book, chapter] = id.split(':')
  const passage = { version, book: Number(book), chapter: Number(chapter) }
  return version && Number.isSafeInteger(passage.book) && Number.isSafeInteger(passage.chapter)
    ? passage
    : undefined
}

/**
 * The chapters read most recently, one entry each, in the version last read. The History
 * screen keeps every reading: clearing the menu only hides what was read before `clearedAt`.
 */
export const recentPassages = (history: readonly HistoryItem[], clearedAt: number) => {
  const passages: (RecentPassage & { date: number })[] = []
  const seen = new Set<string>()
  const readings = history
    .filter((item): item is HistoryVerseItem => item.type === 'verse' && item.date > clearedAt)
    .sort((left, right) => right.date - left.date)
  for (const item of readings) {
    const passage = {
      version: item.version,
      book: Number(item.book),
      chapter: Number(item.chapter),
    }
    if (!parseRecentPassageId(recentPassageId(passage))) continue
    const chapter = `${passage.book}:${passage.chapter}`
    if (seen.has(chapter)) continue
    seen.add(chapter)
    passages.push({ ...passage, date: item.date })
    if (passages.length === RECENT_PASSAGES) break
  }
  return passages
}

export const buildDesktopMenuState = ({
  language,
  group,
  history,
  clearedAt,
  untitledTab,
  passageLabel,
}: {
  language: string
  group: Pick<TabGroup, 'tabs' | 'activeTabIndex'> | undefined
  history: readonly HistoryItem[]
  clearedAt: number
  untitledTab: string
  passageLabel: (passage: RecentPassage) => string
}): DesktopMenuState => ({
  language: language === 'en' ? 'en' : 'fr',
  tabs: (group?.tabs ?? []).map((tab, index) => ({
    id: tab.id,
    title: shorten(tab.title?.trim() || untitledTab),
    active: index === group?.activeTabIndex,
  })),
  recents: recentPassages(history, clearedAt).map(passage => ({
    id: recentPassageId(passage),
    label: passageLabel(passage),
  })),
})
