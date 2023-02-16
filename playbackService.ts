import TrackPlayer, { Event } from 'react-native-track-player'

export const PlaybackService = async function() {
  try {
    await TrackPlayer.setupPlayer()
  } catch {
    console.log('Player already setup')
  }

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
}
