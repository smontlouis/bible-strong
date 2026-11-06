import React, { act } from 'react'
import { create } from 'react-test-renderer'
import { Provider } from 'jotai/react'
import { atom, createStore } from 'jotai/vanilla'
import { captureRef } from 'react-native-view-shot'
import * as FileSystem from 'expo-file-system/legacy'
import type { TabGroup, TabItem } from '~state/tabs'
import { sharedBibleDOMPaintAtom } from '~features/bible/sharedBibleDOMPaint'
import useTakeActiveTabSnapshot, {
  SHARED_BIBLE_PAINT_TIMEOUT_MS,
} from '../useTakeActiveTabSnapshot'

const mockFiles = new Set<string>()
const mockPlatform = { OS: 'ios' }
const mockTabsAtom = atom<TabItem[]>([])
const mockOtherGroupTabsAtom = atom<TabItem[]>([])
const mockTabGroupsAtom = atom(get => [
  { id: 'active', tabs: get(mockTabsAtom) } as TabGroup,
  { id: 'other', tabs: get(mockOtherGroupTabsAtom) } as TabGroup,
])
const mockSetTabPreviewAtom = atom(
  null,
  (get, set, { tabId, uri }: { tabId: string; uri: string }) => {
    for (const tabsAtom of [mockTabsAtom, mockOtherGroupTabsAtom]) {
      const tabs = get(tabsAtom)
      if (tabs.some(item => item.id === tabId)) {
        set(
          tabsAtom,
          tabs.map(item => (item.id === tabId ? { ...item, previewUri: uri } : item))
        )
      }
    }
  }
)
const mockView = {
  measure: (callback: (x: number, y: number, width: number, height: number) => void) =>
    callback(0, 0, 390, 844),
}

jest.mock('react-native', () => ({
  get Platform() {
    return mockPlatform
  },
  PixelRatio: { get: () => 3 },
}))
jest.mock('~state/tabs', () => ({
  get tabsAtom() {
    return mockTabsAtom
  },
  get tabGroupsAtom() {
    return mockTabGroupsAtom
  },
  get setTabPreviewAtom() {
    return mockSetTabPreviewAtom
  },
}))
jest.mock('~helpers/useDynamicRefs', () => ({
  __esModule: true,
  default: () => [(key: string) => (key === 'missing' ? undefined : mockView)],
}))
jest.mock('~helpers/runAfterInteractions', () => ({
  runAfterInteractions: (callback: () => void) => callback(),
}))
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }))
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn(async () => {}),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    mockFiles.delete(from)
    mockFiles.add(to)
  }),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(async (uri: string) => {
    mockFiles.delete(uri)
  }),
  readDirectoryAsync: jest.fn(async () => []),
}))

const directory = 'file:///documents/tab-previews/'

const tab = (id: string, previewUri?: string): TabItem => ({
  id,
  title: id,
  isRemovable: true,
  type: 'new',
  data: {},
  previewUri,
})

const bibleTab = (id: string, book: number, chapter: number): TabItem =>
  ({
    id,
    title: id,
    isRemovable: true,
    type: 'bible',
    data: { selectedBook: { Numero: book }, selectedChapter: chapter },
  }) as TabItem

function mount(tabs: TabItem[]) {
  const store = createStore()
  store.set(mockTabsAtom, tabs)
  let snapshot!: ReturnType<typeof useTakeActiveTabSnapshot>
  const Probe = () => {
    snapshot = useTakeActiveTabSnapshot()
    return null
  }
  act(() => {
    create(
      <Provider store={store}>
        <Probe />
      </Provider>
    )
  })
  return { store, snapshot }
}

