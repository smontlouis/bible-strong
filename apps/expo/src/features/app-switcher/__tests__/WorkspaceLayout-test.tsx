import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import WorkspaceLayout from '../WorkspaceLayout'
import WorkspaceSidebar from '../WorkspaceSidebar'

let mockPath = '/note'
let mockShowsStudy = true
jest.mock('expo-router', () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  useWindowDimensions: () => ({ width: 1600 }),
}))
jest.mock('jotai', () => ({ useAtom: () => [false, jest.fn()], useSetAtom: () => jest.fn() }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~navigation/pageTransition', () => ({
  finishPageTransition: jest.fn(),
  navigateWithPageTransition: jest.fn(),
}))
jest.mock('~navigation/useWorkspaceRoutePanel', () => ({
  useWorkspaceRoutePanel: () => ({
    open: true,
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
}))

function sidebarIsActive() {
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
  const active = view!.root.findByType(WorkspaceSidebar).props.isContentActive
  act(() => view!.unmount())
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
  else Reflect.deleteProperty(globalThis, 'document')
  return active
}

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
