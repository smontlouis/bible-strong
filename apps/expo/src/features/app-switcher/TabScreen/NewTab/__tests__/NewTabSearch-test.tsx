import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { Provider } from 'jotai/react'
import { atom, createStore } from 'jotai/vanilla'
import { Keyboard, TextInput } from 'react-native'
import type { TabItem } from '~state/tabs'
import NewTabSearch from '../NewTabSearch'

let mockPathname = '/'
const mockActiveTabIdAtom = atom('new-test')
const mockSwitcherModeAtom = atom('view')
jest.mock('expo-router', () => ({ usePathname: () => mockPathname }))
jest.mock('~state/tabs', () => ({
  get activeTabIdAtom() {
    return mockActiveTabIdAtom
  },
  get appSwitcherModeAtom() {
    return mockSwitcherModeAtom
  },
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('react-native', () => ({
  TextInput: 'TextInput',
  Platform: { OS: 'web' },
  Keyboard: { dismiss: jest.fn() },
}))
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  TouchableBox: 'TouchableBox',
}))
jest.mock('~common/ui/Text', () => ({ __esModule: true, default: 'Text' }))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'Icon' }))
jest.mock('~themes/styleValues', () => ({ resolveFontFamily: (font: string) => font }))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({
    colors: { primary: 'blue', lightPrimary: 'aliceblue', default: 'black', tertiary: 'gray' },
    fontFamily: { text: 'system-ui' },
  }),
}))

const focus = jest.fn()
const addListener = jest.fn()
const removeListener = jest.fn()
let view: ReactTestRenderer
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

beforeEach(() => {
  jest.clearAllMocks()
  mockPathname = '/'
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { addEventListener: addListener, removeEventListener: removeListener },
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { platform: 'MacIntel' },
  })
})
afterEach(() => {
  act(() => view.unmount())
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
  else Reflect.deleteProperty(globalThis, 'document')
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else Reflect.deleteProperty(globalThis, 'navigator')
})

function mount(activeId = 'new-test') {
  const store = createStore()
  store.set(mockActiveTabIdAtom, activeId)
  const initial: TabItem = {
    id: 'new-test',
    type: 'new',
    title: 'New tab',
    isRemovable: true,
    base64Preview: 'stale-preview',
    data: {},
  }
  const tabAtom = atom<TabItem>(initial)
  act(() => {
    view = create(
      <Provider store={store}>
        <NewTabSearch tabAtom={tabAtom} />
      </Provider>,
      {
        createNodeMock: () => ({ focus }),
      }
    )
  })
  return { store, tabAtom, initial, input: () => view.root.findByType(TextInput) }
}

it('submits a trimmed query into the same tab, preserving its identity and clearing its preview', () => {
  const { store, tabAtom, input } = mount()
  act(() => input().props.onChangeText('  amour  '))
  act(() => input().props.onSubmitEditing())
  expect(store.get(tabAtom)).toEqual({
    id: 'new-test',
    type: 'search',
    title: 'amour',
    isRemovable: true,
    base64Preview: '',
    data: { searchValue: 'amour' },
  })
  expect(Keyboard.dismiss).toHaveBeenCalledTimes(1)
})

it('keeps an empty or whitespace-only search on the launcher', () => {
  const { store, tabAtom, initial, input } = mount()
  act(() => input().props.onSubmitEditing())
  act(() => input().props.onChangeText('   '))
  act(() => input().props.onSubmitEditing())
  expect(store.get(tabAtom)).toEqual(initial)
  expect(Keyboard.dismiss).not.toHaveBeenCalled()
})

it('registers the keyboard shortcut only for the active visible tab and cleans it up', () => {
  const { store } = mount('another-tab')
  expect(addListener).not.toHaveBeenCalled()
  act(() => store.set(mockActiveTabIdAtom, 'new-test'))
  const listener = addListener.mock.calls.at(-1)?.[1]
  expect(listener).toBeDefined()
  const preventDefault = jest.fn()
  act(() => listener({ key: 'k', metaKey: true, ctrlKey: false, altKey: false, preventDefault }))
  expect(focus).toHaveBeenCalledTimes(1)
  expect(preventDefault).toHaveBeenCalledTimes(1)
  act(() => store.set(mockSwitcherModeAtom, 'list'))
  expect(removeListener).toHaveBeenCalledWith('keydown', listener)
})

it('does not steal the shortcut from a route displayed over cached tabs', () => {
  mockPathname = '/settings'
  mount()
  expect(addListener).not.toHaveBeenCalled()
})
