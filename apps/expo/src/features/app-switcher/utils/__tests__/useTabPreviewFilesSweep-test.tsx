import React, { act } from 'react'
import { create } from 'react-test-renderer'
import { Provider } from 'jotai/react'
import { atom, createStore } from 'jotai/vanilla'
import type { TabGroup } from '~state/tabs'
import { rebaseTabPreviewUris, sweepTabPreviewFiles } from '../tabPreviewFiles'
import { TAB_PREVIEW_SWEEP_DELAY, useTabPreviewFilesSweep } from '../useTabPreviewFilesSweep'

const mockTabGroupsAtom = atom<TabGroup[]>([])
jest.mock('~state/tabs', () => ({
  get tabGroupsAtom() {
    return mockTabGroupsAtom
  },
}))
jest.mock('../tabPreviewFiles', () => ({
  TAB_PREVIEWS_DIRECTORY: 'file:///documents/tab-previews/',
  rebaseTabPreviewUris: jest.fn(),
  sweepTabPreviewFiles: jest.fn(),
}))

const group = (id: string, previewUri?: string): TabGroup => ({
  id,
  name: id,
  isDefault: false,
  tabs: [{ id: `${id}-tab`, title: id, type: 'new', data: {}, isRemovable: true, previewUri }],
  activeTabIndex: 0,
  createdAt: 1,
  updatedAt: 1,
})

function mount(store = createStore()) {
  const Probe = () => {
    useTabPreviewFilesSweep()
    return null
  }
  let view!: ReturnType<typeof create>
  act(() => {
    view = create(
      <Provider store={store}>
        <Probe />
      </Provider>
    )
  })
  return { store, view }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

afterEach(() => jest.useRealTimers())

it('sweeps once after launch, then once the tab groups stop changing', () => {
  const { store, view } = mount()

  expect(sweepTabPreviewFiles).not.toHaveBeenCalled()
  act(() => jest.advanceTimersByTime(TAB_PREVIEW_SWEEP_DELAY))
  expect(sweepTabPreviewFiles).toHaveBeenCalledTimes(1)

  act(() => store.set(mockTabGroupsAtom, [group('a')]))
  act(() => jest.advanceTimersByTime(TAB_PREVIEW_SWEEP_DELAY / 2))
  act(() => store.set(mockTabGroupsAtom, [group('b')]))
  act(() => jest.advanceTimersByTime(TAB_PREVIEW_SWEEP_DELAY / 2))
  expect(sweepTabPreviewFiles).toHaveBeenCalledTimes(1)

  act(() => jest.advanceTimersByTime(TAB_PREVIEW_SWEEP_DELAY / 2))
  expect(sweepTabPreviewFiles).toHaveBeenCalledTimes(2)
  // The sweep reads the groups when it runs.
  const getGroups = jest.mocked(sweepTabPreviewFiles).mock.lastCall![0]
  expect(getGroups()).toEqual([group('b')])

  act(() => view.unmount())
  act(() => store.set(mockTabGroupsAtom, []))
  act(() => jest.advanceTimersByTime(TAB_PREVIEW_SWEEP_DELAY))
  expect(sweepTabPreviewFiles).toHaveBeenCalledTimes(2)
})

it('points previews saved before an iOS update to the new container at launch', () => {
  const store = createStore()
  const rebased = [group('a', 'file:///documents/tab-previews/a-1.jpg')]
  jest.mocked(rebaseTabPreviewUris).mockReturnValueOnce(rebased)

  mount(store)

  expect(store.get(mockTabGroupsAtom)).toBe(rebased)
})
