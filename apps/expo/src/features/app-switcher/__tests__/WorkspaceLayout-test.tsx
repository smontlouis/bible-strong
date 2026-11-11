import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import WorkspaceLayout from '../WorkspaceLayout'
import WorkspaceSidebar from '../WorkspaceSidebar'
import { Platform } from 'react-native'

const mockPlatform = Platform as { OS: string }

let mockPath = '/note'
let mockShowsStudy = true
let mockBasePath: string | undefined
jest.mock('expo-router', () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  useWindowDimensions: () => ({ width: 1600 }),
}))
jest.mock('jotai', () => ({ useAtom: () => [false, jest.fn()], useSetAtom: () => jest.fn() }))
jest.mock('react-native-reanimated', () => ({
  cubicBezier: () => 'cubic-bezier',
  useReducedMotion: () => false,
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~navigation/pageTransition', () => ({
  finishPageTransition: jest.fn(),
  navigateWithPageTransition: jest.fn(),
}))
jest.mock('~navigation/useWorkspaceRoutePanel', () => ({
  useWorkspaceRoutePanel: () => ({
    open: true,
    basePath: mockBasePath,
    showsStudy: mockShowsStudy,
    reservedWidth: 500,
    sidebarDocked: true,
  }),
  workspaceSidebarDockedAtom: {},
  workspaceSidebarHiddenAtom: {},
}))
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  HStack: 'HStack',
  TouchableBox: 'TouchableBox',
}))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'Icon' }))
jest.mock('~features/bible/SharedBibleDOM', () => 'SharedBibleDOM')
jest.mock('../CachedTabScreens', () => 'CachedTabScreens')
jest.mock('../WorkspaceSidebar', () => 'WorkspaceSidebar')
jest.mock('../commandPalette/GlobalCommandPalette', () => 'GlobalCommandPalette')
jest.mock('../context/TabContext', () => ({ TabContextProvider: 'TabContextProvider' }))
jest.mock('../utils/useResponsiveWorkspace', () => ({
  useResponsiveWorkspace: () => true,
  WORKSPACE_SIDEBAR_WIDTH: 260,
  WORKSPACE_FRAME_GAP: 8,
  useWorkspaceSidebarWidth: () => 260,
  workspaceSidebarVariant: 'inset',
}))

function renderLayout() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { documentElement: { style: { setProperty: jest.fn(), removeProperty: jest.fn() } } },
  })
  let view: ReactTestRenderer
  act(() => {
    view = create(
      <WorkspaceLayout>
        <span />
      </WorkspaceLayout>
    )
  })
  return {
    view: view!,
    cleanup: () => {
      act(() => view!.unmount())
      if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
      else Reflect.deleteProperty(globalThis, 'document')
    },
  }
}

function sidebarIsActive() {
  const { view, cleanup } = renderLayout()
  const active = view.root.findByType(WorkspaceSidebar).props.isContentActive
  cleanup()
  return active
}

function readerZIndex() {
  const { view, cleanup } = renderLayout()
  const zIndex = view.root.findByProps({ testID: 'workspace-reader-motion' }).props.style.zIndex
  cleanup()
  return zIndex
}

afterEach(() => {
  mockPlatform.OS = 'web'
  mockBasePath = undefined
})

it('keeps the underlying tab active while an auxiliary panel is open', () => {
  mockPath = '/note'
  mockShowsStudy = true
  expect(sidebarIsActive()).toBe(true)
})
it('does not highlight a tab when the panel belongs to a standalone page', () => {
  mockPath = '/note'
  mockShowsStudy = false
  expect(sidebarIsActive()).toBe(false)
})

// A route of the (explore) group pushed over the reader: UIKit presents it as a sheet above
// both, Android pushes it as a page inside the stack.
it('lifts the reader over the stack under an iPad form sheet', () => {
  mockPlatform.OS = 'ios'
  mockPath = '/note'
  mockBasePath = '/'
  mockShowsStudy = false
  expect(readerZIndex()).toBe(1)
})
it('leaves an Android page pushed over the reader on top of it', () => {
  mockPlatform.OS = 'android'
  mockPath = '/note'
  mockBasePath = '/'
  mockShowsStudy = false
  expect(readerZIndex()).toBeUndefined()
})
