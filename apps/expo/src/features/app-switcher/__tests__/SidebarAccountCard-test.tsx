import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import SidebarAccountCard from '../SidebarAccountCard.web'

const mockPush = jest.fn()
const mockLogout = jest.fn()
const mockConfirm = jest.fn()
const mockInfo = jest.fn()
let mockIsLogged = true
jest.mock('~helpers/useLogin', () => ({
  __esModule: true,
  default: () => ({
    isLogged: mockIsLogged,
    user: { displayName: 'Reader' },
    logout: mockLogout,
  }),
}))
jest.mock('~navigation/usePushRouteOnce', () => ({ usePushRouteOnce: () => mockPush }))
jest.mock('~common/ConfirmDialog/useConfirmDialog', () => ({ useConfirmDialog: () => mockConfirm }))
jest.mock('~helpers/toast', () => ({
  toast: { info: (...args: unknown[]) => mockInfo(...args), error: jest.fn() },
}))
jest.mock('~common/ui/UserAvatar', () => 'img')
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'i' }))
jest.mock('~common/ui/Text', () => 'span')
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'div',
  HStack: 'div',
  TouchableBox: 'button',
}))
jest.mock('~common/ContextualPanel/PanelAction', () => 'a')
jest.mock('~common/ContextualPanel', () => ({
  __esModule: true,
  default: ({
    screens,
  }: {
    screens: Record<string, { content: (navigation: { close: () => void }) => React.ReactNode }>
  }) => screens.resources.content({ close: jest.fn() }),
}))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      primary: '#5983f0',
      secondary: '#ffb900',
      color2: '#ee6666',
      tertiary: '#667788',
      quint: '#445566',
    },
  }),
}))
jest.mock('~themes/colorValues', () => ({ colorWithOpacity: (color: string) => color }))
jest.mock('../utils/useResponsiveWorkspace', () => ({ WORKSPACE_SIDEBAR_WIDTH: 260 }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

let renderer: ReactTestRenderer
beforeEach(() => {
  jest.clearAllMocks()
  mockIsLogged = true
})
afterEach(() => act(() => renderer?.unmount()))
const renderCard = () =>
  act(() => {
    renderer = create(<SidebarAccountCard openSettings={jest.fn()} />)
  })

it('opens each of the six personal resource screens', () => {
  renderCard()
  const resources = renderer.root
    .findAllByType('button')
    .filter(button =>
      button
        .findAllByType('span')
        .some(text =>
          ['Surbrillances', 'Marque-pages', 'Notes', 'Études', 'Liens', 'Étiquettes'].includes(
            text.props.children
          )
        )
    )
  expect(resources).toHaveLength(6)
  resources.forEach(button => act(() => button.props.onPress()))
  expect(mockPush.mock.calls.map(([route]) => route.pathname)).toEqual([
    '/highlights',
    '/bookmarks',
    '/bible-verse-notes',
    '/studies',
    '/bible-verse-links',
    '/tags',
  ])
})

it('requires confirmation before signing out', async () => {
  renderCard()
  const signOut = renderer.root
    .findAllByType('a')
    .find(action => action.props.label === 'Se déconnecter')!
  mockConfirm.mockResolvedValueOnce(false)
  await act(async () => {
    signOut.props.onPress()
  })
  expect(mockLogout).not.toHaveBeenCalled()
  mockConfirm.mockResolvedValueOnce(true)
  await act(async () => {
    signOut.props.onPress()
  })
  expect(mockLogout).toHaveBeenCalledTimes(1)
})

it('keeps guest resources available while protecting studies and offering login', () => {
  mockIsLogged = false
  renderCard()
  expect(
    renderer.root.findAllByType('a').some(action => action.props.label === 'Se déconnecter')
  ).toBe(false)
  const studies = renderer.root
    .findAllByType('button')
    .find(button => button.findAllByType('span').some(text => text.props.children === 'Études'))!
  act(() => studies.props.onPress())
  expect(mockInfo).toHaveBeenCalledWith('study.loginRequired')
  expect(mockPush).not.toHaveBeenCalled()
  const login = renderer.root
    .findAllByType('a')
    .find(action => action.props.label === 'Se connecter')!
  act(() => login.props.onPress())
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/login' })
})
