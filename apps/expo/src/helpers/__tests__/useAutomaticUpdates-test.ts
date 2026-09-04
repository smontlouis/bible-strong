import { checkAndApplyAutomaticUpdate } from '../useAutomaticUpdates'

jest.mock('expo-updates', () => ({
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}))
jest.mock('../agentObservability', () => ({ appLogger: { captureError: jest.fn() } }))
jest.mock('../runtimeConfig', () => ({ areAutomaticUpdatesEnabled: false }))
jest.mock('../toast', () => ({ toast: { info: jest.fn(), success: jest.fn() } }))

describe('checkAndApplyAutomaticUpdate', () => {
  const updateAvailableMessage = 'update available'
  const updateReadyMessage = 'update ready'

  const createOptions = (isAvailable: boolean) => {
    const updates = {
      checkForUpdateAsync: jest.fn().mockResolvedValue({ isAvailable }),
      fetchUpdateAsync: jest.fn().mockResolvedValue({ isNew: true }),
      reloadAsync: jest.fn().mockResolvedValue(undefined),
    }
    const notifyAvailable = jest.fn()
    const notifyReady = jest.fn()

    return {
      options: {
        updates,
        updateAvailableMessage,
        updateReadyMessage,
        notifyAvailable,
        notifyReady,
      },
      updates,
      notifyAvailable,
      notifyReady,
    }
  }

  it('announces and downloads an available update without reloading the app', async () => {
    const { options, updates, notifyAvailable, notifyReady } = createOptions(true)

    await expect(checkAndApplyAutomaticUpdate(options)).resolves.toBe(true)

    expect(notifyAvailable).toHaveBeenCalledWith(updateAvailableMessage)
    expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1)
    expect(notifyReady).toHaveBeenCalledWith(updateReadyMessage)
    expect(updates.reloadAsync).not.toHaveBeenCalled()
    expect(notifyAvailable.mock.invocationCallOrder[0]).toBeLessThan(
      updates.fetchUpdateAsync.mock.invocationCallOrder[0]
    )
    expect(updates.fetchUpdateAsync.mock.invocationCallOrder[0]).toBeLessThan(
      notifyReady.mock.invocationCallOrder[0]
    )
  })

  it('does nothing when no update is available', async () => {
    const { options, updates, notifyAvailable, notifyReady } = createOptions(false)

    await expect(checkAndApplyAutomaticUpdate(options)).resolves.toBe(false)

    expect(notifyAvailable).not.toHaveBeenCalled()
    expect(updates.fetchUpdateAsync).not.toHaveBeenCalled()
    expect(notifyReady).not.toHaveBeenCalled()
    expect(updates.reloadAsync).not.toHaveBeenCalled()
  })
})
