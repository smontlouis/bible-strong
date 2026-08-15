import React from 'react'
import { act, create } from 'react-test-renderer'

import { canStartRemoteHydration, type AccountEntryClassification } from '~helpers/accountEntry'
import useInitFireAuth from '~helpers/useInitFireAuth'

const mockDispatch = jest.fn()
const mockResetAtoms = jest.fn()
const mockCreateBackupNow = jest.fn<Promise<boolean>, []>()
const mockInit = jest.fn()
const mockCreateGuestDataSnapshot = jest.fn()
const mockCreateGuestSnapshotImportData = jest.fn()
const mockRunPendingGuestAdoption = jest.fn()
const mockGetPending = jest.fn()
const mockGetPendingForUser = jest.fn()
const mockBeginAdoption = jest.fn()
const mockUpdateAdoptionSnapshot = jest.fn()
const mockToastWarning = jest.fn()
const guestState = { user: { id: '', bible: {} }, plan: { ongoingPlans: [] } }
const guestSnapshot = { schemaVersion: 1, id: 'snapshot-1' }

jest.mock('jotai/react', () => ({
  useSetAtom: () => mockResetAtoms,
}))

jest.mock('jotai/vanilla', () => ({
  getDefaultStore: () => ({ get: () => [] }),
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

jest.mock('~helpers/guestDataAdoption', () => ({
  createGuestDataSnapshot: (...args: unknown[]) => mockCreateGuestDataSnapshot(...args),
  createGuestSnapshotImportData: (...args: unknown[]) => mockCreateGuestSnapshotImportData(...args),
  runPendingGuestAdoption: (...args: unknown[]) => mockRunPendingGuestAdoption(...args),
}))

jest.mock('~helpers/guestDataAdoptionRuntime', () => ({
  firebaseGuestAdoptionRemote: {},
  guestAdoptionRepository: {
    getPending: () => mockGetPending(),
    getPendingForUser: (...args: unknown[]) => mockGetPendingForUser(...args),
    begin: (...args: unknown[]) => mockBeginAdoption(...args),
    updateSnapshot: (...args: unknown[]) => mockUpdateAdoptionSnapshot(...args),
  },
  getAuthenticatedUserId: () => 'user-1',
}))

jest.mock('~state/tabs', () => ({
  tabGroupsAtom: {},
}))

jest.mock('~helpers/agentObservability', () => ({
  appLogger: { info: jest.fn(), warn: jest.fn() },
}))

jest.mock('~helpers/toast', () => ({
  toast: { error: jest.fn(), warning: (...args: unknown[]) => mockToastWarning(...args) },
}))

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}))

