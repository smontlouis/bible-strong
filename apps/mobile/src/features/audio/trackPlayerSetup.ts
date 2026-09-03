import TrackPlayer from 'react-native-track-player'

type TrackPlayerSetupAdapter = Pick<typeof TrackPlayer, 'getPlaybackState' | 'setupPlayer'>

const isAlreadyInitializedError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'player_already_initialized'

export const createTrackPlayerSetupGuard = (player: TrackPlayerSetupAdapter) => {
  let setupPromise: Promise<void> | undefined

  return () => {
    if (!setupPromise) {
      setupPromise = (async () => {
        try {
          await player.setupPlayer()
        } catch (setupError) {
          if (!isAlreadyInitializedError(setupError)) {
            setupPromise = undefined
            throw setupError
          }
          try {
            await player.getPlaybackState()
          } catch {
            setupPromise = undefined
            throw setupError
          }
        }
      })()
    }

    return setupPromise
  }
}

export const ensureTrackPlayerSetup = createTrackPlayerSetupGuard(TrackPlayer)
