import React from 'react'
import { act, create } from 'react-test-renderer'

import type { RootState } from '~redux/modules/reducer'
import type {
  AppMigrationOrchestrator,
  MigrationSnapshot,
} from '../../migrations/appMigrationOrchestrator'
import type { AccountMigrationContext } from '../../migrations/accountMigrationRegistry'
import { useAccountMigrations } from '../useAccountMigrations'

const mockSetAccountMigrationInProgress = jest.fn()
const mockSetAccountMigrationWriteScope = jest.fn()

jest.mock('~state/migration', () => ({
  setAccountMigrationInProgress: (running: boolean) => mockSetAccountMigrationInProgress(running),
  setAccountMigrationWriteScope: (...args: [userId?: string, mode?: 'ready' | 'outgoing-only']) =>
    mockSetAccountMigrationWriteScope(...args),
}))

jest.mock('../../migrations/accountMigrationMutationJournal', () => ({
  clearAccountMigrationMutationJournal: jest.fn(),
}))

jest.mock('../../migrations/accountMigrationRuntime', () => ({
  accountMigrationOrchestrator: {},
}))

const state = { user: { id: 'user-1' } } as RootState

const failedSnapshot: Exclude<MigrationSnapshot, { status: 'idle' }> = {
  status: 'failed',
  migrationId: 'firestore-embedded-user-data',
  migrationVersion: 1,
  plan: {
    steps: [{ id: 'migrate', label: 'migration.account.embedded.step' }],
  },
  completedStepIds: [],
  completedCleanupStepIds: [],
  currentStepId: 'migrate',
  errorCode: 'FIRESTORE_EMBEDDED_DATA_MIGRATION_FAILED',
  isResuming: true,
}