jest.mock('~redux/modules/user', () => ({
  onUserLoginSuccess: (payload: unknown) => ({ type: 'user/login', payload }),
  onUserLogout: () => ({ type: 'user/logout' }),
  verifyEmail: () => ({ type: 'user/verify-email' }),
  importData: (payload: unknown) => ({ type: 'user/import-data', payload }),
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
    mockGetPending.mockReturnValue(undefined)
    mockGetPendingForUser.mockReturnValue(undefined)
    mockCreateGuestDataSnapshot.mockReturnValue(guestSnapshot)
    mockCreateGuestSnapshotImportData.mockReturnValue({
      bible: { bookmarks: { bookmark: {} } },
      studies: {},
      plan: [],
      tabGroups: [],
    })
    mockBeginAdoption.mockReturnValue({
      status: 'pending',
      userId: 'user-1',
      snapshot: guestSnapshot,
    })
    mockRunPendingGuestAdoption.mockResolvedValue({
      status: 'completed',
      snapshotId: 'snapshot-1',
      counts: {},
    })
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

    const onLogout = mockInit.mock.calls[0][2] as () => Promise<void>

    return { getState: () => state!, onLogin, onLogout }
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
    expect(mockRunPendingGuestAdoption).not.toHaveBeenCalled()
  })

  it('adopts a new account snapshot before opening hydration', async () => {
    mockCreateBackupNow.mockResolvedValue(true)
    const controller = await renderController()

    await act(async () => {
      await controller.onLogin({ profile, accountEntryClassification: 'new-account' })
    })

    expect(mockCreateGuestDataSnapshot).toHaveBeenCalledTimes(1)
    expect(mockBeginAdoption).toHaveBeenCalledWith('user-1', guestSnapshot)
    expect(mockRunPendingGuestAdoption).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' })
    )
    expect(controller.getState().phase).toBe('hydrating-account')
    expect(canStartRemoteHydration(controller.getState())).toBe(true)
  })

  it('does not use email verification status to decide adoption eligibility', async () => {
    mockCreateBackupNow.mockResolvedValue(true)
    const controller = await renderController()

    await act(async () => {
      await controller.onLogin({
        profile: { ...profile, emailVerified: false },
        accountEntryClassification: 'new-account',
      })
    })

    expect(mockBeginAdoption).toHaveBeenCalledWith('user-1', guestSnapshot)
    expect(mockRunPendingGuestAdoption).toHaveBeenCalledTimes(1)
    expect(controller.getState().phase).toBe('hydrating-account')
  })

  it('keeps local data gated and warns when adoption remains pending', async () => {
    mockCreateBackupNow.mockResolvedValue(true)
    mockRunPendingGuestAdoption.mockResolvedValue({
      status: 'pending',
      snapshotId: 'snapshot-1',
      errorCode: 'GUEST_ADOPTION_UNAVAILABLE',
    })
    const controller = await renderController()

    await act(async () => {
      await controller.onLogin({ profile, accountEntryClassification: 'new-account' })
    })

    expect(controller.getState()).toMatchObject({
      phase: 'recoverable-error',
      errorCode: 'GUEST_ADOPTION_UNAVAILABLE',
    })
    expect(canStartRemoteHydration(controller.getState())).toBe(false)
    expect(mockToastWarning).toHaveBeenCalledWith('accountEntry.adoptionPending')
  })

  it('journals edits made after a failed adoption before logout clears local state', async () => {
    mockCreateBackupNow.mockResolvedValue(true)
    const pending = {
      status: 'pending',
      userId: 'user-1',
      adoptionId: 'snapshot-1',
      snapshot: guestSnapshot,
    }
    mockBeginAdoption.mockReturnValue(pending)
    mockGetPendingForUser.mockReturnValueOnce(undefined).mockReturnValue(pending)
    mockRunPendingGuestAdoption.mockResolvedValue({
      status: 'pending',
      snapshotId: 'snapshot-1',
      errorCode: 'GUEST_ADOPTION_UNAVAILABLE',
    })
    const controller = await renderController()

    await act(async () => {
      await controller.onLogin({ profile, accountEntryClassification: 'new-account' })
      await controller.onLogout()
    })

    const adoptionOptions = mockRunPendingGuestAdoption.mock.calls[0][0]
    expect(adoptionOptions.getLatestSnapshot()).toBeUndefined()
    expect(mockUpdateAdoptionSnapshot).toHaveBeenCalledWith('user-1', 'snapshot-1', guestSnapshot)
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'user/logout' }))
  })

  it('resumes a pending snapshot for the same restored session', async () => {
    mockGetPendingForUser.mockReturnValue({
      status: 'pending',
      userId: 'user-1',
      snapshot: guestSnapshot,
    })
    const controller = await renderController()

    await act(async () => {
      await controller.onLogin({ profile, accountEntryClassification: 'restore-session' })
    })

    expect(mockCreateBackupNow).not.toHaveBeenCalled()
    expect(mockCreateGuestDataSnapshot).not.toHaveBeenCalled()
    expect(mockCreateGuestSnapshotImportData).not.toHaveBeenCalled()
    expect(mockRunPendingGuestAdoption).toHaveBeenCalledTimes(1)
    expect(controller.getState().phase).toBe('hydrating-account')
  })

  it('backs up a new guest session before restoring an older pending snapshot', async () => {
    mockCreateBackupNow.mockResolvedValue(true)
    mockGetPendingForUser.mockReturnValue({
      status: 'pending',
      userId: 'user-1',
      snapshot: guestSnapshot,
    })
    const controller = await renderController()

    await act(async () => {
      await controller.onLogin({ profile, accountEntryClassification: 'existing-account' })
    })

    expect(mockCreateBackupNow).toHaveBeenCalledTimes(1)
    expect(mockCreateGuestSnapshotImportData.mock.calls[0][0]).toBe(guestSnapshot)
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'user/import-data' }))
    expect(mockRunPendingGuestAdoption).toHaveBeenCalledTimes(1)
    expect(controller.getState().phase).toBe('hydrating-account')
  })

  it('never applies another account pending snapshot to an existing account', async () => {
    mockCreateBackupNow.mockResolvedValue(true)
    mockGetPending.mockReturnValue({
      status: 'pending',
      userId: 'user-a',
      snapshot: guestSnapshot,
    })
    const controller = await renderController()
    const existingProfile = { ...profile, id: 'user-b' }

    await act(async () => {
      await controller.onLogin({
        profile: existingProfile,
        accountEntryClassification: 'existing-account',
      })
    })

    expect(mockRunPendingGuestAdoption).not.toHaveBeenCalled()
    expect(controller.getState()).toMatchObject({
      phase: 'hydrating-account',
      userId: 'user-b',
    })
  })
})
