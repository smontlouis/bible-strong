import React, { act, useEffect } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { Provider } from 'jotai/react'
import { atom, createStore } from 'jotai/vanilla'
import type { TabItem } from '~state/tabs'
import GlobalCommandPalette from '../GlobalCommandPalette'
import { useLaunchSearch } from '../useLaunchSearch'
import { commandPaletteOpenAtom, commandPaletteTargetAtom } from '../state'

jest.mock('../scopes', () => ({ paletteScopes: [{ type: 'notes' }] }))

const mockOpenTab = jest.fn()
const selected: TabItem = {
  id: 'selected',
  type: 'notes',
  title: 'Note',
  isRemovable: true,
  data: {},
}
jest.mock('react-native', () => ({ Keyboard: { dismiss: jest.fn() } }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~features/search/SearchSelectionSheet', () => ({
  __esModule: true,
  default: 'SearchSheet',
}))
jest.mock('../../utils/useOpenInNewTab', () => ({ useOpenInNewTab: () => mockOpenTab }))
jest.mock('~features/search/discovery/useSelectCatalogResult', () => ({
  useSelectCatalogResult: (onSelect: (tab: TabItem) => void) => ({
    select: async (tab: TabItem) => onSelect(tab),
  }),
}))
jest.mock('../pickerSelection', () => ({
  getPickerAllowedSources: () => ['notes'],
  getPickerResultTab: () => selected,
}))

let view: ReactTestRenderer
let launch: ReturnType<typeof useLaunchSearch>
function Launcher() {
  const launchSearch = useLaunchSearch()
  useEffect(() => {
    launch = launchSearch
  }, [launchSearch])
  return null
}
const blank: TabItem = {
  id: 'blank',
  type: 'new',
  title: 'New',
  isRemovable: false,
  base64Preview: 'old',
  data: {},
}
beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})
afterEach(() => act(() => view.unmount()))
function mount() {
  const store = createStore()
  const target = atom(blank)
  act(() => {
    view = create(
      <Provider store={store}>
        <Launcher />
        <GlobalCommandPalette />
      </Provider>
    )
  })
  return { store, target }
}
const sheet = () => view.root.findByType('SearchSheet' as never)

it('replaces the originating blank tab and preserves its identity', async () => {
  const { store, target } = mount()
  act(() => {
    launch('notes', target)
  })
  await act(async () => {
    await sheet().props.onSelectItem({}, 'LSG')
  })
  expect(store.get(target)).toEqual({
    ...selected,
    id: 'blank',
    isRemovable: false,
    base64Preview: '',
  })
  expect(mockOpenTab).not.toHaveBeenCalled()
  expect(store.get(commandPaletteOpenAtom)).toBe(false)
  expect(store.get(commandPaletteTargetAtom)).toBeUndefined()
})

it('leaves the blank tab untouched on cancellation and clears the next launch target', async () => {
  const { store, target } = mount()
  act(() => {
    launch('notes', target)
  })
  act(() => {
    sheet().props.onDismiss()
  })
  expect(store.get(target)).toEqual(blank)
  act(() => {
    launch('notes')
  })
  await act(async () => {
    await sheet().props.onSelectItem({}, 'LSG')
  })
  expect(mockOpenTab).toHaveBeenCalledWith(selected, { autoRedirect: true })
  expect(store.get(target)).toEqual(blank)
})

it('does not overwrite a target that is no longer blank', async () => {
  const { store, target } = mount()
  act(() => {
    launch('notes', target)
  })
  act(() => {
    store.set(target, { ...selected, id: 'blank' })
  })
  await act(async () => {
    await sheet().props.onSelectItem({}, 'LSG')
  })
  expect(store.get(target)).toEqual({ ...selected, id: 'blank' })
  expect(mockOpenTab).not.toHaveBeenCalled()
})

it('ignores a selection completed after the sheet was dismissed', async () => {
  const { store, target } = mount()
  act(() => {
    launch('notes', target)
  })
  const select = sheet().props.onSelectItem
  act(() => {
    sheet().props.onDismiss()
  })
  await act(async () => {
    await select({}, 'LSG')
  })
  expect(store.get(target)).toEqual(blank)
  expect(mockOpenTab).not.toHaveBeenCalled()
})