describe('useAccountMigrations', () => {
  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const renderController = async (
    orchestrator: AppMigrationOrchestrator<AccountMigrationContext>,
    onWriteScopeOpened?: () => Promise<void>
  ) => {
    let controller: ReturnType<typeof useAccountMigrations>
    const Harness = () => {
      controller = useAccountMigrations({
        activeUserId: 'user-1',
        orchestrator,
        onWriteScopeOpened,
      })
      return null
    }
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    await act(async () => {
      create(<Harness />)
    })
    consoleError.mockRestore()
    return () => controller!
  }

  it('continues local app sync only after an explicit decision on account migration failure', async () => {
    const orchestrator: AppMigrationOrchestrator<AccountMigrationContext> = {
      inspect: jest.fn(async () => failedSnapshot),
      run: jest.fn(),
      abandon: jest.fn(),
    }
    const getController = await renderController(orchestrator)
    let ready = true

    await act(async () => {
      ready = await getController().runBeforeSync('user-1', state)
    })
    expect(ready).toBe(false)
    expect(getController().presentation).toMatchObject({
      kind: 'failed',
      errorCode: 'FIRESTORE_EMBEDDED_DATA_MIGRATION_FAILED',
    })
    expect(getController().isAccountSyncReady).toBe(false)
    expect(mockSetAccountMigrationWriteScope).not.toHaveBeenCalledWith('user-1')

    act(() => getController().continueAfterFailure())

    await act(async () => {
      ready = await getController().runBeforeSync('user-1', state)
    })
    expect(ready).toBe(false)
    expect(getController().presentation).toEqual({ kind: 'hidden' })
    expect(getController().resumeToken).toBe(0)
    expect(getController().isAccountSyncReady).toBe(false)
    expect(mockSetAccountMigrationWriteScope).toHaveBeenLastCalledWith('user-1', 'outgoing-only')
  })

  it('opens outgoing sync only after a clean account inspection for the active UID', async () => {
    const orchestrator: AppMigrationOrchestrator<AccountMigrationContext> = {
      inspect: jest.fn(
        async (): Promise<MigrationSnapshot> => ({ status: 'idle', isResuming: false })
      ),
      run: jest.fn(),
      abandon: jest.fn(),
    }
    const getController = await renderController(orchestrator)

    await act(async () => {
      await expect(getController().runBeforeSync('user-1', state)).resolves.toBe(true)
    })

    expect(getController().presentation).toEqual({ kind: 'hidden' })
    expect(getController().isAccountSyncReady).toBe(true)
    expect(mockSetAccountMigrationWriteScope).toHaveBeenLastCalledWith('user-1')
  })

  it('replays gated startup work after opening writes and before enabling incoming sync', async () => {
    const orchestrator: AppMigrationOrchestrator<AccountMigrationContext> = {
      inspect: jest.fn(
        async (): Promise<MigrationSnapshot> => ({ status: 'idle', isResuming: false })
      ),
      run: jest.fn(),
      abandon: jest.fn(),
    }
    let releaseReplay = () => {}
    const replayPending = new Promise<void>(resolve => {
      releaseReplay = resolve
    })
    const onWriteScopeOpened = jest.fn(async () => replayPending)
    const getController = await renderController(orchestrator, onWriteScopeOpened)

    let inspection: Promise<boolean>
    await act(async () => {
      inspection = getController().runBeforeSync('user-1', state)
      await Promise.resolve()
    })

    expect(mockSetAccountMigrationWriteScope).toHaveBeenLastCalledWith('user-1')
    expect(onWriteScopeOpened).toHaveBeenCalledTimes(1)
    expect(getController().isAccountSyncReady).toBe(false)

    await act(async () => {
      releaseReplay()
      await expect(inspection!).resolves.toBe(true)
    })
    expect(getController().isAccountSyncReady).toBe(true)
  })

  it('surfaces an initial inspection failure so sync is never disabled silently', async () => {
    const orchestrator: AppMigrationOrchestrator<AccountMigrationContext> = {
      inspect: jest.fn(async () => {
        throw new Error('offline')
      }),
      run: jest.fn(),
      abandon: jest.fn(),
    }
    const getController = await renderController(orchestrator)

    await act(async () => {
      await expect(getController().runBeforeSync('user-1', state)).resolves.toBe(false)
    })

    expect(getController().presentation).toEqual({
      kind: 'failed',
      errorCode: 'APP_MIGRATION_ACCOUNT_INSPECTION_FAILED',
    })
    expect(getController().isAccountSyncReady).toBe(false)
  })

  it('does not reuse account readiness across a direct UID replacement', async () => {
    const orchestrator: AppMigrationOrchestrator<AccountMigrationContext> = {
      inspect: jest.fn(
        async (): Promise<MigrationSnapshot> => ({ status: 'idle', isResuming: false })
      ),
      run: jest.fn(),
      abandon: jest.fn(),
    }
    let controller: ReturnType<typeof useAccountMigrations>
    const Harness = ({ userId }: { userId: string }) => {
      controller = useAccountMigrations({ activeUserId: userId, orchestrator })
      return null
    }
    let renderer: ReturnType<typeof create>
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    await act(async () => {
      renderer = create(<Harness userId="user-a" />)
    })
    consoleError.mockRestore()
    await act(async () => {
      await controller!.runBeforeSync('user-a', state)
    })
    expect(controller!.isAccountSyncReady).toBe(true)

    await act(async () => {
      renderer!.update(<Harness userId="user-b" />)
    })
    expect(controller!.isAccountSyncReady).toBe(false)

    await act(async () => {
      await controller!.runBeforeSync('user-b', state)
    })
    expect(orchestrator.inspect).toHaveBeenCalledTimes(2)
    expect(mockSetAccountMigrationWriteScope).toHaveBeenLastCalledWith('user-b')
  })

  it('retries a persisted failure and signals live listeners after terminal completion', async () => {
    const completed = { ...failedSnapshot, status: 'completed', errorCode: undefined } as Exclude<
      MigrationSnapshot,
      { status: 'idle' }
    >
    const orchestrator: AppMigrationOrchestrator<AccountMigrationContext> = {
      inspect: jest
        .fn<Promise<MigrationSnapshot>, [AccountMigrationContext]>()
        .mockResolvedValueOnce(failedSnapshot)
        .mockResolvedValueOnce(failedSnapshot)
        .mockResolvedValueOnce({ status: 'idle', isResuming: false }),
      run: jest.fn(async (_context, onChange) => {
        onChange?.(completed)
        return completed
      }),
      abandon: jest.fn(),
    }
    const getController = await renderController(orchestrator)

    await act(async () => {
      await getController().runBeforeSync('user-1', state)
    })
    await act(async () => {
      await getController().retry()
    })

    expect(orchestrator.run).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      expect.any(Function)
    )
    expect(getController().presentation).toEqual({ kind: 'hidden' })
    expect(getController().resumeToken).toBe(1)
    expect(getController().isAccountSyncReady).toBe(true)
    expect(mockSetAccountMigrationInProgress).toHaveBeenLastCalledWith(false)
    expect(mockSetAccountMigrationWriteScope).toHaveBeenLastCalledWith('user-1')

    const inspectionCount = jest.mocked(orchestrator.inspect).mock.calls.length
    await expect(getController().runBeforeSync('user-1', state)).resolves.toBe(true)
    expect(orchestrator.inspect).toHaveBeenCalledTimes(inspectionCount)
  })
})
