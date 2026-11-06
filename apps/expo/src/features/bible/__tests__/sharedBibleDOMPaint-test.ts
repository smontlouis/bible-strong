import { createStore } from 'jotai/vanilla'
import type { TabItem } from '~state/tabs'
import { isPaintOfTab, sharedBibleDOMPaintAtom, waitForPaintOfTab } from '../sharedBibleDOMPaint'

const bibleTab = (id: string, book: number, chapter: number) =>
  ({
    id,
    type: 'bible',
    data: { selectedBook: { Numero: book }, selectedChapter: chapter },
  }) as TabItem

const genesis = bibleTab('genesis', 1, 2)

afterEach(() => jest.useRealTimers())

describe('isPaintOfTab', () => {
  it("is the tab's own chapter painted for that tab", () => {
    expect(isPaintOfTab({ tabId: 'genesis', book: 1, chapter: 2 }, genesis)).toBe(true)
  })

  it('is not the chapter of the tab the page served before', () => {
    // John's props reached the page while it still showed the verses of Genesis.
    expect(isPaintOfTab({ tabId: 'john', book: 1, chapter: 2 }, bibleTab('john', 43, 3))).toBe(
      false
    )
    expect(isPaintOfTab({ tabId: 'genesis', book: 43, chapter: 3 }, genesis)).toBe(false)
  })

  it('is false without a report or for a tab that is not a Bible', () => {
    expect(isPaintOfTab(null, genesis)).toBe(false)
    expect(
      isPaintOfTab({ tabId: 'genesis', book: 1, chapter: 2 }, {
        id: 'genesis',
        type: 'new',
        data: {},
      } as TabItem)
    ).toBe(false)
  })
})

describe('waitForPaintOfTab', () => {
  it('resolves at once when the page already shows the tab', async () => {
    const store = createStore()
    store.set(sharedBibleDOMPaintAtom, { tabId: 'genesis', book: 1, chapter: 2 })

    await expect(waitForPaintOfTab(store, () => genesis, 1000)).resolves.toBe(true)
  })

  it("waits past the other tab's chapter until the page paints the tab", async () => {
    jest.useFakeTimers()
    const store = createStore()
    store.set(sharedBibleDOMPaintAtom, { tabId: 'john', book: 43, chapter: 3 })
    const painted = waitForPaintOfTab(store, () => genesis, 1000)

    store.set(sharedBibleDOMPaintAtom, { tabId: 'genesis', book: 43, chapter: 3 })
    store.set(sharedBibleDOMPaintAtom, { tabId: 'genesis', book: 1, chapter: 2 })

    await expect(painted).resolves.toBe(true)
  })

  it('gives up when the page does not paint the tab in time', async () => {
    jest.useFakeTimers()
    const store = createStore()
    store.set(sharedBibleDOMPaintAtom, { tabId: 'john', book: 43, chapter: 3 })
    const painted = waitForPaintOfTab(store, () => genesis, 1000)

    jest.advanceTimersByTime(1000)

    await expect(painted).resolves.toBe(false)
  })
})
