import React from 'react'
import { act, create } from 'react-test-renderer'

import { canStartRemoteHydration, type AccountEntryClassification } from '~helpers/accountEntry'
import useInitFireAuth from '~helpers/useInitFireAuth'

const mockDispatch = jest.fn()
const mockResetAtoms = jest.fn()
const mockCreateBackupNow = jest.fn<Promise<boolean>, []>()
const mockInit = jest.fn()
const guestState = { user: { id: '', bible: {} }, plan: { ongoingPlans: [] } }

jest.mock('jotai/react', () => ({
  useSetAtom: () => mockResetAtoms,
}))

jest.mock('~state/app', () => ({
  resetUserAtomsAtom: {},
}))

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useStore: () => ({ getState: () => guestState }),
}))

jest.mock('~helpers/FireAuth', () => ({
  __esModule: true,
  default: {
    init: (...args: unknown[]) => mockInit(...args),
  },
}))

jest.mock('~helpers/AutoBackupManager', () => ({
  autoBackupManager: {
    createBackupNow: () => mockCreateBackupNow(),
  },
}))

jest.mock('~helpers/agentObservability', () => ({
  appLogger: { info: jest.fn() },
}))

jest.mock('~helpers/toast', () => ({
  toast: { error: jest.fn() },
}))

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}))

jest.mock('~redux/modules/user', () => ({
  onUserLoginSuccess: (payload: unknown) => ({ type: 'user/login', payload }),
  onUserLogout: () => ({ type: 'user/logout' }),
  verifyEmail: () => ({ type: 'user/verify-email' }),
}))

const profile = {
  id: 'user-1',
  email: 'user@example.com',
  displayName: 'User',
  photoURL: '',
  provider: 'password',
  emailVerified: true,
  createdAt: null,
}

describe('useInitFireAuth account-entry orchestration', () => {
  let consoleError: jest.SpyInstance
  let consoleLog: jest.SpyInstance

  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    jest.clearAllMocks()
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleError.mockRestore()
    consoleLog.mockRestore()
  })

  const renderController = async () => {
    let state: ReturnType<typeof useInitFireAuth>
    const Harness = () => {
      state = useInitFireAuth()
      return null
    }

    await act(async () => {
      create(<Harness />)
    })

    const onLogin = mockInit.mock.calls[0][0] as (payload: {
      profile: typeof profile
      accountEntryClassification: AccountEntryClassification
    }) => Promise<void>

    return { getState: () => state!, onLogin }
  }

  it('keeps an existing account gated until the safety backup settles', async () => {
    let finishBackup!: (completed: boolean) => void
    mockCreateBackupNow.mockImplementation(() => new Promise(resolve => (finishBackup = resolve)))
    const controller = await renderController()
    let login!: Promise<void>

    await act(async () => {
      login = controller.onLogin({
        profile,
        accountEntryClassification: 'existing-account',
      })
      await Promise.resolve()
    })

    expect(controller.getState().phase).toBe('backing-up-guest-data')
    expect(canStartRemoteHydration(controller.getState())).toBe(false)
    expect(mockCreateBackupNow).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishBackup(true)
      await login
    })

    expect(controller.getState().phase).toBe('hydrating-account')
    expect(canStartRemoteHydration(controller.getState())).toBe(true)
  })

  it('keeps a new account gated after backup while adoption is pending', async () => {
    mockCreateBackupNow.mockResolvedValue(true)
    const controller = await renderController()

    await act(async () => {
      await controller.onLogin({ profile, accountEntryClassification: 'new-account' })
    })

    expect(controller.getState().phase).toBe('adopting-guest-data')
    expect(canStartRemoteHydration(controller.getState())).toBe(false)
  })
})
