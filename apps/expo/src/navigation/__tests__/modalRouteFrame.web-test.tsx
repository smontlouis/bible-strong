import React, { useEffect } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import ModalRouteFrame from '../ModalRouteFrame.web'

let mockEnabled = true
jest.mock('~themes/ThemeProvider', () => ({ useTheme: () => ({ colors: { reverse: '#fff' } }) }))
jest.mock('../useWorkspaceRoutePanel', () => ({
  WORKSPACE_ROUTE_PANEL_WIDTH: 550,
  workspacePanelClosingAtom: jest.requireActual('jotai').atom(false),
  useWorkspaceRoutePanel: () => ({ enabled: mockEnabled }),
}))
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useGlobalSearchParams: () => ({}),
  useRouter: () => ({}),
  useNavigationContainerRef: () => ({}),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  TouchableBox: 'TouchableBox',
}))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))

it('preserves the nested navigator instance across responsive transitions', () => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  const mount = jest.fn()
  const unmount = jest.fn()
  function Navigator() {
    useEffect(() => {
      mount()
      return unmount
    }, [])
    return null
  }
  let renderer: ReactTestRenderer
  act(() => {
    renderer = create(
      <ModalRouteFrame>
        <Navigator />
      </ModalRouteFrame>
    )
  })
  for (const enabled of [false, true, false, true]) {
    mockEnabled = enabled
    act(() => {
      renderer!.update(
        <ModalRouteFrame>
          <Navigator />
        </ModalRouteFrame>
      )
    })
  }
  expect(mount).toHaveBeenCalledTimes(1)
  expect(unmount).not.toHaveBeenCalled()
  act(() => renderer!.unmount())
})
