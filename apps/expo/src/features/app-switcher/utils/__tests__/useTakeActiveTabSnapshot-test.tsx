import React, { act } from 'react'
import { create } from 'react-test-renderer'
import { Provider } from 'jotai/react'
import { atom, createStore } from 'jotai/vanilla'
import { captureRef } from 'react-native-view-shot'
import * as FileSystem from 'expo-file-system/legacy'
import type { TabGroup, TabItem } from '~state/tabs'
import useTakeActiveTabSnapshot from '../useTakeActiveTabSnapshot'

const mockFiles = new Set<string>()
const mockPlatform = { OS: 'ios' }
const mockTabsAtom = atom<TabItem[]>([])
const mockOtherGroupTabsAtom = atom<TabItem[]>([])
const mockTabGroupsAtom = atom(get => [
  { id: 'active', tabs: get(mockTabsAtom) } as TabGroup,
  { id: 'other', tabs: get(mockOtherGroupTabsAtom) } as TabGroup,
])
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
  const uri = `${directory}b-1000.jpg`
  expect(store.get(mockTabsAtom).map(item => item.previewUri)).toEqual([undefined, uri])
  expect([...mockFiles]).toEqual([uri])
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

it('deletes the replaced preview file right away', async () => {
  const previous = `${directory}a-500.jpg`
  mockFiles.add(previous)
  const { store, snapshot } = mount([tab('a', previous)])

  await act(() => snapshot.captureSnapshot(0, 'a'))

  expect(store.get(mockTabsAtom)[0].previewUri).toBe(`${directory}a-1000.jpg`)
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(previous, { idempotent: true })
  expect(mockFiles.has(previous)).toBe(false)
})

it('keeps the replaced file while another tab still shows it', async () => {
  const shared = `${directory}a-500.jpg`
  mockFiles.add(shared)
  const { store, snapshot } = mount([tab('a', shared)])
  store.set(mockOtherGroupTabsAtom, [tab('copy', shared)])

  await act(() => snapshot.captureSnapshot(0, 'a'))

  expect(mockFiles.has(shared)).toBe(true)
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
