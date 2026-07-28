/* eslint-disable import/first */
const mockGetInfoAsync = jest.fn()
const mockMoveAsync = jest.fn()
const mockDeleteAsync = jest.fn()

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
  moveAsync: (...args: unknown[]) => mockMoveAsync(...args),
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}))

import {
  AtomicResourceFileRollbackError,
  installAtomicResourceFile,
  restoreOrphanedResourceBackup,
} from '../atomicResourceFile'

describe('atomic resource file recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('restores an orphaned backup when the destination is missing', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true })

    await restoreOrphanedResourceBackup('/resource.sqlite', '/resource.sqlite.backup')

    expect(mockMoveAsync).toHaveBeenCalledWith({
      from: '/resource.sqlite.backup',
      to: '/resource.sqlite',
    })
  })

  it('leaves the backup untouched when the destination exists', async () => {
    mockGetInfoAsync.mockResolvedValueOnce({ exists: true }).mockResolvedValueOnce({ exists: true })

    await restoreOrphanedResourceBackup('/resource.sqlite', '/resource.sqlite.backup')

    expect(mockMoveAsync).not.toHaveBeenCalled()
  })
})

describe('atomic resource file installation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('activates a validated candidate and removes the superseded copy', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true })
    const beforeSwap = jest.fn()
    const afterSwap = jest.fn()

    await installAtomicResourceFile({
      candidatePath: '/candidate.sqlite',
      destinationPath: '/resource.sqlite',
      beforeSwap,
      afterSwap,
    })

    expect(beforeSwap).toHaveBeenCalledTimes(1)
    expect(mockMoveAsync).toHaveBeenNthCalledWith(1, {
      from: '/resource.sqlite',
      to: '/resource.sqlite.backup',
    })
    expect(mockMoveAsync).toHaveBeenNthCalledWith(2, {
      from: '/candidate.sqlite',
      to: '/resource.sqlite',
    })
    expect(afterSwap).toHaveBeenCalledTimes(1)
    expect(mockDeleteAsync).toHaveBeenLastCalledWith('/resource.sqlite.backup', {
      idempotent: true,
    })
  })

  it('restores the previous working copy when post-activation validation fails', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: true })
    const failure = new Error('candidate-invalid')
    const beforeRollback = jest.fn()
    const afterRollback = jest.fn()

    await expect(
      installAtomicResourceFile({
        candidatePath: '/candidate.sqlite',
        destinationPath: '/resource.sqlite',
        afterSwap: () => {
          throw failure
        },
        beforeRollback,
        afterRollback,
      })
    ).rejects.toBe(failure)

    expect(beforeRollback).toHaveBeenCalledTimes(1)
    expect(mockDeleteAsync).toHaveBeenCalledWith('/resource.sqlite', { idempotent: true })
    expect(mockMoveAsync).toHaveBeenLastCalledWith({
      from: '/resource.sqlite.backup',
      to: '/resource.sqlite',
    })
    expect(afterRollback).toHaveBeenCalledTimes(1)
  })

  it('does not roll back a committed copy when stale-backup cleanup fails', async () => {
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true })
    mockDeleteAsync
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('cleanup-failed'))
    const afterSwap = jest.fn()

    await expect(
      installAtomicResourceFile({
        candidatePath: '/candidate.sqlite',
        destinationPath: '/resource.sqlite',
        afterSwap,
      })
    ).resolves.toBeUndefined()

    expect(afterSwap).toHaveBeenCalledTimes(1)
    expect(mockMoveAsync).toHaveBeenCalledTimes(2)
    warningSpy.mockRestore()
  })

  it('reopens the untouched copy when swapping the old destination fails', async () => {
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: true })
    const failure = new Error('swap-failed')
    mockMoveAsync.mockRejectedValueOnce(failure)
    const beforeRollback = jest.fn()
    const afterRollback = jest.fn()

    await expect(
      installAtomicResourceFile({
        candidatePath: '/candidate.sqlite',
        destinationPath: '/resource.sqlite',
        beforeRollback,
        afterRollback,
      })
    ).rejects.toBe(failure)

    expect(beforeRollback).toHaveBeenCalledTimes(1)
    expect(mockDeleteAsync).not.toHaveBeenCalledWith('/resource.sqlite', {
      idempotent: true,
    })
    expect(afterRollback).toHaveBeenCalledWith(true)
  })

  it('restores the backup even when a rollback hook fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: true })
    const activationFailure = new Error('candidate-invalid')
    const rollbackHookFailure = new Error('close-failed')

    const installation = installAtomicResourceFile({
      candidatePath: '/candidate.sqlite',
      destinationPath: '/resource.sqlite',
      afterSwap: () => {
        throw activationFailure
      },
      beforeRollback: () => {
        throw rollbackHookFailure
      },
    })

    await expect(installation).rejects.toEqual(
      expect.objectContaining({
        name: 'AtomicResourceFileRollbackError',
        originalError: activationFailure,
        rollbackErrors: [rollbackHookFailure],
      })
    )

    expect(mockMoveAsync).toHaveBeenLastCalledWith({
      from: '/resource.sqlite.backup',
      to: '/resource.sqlite',
    })
    errorSpy.mockRestore()
  })

  it('surfaces incomplete filesystem rollback for durable recovery', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    mockGetInfoAsync
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false })
    const activationFailure = new Error('candidate-invalid')
    const restoreFailure = new Error('restore-failed')
    mockMoveAsync
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(restoreFailure)

    const installation = installAtomicResourceFile({
      candidatePath: '/candidate.sqlite',
      destinationPath: '/resource.sqlite',
      afterSwap: () => {
        throw activationFailure
      },
    })

    await expect(installation).rejects.toBeInstanceOf(AtomicResourceFileRollbackError)
    await expect(installation).rejects.toMatchObject({
      originalError: activationFailure,
      rollbackErrors: [restoreFailure],
    })
    errorSpy.mockRestore()
  })
})
