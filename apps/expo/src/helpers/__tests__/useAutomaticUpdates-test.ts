import { checkAndApplyAutomaticUpdate, createAutomaticUpdater } from '../useAutomaticUpdates'

jest.mock('expo-updates', () => ({
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}))
jest.mock('../agentObservability', () => ({ appLogger: { captureError: jest.fn() } }))
jest.mock('../runtimeConfig', () => ({ areAutomaticUpdatesEnabled: false }))
jest.mock('../toast', () => ({ toast: { info: jest.fn(), success: jest.fn() } }))
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }))

describe('checkAndApplyAutomaticUpdate', () => {
  const updateAvailableMessage = 'update available'
  const updateReadyMessage = 'update ready'

  const createOptions = (isAvailable: boolean, isRollBackToEmbedded = false) => {
    const updates = {
      checkForUpdateAsync: jest.fn().mockResolvedValue({ isAvailable, isRollBackToEmbedded }),
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

  it('fetches a rollback to the embedded JavaScript, which the check does not call available', async () => {
    const { options, updates, notifyReady } = createOptions(false, true)

    await expect(checkAndApplyAutomaticUpdate(options)).resolves.toBe(true)

    expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1)
    expect(notifyReady).toHaveBeenCalledWith(updateReadyMessage)
    expect(updates.reloadAsync).not.toHaveBeenCalled()
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

describe('createAutomaticUpdater', () => {
  const createOptions = () => {
    const updates = {
      checkForUpdateAsync: jest.fn().mockResolvedValue({ isAvailable: true }),
      fetchUpdateAsync: jest.fn().mockResolvedValue({ isNew: true }),
    }
    return {
      updates,
      updateAvailableMessage: 'update available',
      updateReadyMessage: 'update ready',
      notifyAvailable: jest.fn(),
      notifyReady: jest.fn(),
      onError: jest.fn(),
    }
  }

  it('tries again after a download cut short, announcing the update once', async () => {
    const options = createOptions()
    options.updates.fetchUpdateAsync
      .mockRejectedValueOnce(new Error('Failed to load all assets'))
      .mockResolvedValueOnce({ isNew: true })
    const update = createAutomaticUpdater()

    await update(options)
    expect(options.onError).toHaveBeenCalledTimes(1)
    expect(options.notifyReady).not.toHaveBeenCalled()

    const onRetry = jest.fn()
    await update({ ...options, onRetry })
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(options.updates.fetchUpdateAsync).toHaveBeenCalledTimes(2)
    expect(options.notifyAvailable).toHaveBeenCalledTimes(1)
    expect(options.notifyReady).toHaveBeenCalledTimes(1)
  })

  it('stops once the update is downloaded or none is available', async () => {
    const options = createOptions()
    const update = createAutomaticUpdater()

    await update(options)
    await update(options)

    expect(options.updates.checkForUpdateAsync).toHaveBeenCalledTimes(1)
  })

  it('ignores an attempt while another one runs', async () => {
    const options = createOptions()
    const update = createAutomaticUpdater()

    await Promise.all([update(options), update(options)])

    expect(options.updates.checkForUpdateAsync).toHaveBeenCalledTimes(1)
  })

  it('reports only the first failure of a launch', async () => {
    const options = createOptions()
    options.updates.checkForUpdateAsync.mockRejectedValue(new Error('offline'))
    const update = createAutomaticUpdater()

    await update(options)
    await update(options)

    expect(options.updates.checkForUpdateAsync).toHaveBeenCalledTimes(2)
    expect(options.onError).toHaveBeenCalledTimes(1)
  })
})
