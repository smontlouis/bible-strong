import { atom } from 'jotai'
import type { createStore } from 'jotai/vanilla'
import type { TabItem } from '~state/tabs'
import type { ReaderPageSignal } from './readerIntent/types'

/**
 * What the shared Bible page last painted: the tab it was given, and the chapter of the verses
 * on screen. On Android one page serves every Bible tab, and it moves into a tab before it has
 * painted that tab's chapter. Only this report says which chapter the page shows.
 */
export type BibleDOMPaint = Omit<Extract<ReaderPageSignal, { kind: 'painted' }>, 'kind'>

export const sharedBibleDOMPaintAtom = atom<BibleDOMPaint | null>(null)

/** The page shows this tab's own chapter, not the one of the tab it served before. */
export const isPaintOfTab = (paint: BibleDOMPaint | null, tab: TabItem | undefined) =>
  Boolean(
    paint &&
    tab?.type === 'bible' &&
    paint.tabId === tab.id &&
    paint.book === tab.data.selectedBook.Numero &&
    paint.chapter === tab.data.selectedChapter
  )

type Store = ReturnType<typeof createStore>

/**
 * Resolves true once the shared page reports it painted the tab, false after `timeoutMs`.
 * `getTab` is read again at each report, so a tab whose chapter changes meanwhile waits for
 * its new chapter.
 */
export const waitForPaintOfTab = (
  store: Store,
  getTab: () => TabItem | undefined,
  timeoutMs: number
) =>
  new Promise<boolean>(resolve => {
    const isPainted = () => isPaintOfTab(store.get(sharedBibleDOMPaintAtom), getTab())
    if (isPainted()) {
      resolve(true)
      return
    }

    const finish = (painted: boolean) => {
      clearTimeout(timeout)
      unsubscribe()
      resolve(painted)
    }
    const unsubscribe = store.sub(sharedBibleDOMPaintAtom, () => {
      if (isPainted()) finish(true)
    })
    const timeout = setTimeout(() => finish(false), timeoutMs)
  })
