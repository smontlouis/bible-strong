import { getDefaultStore } from 'jotai/vanilla'
import TrackPlayer, { Event } from 'react-native-track-player'
import { audioSleepTimeAtom } from '~features/bible/footer/atom'

export const PlaybackService = async function() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play())
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause())
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext())
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    TrackPlayer.skipToPrevious()
  )

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async () => {
    const position = await TrackPlayer.getPosition()
    return TrackPlayer.seekTo(position + 10)
  })
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async () => {
    const position = await TrackPlayer.getPosition()
    TrackPlayer.seekTo(position - 10)
  })
  TrackPlayer.addEventListener(Event.RemoteSeek, async ({ position }) => {
    TrackPlayer.seekTo(position)
  })

  TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, async d => {
    const defaultStore = getDefaultStore()

    // Stop playback if sleep timer is set and has expired
    if (defaultStore.get(audioSleepTimeAtom) > 0) {
      const sleepTime = defaultStore.get(audioSleepTimeAtom)
      const currentTime = Date.now()
      const timeElapsed = currentTime - sleepTime

      if (timeElapsed >= 0) {
        TrackPlayer.pause()
      }
    }
  })
}