beforeEach(() => {
  mockFiles.clear()
  mockPlatform.OS = 'ios'
  jest.clearAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(1000)
  jest.mocked(captureRef).mockImplementation(async () => {
    mockFiles.add('file:///tmp/ReactNative/capture.jpg')
    return '/tmp/ReactNative/capture.jpg'
  })
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

afterEach(() => jest.restoreAllMocks())

it('captures a file at half size and stores its URI on the tab', async () => {
  const { store, snapshot } = mount([tab('a'), tab('b')])

  await act(() => snapshot.captureSnapshot(1, 'b'))

  // iOS sizes the capture in points.
  expect(captureRef).toHaveBeenCalledWith(mockView, {
    result: 'tmpfile',
    format: 'jpg',
    quality: 0.8,
    width: 195,
    height: 422,
  })
  expect(store.get(mockTabsAtom).map(item => item.previewUri)).toEqual([
    undefined,
    `${directory}b.jpg?v=1000`,
  ])
  expect([...mockFiles]).toEqual([`${directory}b.jpg`])
})

it('sizes the capture in pixels on Android', async () => {
  mockPlatform.OS = 'android'
  const { snapshot } = mount([tab('a')])

  await act(() => snapshot.captureSnapshot(0, 'a'))

  expect(captureRef).toHaveBeenCalledWith(
    mockView,
    expect.objectContaining({ width: 585, height: 1266 })
  )
})

it('overwrites the file of its tab and changes the version of its address', async () => {
  mockFiles.add(`${directory}a.jpg`)
  const { store, snapshot } = mount([tab('a', `${directory}a.jpg?v=500`)])

  await act(() => snapshot.captureSnapshot(0, 'a'))

  expect(store.get(mockTabsAtom)[0].previewUri).toBe(`${directory}a.jpg?v=1000`)
  expect([...mockFiles]).toEqual([`${directory}a.jpg`])
})

it("keeps another tab's file a copied tab showed while that tab still shows it", async () => {
  const original = `${directory}a.jpg?v=500`
  mockFiles.add(`${directory}a.jpg`)
  const { store, snapshot } = mount([tab('copy', original)])
  store.set(mockOtherGroupTabsAtom, [tab('a', original)])

  await act(() => snapshot.captureSnapshot(0, 'copy'))

  expect(store.get(mockTabsAtom)[0].previewUri).toBe(`${directory}copy.jpg?v=1000`)
  expect([...mockFiles].sort()).toEqual([`${directory}a.jpg`, `${directory}copy.jpg`])
})

it("deletes another tab's file a copied tab showed once no tab shows it", async () => {
  mockFiles.add(`${directory}a.jpg`)
  const { snapshot } = mount([tab('copy', `${directory}a.jpg?v=500`)])

  await act(() => snapshot.captureSnapshot(0, 'copy'))

  expect([...mockFiles]).toEqual([`${directory}copy.jpg`])
})

it('drops the capture when its tab is gone', async () => {
  const { store, snapshot } = mount([tab('a')])

  await act(() => snapshot.captureSnapshot(3, 'a'))

  expect(store.get(mockTabsAtom)[0].previewUri).toBeUndefined()
  expect(mockFiles.size).toBe(0)
})

it('keeps the web preview as a data URI, without any file', async () => {
  mockPlatform.OS = 'web'
  jest.mocked(captureRef).mockResolvedValue('data:image/jpeg;base64,AAAA')
  const { store, snapshot } = mount([tab('a')])

  await act(() => snapshot.captureSnapshot(0, 'a'))

  expect(captureRef).toHaveBeenCalledWith(
    mockView,
    expect.objectContaining({ result: 'data-uri', width: 585, height: 1266 })
  )
  expect(store.get(mockTabsAtom)[0].previewUri).toBe('data:image/jpeg;base64,AAAA')
  expect(FileSystem.moveAsync).not.toHaveBeenCalled()
})

describe('a Bible tab served by the shared Android page', () => {
  const genesis = bibleTab('genesis', 1, 3)
  const john = bibleTab('john', 43, 3)

  beforeEach(() => {
    mockPlatform.OS = 'android'
  })

  it("waits for the page to paint the tab's own chapter before capturing it", async () => {
    jest.useFakeTimers({ doNotFake: ['Date'] })
    const { store, snapshot } = mount([genesis, john])
    // The page reached John's tab, still showing the chapter of Genesis.
    store.set(sharedBibleDOMPaintAtom, { tabId: 'john', book: 1, chapter: 3 })

    const capturing = snapshot.captureSnapshot(1, 'john')
    await act(async () => {})
    expect(captureRef).not.toHaveBeenCalled()

    await act(async () => {
      store.set(sharedBibleDOMPaintAtom, { tabId: 'john', book: 43, chapter: 3 })
      await capturing
    })

    expect(captureRef).toHaveBeenCalledTimes(1)
    expect(store.get(mockTabsAtom)[1].previewUri).toBe(`${directory}john.jpg?v=1000`)
    jest.useRealTimers()
  })

  it('keeps the old preview when the page never paints the tab', async () => {
    jest.useFakeTimers({ doNotFake: ['Date'] })
    const { store, snapshot } = mount([genesis, bibleTab('john', 43, 3)])
    store.set(mockTabsAtom, [genesis, { ...john, previewUri: `${directory}john.jpg?v=500` }])
    store.set(sharedBibleDOMPaintAtom, { tabId: 'genesis', book: 1, chapter: 3 })

    const capturing = snapshot.captureSnapshot(1, 'john')
    await act(async () => {
      jest.advanceTimersByTime(SHARED_BIBLE_PAINT_TIMEOUT_MS)
      await capturing
    })

    expect(captureRef).not.toHaveBeenCalled()
    expect(store.get(mockTabsAtom)[1].previewUri).toBe(`${directory}john.jpg?v=500`)
    jest.useRealTimers()
  })

  it('drops the capture when the page moves to another tab meanwhile', async () => {
    const { store, snapshot } = mount([genesis, john])
    store.set(sharedBibleDOMPaintAtom, { tabId: 'john', book: 43, chapter: 3 })
    jest.mocked(captureRef).mockImplementation(async () => {
      store.set(sharedBibleDOMPaintAtom, { tabId: 'genesis', book: 1, chapter: 3 })
      mockFiles.add('file:///tmp/ReactNative/capture.jpg')
      return 'file:///tmp/ReactNative/capture.jpg'
    })

    await act(() => snapshot.captureSnapshot(1, 'john'))

    expect(store.get(mockTabsAtom)[1].previewUri).toBeUndefined()
    expect(mockFiles.size).toBe(0)
  })

  it('does not wait when leaving a tab the page does not show', async () => {
    const { store, snapshot } = mount([genesis])

    await act(() => snapshot.captureSnapshot(0, 'genesis', { paintTimeoutMs: 0 }))

    expect(captureRef).not.toHaveBeenCalled()
    expect(store.get(mockTabsAtom)[0].previewUri).toBeUndefined()
  })
})
