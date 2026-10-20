import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'

import ProfileActions from '../ProfileActions'

const mockConfirm = jest.fn()
const mockLogout = jest.fn()

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }))
jest.mock('~common/ConfirmDialog/useConfirmDialog', () => ({
  useConfirmDialog: () => mockConfirm,
}))
jest.mock('~helpers/useLogin', () => ({
  __esModule: true,
  default: () => ({ user: { provider: 'password' }, logout: mockLogout }),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~common/ui/Box', () => ({ __esModule: true, default: 'Box' }))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'FeatherIcon' }))
jest.mock('~common/ui/ListSection', () => ({
  __esModule: true,
  default: 'ListSection',
  ListRow: 'ListRow',
}))
jest.mock('../ChangePasswordModal', () => ({ __esModule: true, default: () => null }))
jest.mock('../DeleteAccountModal', () => ({ __esModule: true, default: () => null }))

describe('ProfileActions logout', () => {
  let renderer: ReactTestRenderer

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    mockConfirm.mockReset()
    mockLogout.mockReset()
    act(() => {
      renderer = create(<ProfileActions />)
    })
  })

  afterEach(() => act(() => renderer.unmount()))

  const pressLogout = async () => {
    const action = renderer.root.find(
      item => String(item.type) === 'ListRow' && item.props.label === 'Se déconnecter'
    )
    await act(async () => action.props.onPress())
  }

  it('logs out after confirmation', async () => {
    mockConfirm.mockResolvedValue(true)
    await pressLogout()

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: 'Se déconnecter', destructive: true })
    )
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('keeps the session when confirmation is cancelled', async () => {
    mockConfirm.mockResolvedValue(false)
    await pressLogout()
    expect(mockLogout).not.toHaveBeenCalled()
  })
})
