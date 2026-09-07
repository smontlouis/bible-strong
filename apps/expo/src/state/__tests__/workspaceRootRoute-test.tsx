import React from 'react'
import { act, create } from 'react-test-renderer'
import AppSwitcherScreen from '~features/app-switcher/AppSwitcherScreen/AppSwitcherScreen'

let mockWide = true
jest.mock('~features/app-switcher/utils/useResponsiveWorkspace', () => ({
  useResponsiveWorkspace: () => mockWide,
}))
jest.mock(
  '~features/app-switcher/AppSwitcherScreen/CompactAppSwitcherScreen',
  () => () => 'compact-workspace'
)
const mockReplace = jest.fn()
let mockFocused = false
let mockActiveTab = ''
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useFocusEffect: (callback: () => void) => {
    if (mockFocused) callback()
  },
}))
jest.mock('jotai/react', () => ({ useAtomValue: () => mockActiveTab }))
jest.mock('~state/tabs', () => ({ activeTabIdAtom: {} }))

beforeEach(() => {
  mockWide = true
  mockReplace.mockClear()
  mockFocused = false
  mockActiveTab = ''
})

test('does not redirect a direct URL when the background workspace is empty', () => {
  let root: ReturnType<typeof create>
  act(() => {
    root = create(<AppSwitcherScreen />)
  })
  expect(mockReplace).not.toHaveBeenCalled()
  act(() => root.unmount())
})

test('falls back to Home only when the empty workspace route is focused', () => {
  mockFocused = true
  let root: ReturnType<typeof create>
  act(() => {
    root = create(<AppSwitcherScreen />)
  })
  expect(mockReplace).toHaveBeenCalledWith('/home')
  act(() => root.unmount())
})

test('keeps a selected content tab on the workspace route', () => {
  mockFocused = true
  mockActiveTab = 'bible-1'
  let root: ReturnType<typeof create>
  act(() => {
    root = create(<AppSwitcherScreen />)
  })
  expect(mockReplace).not.toHaveBeenCalled()
  act(() => root.unmount())
})

test('renders mobile navigation without redirecting an empty compact workspace', () => {
  mockWide = false
  mockFocused = true
  let root: ReturnType<typeof create>
  act(() => {
    root = create(<AppSwitcherScreen />)
  })
  expect(root!.toJSON()).toBe('compact-workspace')
  expect(mockReplace).not.toHaveBeenCalled()
  act(() => root.unmount())
})
