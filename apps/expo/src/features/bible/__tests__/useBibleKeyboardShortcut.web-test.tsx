import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { TabCommandContext } from '~common/useTabCommands'
import { useBibleKeyboardShortcut } from '../useBibleKeyboardShortcut.web'

let mockActive = 'bible-a'
let mockPath = '/'
let mockPalette = false
jest.mock('expo-router', () => ({ usePathname: () => mockPath }))
jest.mock('~state/tabs', () => ({ activeTabIdAtom: 'active', appSwitcherModeAtom: 'mode' }))
jest.mock('~features/app-switcher/commandPalette/state', () => ({
  commandPaletteOpenAtom: 'palette',
}))
jest.mock('jotai/react', () => ({
  useAtomValue: (atom: string) =>
    atom === 'active' ? mockActive : atom === 'palette' ? mockPalette : 'view',
}))
jest.mock('~common/useTabCommands', () => ({
  TabCommandContext: jest.requireActual<typeof import('react')>('react').createContext(undefined),
}))

const listeners = new Map<string, (event: KeyboardEvent) => void>()
let mockOverlay = false
class ElementTarget {
  isContentEditable = false
  constructor(public editing = false) {}
  closest() {
    return this.editing ? this : null
  }
}
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const originalHTMLElement = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement')
let view: ReactTestRenderer
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  mockActive = 'bible-a'
  mockPath = '/'
  mockPalette = false
  mockOverlay = false
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: ElementTarget })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      addEventListener: (name: string, handler: (event: KeyboardEvent) => void) =>
        listeners.set(name, handler),
      removeEventListener: (name: string) => listeners.delete(name),
      querySelector: () => (mockOverlay ? {} : null),
    },
  })
})
afterEach(() => {
  act(() => view?.unmount())
  expect(listeners.size).toBe(0)
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
  else Reflect.deleteProperty(globalThis, 'document')
  if (originalHTMLElement) Object.defineProperty(globalThis, 'HTMLElement', originalHTMLElement)
  else Reflect.deleteProperty(globalThis, 'HTMLElement')
})
function Shortcut({ run }: { run: () => void }) {
  useBibleKeyboardShortcut('s', 'bible-a', run)
  return null
}
function tree(run: () => void) {
  return (
    <TabCommandContext.Provider value="bible-a">
      <Shortcut run={run} />
    </TabCommandContext.Provider>
  )
}
function press(editing = false) {
  const event = {
    key: 's',
    repeat: false,
    isComposing: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    defaultPrevented: false,
    target: new ElementTarget(editing),
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  } as unknown as KeyboardEvent
  act(() => listeners.get('keydown')?.(event))
  return event
}
it('acts only on the active Bible tab, never on a cached tab or another route', () => {
  const run = jest.fn()
  act(() => {
    view = create(tree(run))
  })
  press()
  expect(run).toHaveBeenCalledTimes(1)
  mockActive = 'dictionary'
  act(() => view.update(tree(run)))
  press()
  expect(run).toHaveBeenCalledTimes(1)
  mockActive = 'bible-a'
  mockPath = '/settings'
  act(() => view.update(tree(run)))
  press()
  expect(run).toHaveBeenCalledTimes(1)
})
it('leaves typing, open panels and the command palette alone', () => {
  const run = jest.fn()
  act(() => {
    view = create(tree(run))
  })
  expect(press(true).preventDefault).not.toHaveBeenCalled()
  mockOverlay = true
  expect(press().preventDefault).not.toHaveBeenCalled()
  mockOverlay = false
  mockPalette = true
  act(() => view.update(tree(run)))
  press()
  expect(run).not.toHaveBeenCalled()
})
