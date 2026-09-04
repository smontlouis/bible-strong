jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getPlaybackState: jest.fn(),
    setupPlayer: jest.fn(),
  },
}))

import { createTrackPlayerSetupGuard } from '../trackPlayerSetup'

describe('createTrackPlayerSetupGuard', () => {
  it('shares one setup call across concurrent consumers', async () => {
    const setupPlayer = jest.fn().mockResolvedValue(undefined)
    const getPlaybackState = jest.fn()
    const ensureSetup = createTrackPlayerSetupGuard({ setupPlayer, getPlaybackState } as never)

    await Promise.all([ensureSetup(), ensureSetup(), ensureSetup()])

    expect(setupPlayer).toHaveBeenCalledTimes(1)
    expect(getPlaybackState).not.toHaveBeenCalled()
  })

  it('accepts a player that was already initialized before the guard loaded', async () => {
    const setupPlayer = jest.fn().mockRejectedValue({
      code: 'player_already_initialized',
      message: 'already initialized',
    })
    const getPlaybackState = jest.fn().mockResolvedValue({ state: 'paused' })
    const ensureSetup = createTrackPlayerSetupGuard({ setupPlayer, getPlaybackState } as never)

    await expect(ensureSetup()).resolves.toBeUndefined()
    await expect(ensureSetup()).resolves.toBeUndefined()

    expect(setupPlayer).toHaveBeenCalledTimes(1)
    expect(getPlaybackState).toHaveBeenCalledTimes(1)
  })

  it('allows a retry after setup genuinely fails', async () => {
    const setupPlayer = jest
      .fn()
      .mockRejectedValueOnce(new Error('native setup failed'))
      .mockResolvedValueOnce(undefined)
    const getPlaybackState = jest.fn().mockRejectedValue(new Error('not initialized'))
    const ensureSetup = createTrackPlayerSetupGuard({ setupPlayer, getPlaybackState } as never)

    await expect(ensureSetup()).rejects.toThrow('native setup failed')
    await expect(ensureSetup()).resolves.toBeUndefined()

    expect(setupPlayer).toHaveBeenCalledTimes(2)
    expect(getPlaybackState).not.toHaveBeenCalled()
  })
})
