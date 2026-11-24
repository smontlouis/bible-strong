import {
  createAudioPlaylist,
  setAudioModeAsync,
  type AudioMetadata,
  type AudioPlaylist,
  type AudioPlaylistStatus,
} from 'expo-audio'
import { getDefaultStore } from 'jotai/vanilla'
import type { Book } from '~assets/bible_versions/books-desc'
import {
  audioRepeatAtom,
  audioSleepMinutesAtom,
  audioSleepTimeAtom,
  audioSpeedAtom,
  playingBibleTabIdAtom,
} from './atom'

export type BibleAudioTrack = {
  book: Book
  chapter: number
  url: string
  title: string
  artist?: string
}

// The lock screen needs an image address; the app icon bundled with the app has none in release builds.
const ARTWORK_URL = 'https://bible-strong.app/images/icon.png'

let playlist: AudioPlaylist | null = null
let tracks: BibleAudioTrack[] = []
let lockScreenActive = false
let wasPlaying = false

const getTrackMetadata = (index: number): AudioMetadata => {
  const track = tracks[index]
  return {
    title: track?.title,
    artist: track?.artist,
    artworkUrl: ARTWORK_URL,
  }
}

const resetSleepTimer = () => {
  const store = getDefaultStore()
  if (!store.get(audioSleepTimeAtom)) return
  store.set(audioSleepTimeAtom, 0)
  store.set(audioSleepMinutesAtom, 'off')
}

/**
 * Whether an update shows playback stopped by a pause rather than by the end of the queue or by
 * loading: the playlist has no paused state of its own. Read only on the update after one that played.
 */
export const isPausedUpdate = (status: AudioPlaylistStatus) =>
  !status.playing && status.isLoaded && !status.isBuffering && !status.didJustFinish

const onStatusUpdate = (status: AudioPlaylistStatus) => {
  const playedBefore = wasPlaying
  wasPlaying = status.playing

  const sleepTime = getDefaultStore().get(audioSleepTimeAtom)
  if (!sleepTime) return

  if (status.playing && Date.now() >= sleepTime) {
    playlist?.pause()
    resetSleepTimer()
    return
  }

  // A pause from the lock screen also cancels the timer, as a pause in the app does.
  if (playedBefore && isPausedUpdate(status)) resetSleepTimer()
}

/** The one playlist of the Bible audio, shared by every tab: only one chapter plays at a time. */
export const getBibleAudioPlaylist = (): AudioPlaylist => {
  if (!playlist) {
    const created = createAudioPlaylist({ updateInterval: 250 })
    created.addListener('playlistStatusUpdate', onStatusUpdate)
    created.addListener('trackChanged', ({ currentIndex }) => {
      if (lockScreenActive) created.updateLockScreenMetadata(getTrackMetadata(currentIndex))
    })
    playlist = created
  }
  return playlist
}

export const getBibleAudioTrack = (index: number): BibleAudioTrack | undefined => tracks[index]

/** Replaces the queue with the chapters of a book and stops on `startIndex`. */
export const loadBibleAudioTracks = (nextTracks: BibleAudioTrack[], startIndex: number) => {
  const player = getBibleAudioPlaylist()
  const store = getDefaultStore()

  player.clear()
  tracks = nextTracks
  nextTracks.forEach(track => player.add({ uri: track.url, name: track.title }))
  if (startIndex > 0 && startIndex < nextTracks.length) player.skipTo(startIndex)

  player.playbackRate = store.get(audioSpeedAtom) || 1
  player.loop = store.get(audioRepeatAtom) ? 'single' : 'none'
  // A new queue fires no track change when it starts on its first chapter.
  if (lockScreenActive) player.updateLockScreenMetadata(getTrackMetadata(player.currentIndex))
}

export const playBibleAudio = async () => {
  const player = getBibleAudioPlaylist()

  // Set on every play: the Strong words, the reading aloud and the dictation change the mode too.
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    // Lock screen controls only attach to an app that takes the audio focus.
    interruptionMode: 'doNotMix',
  })

  player.setActiveForLockScreen(true, getTrackMetadata(player.currentIndex), {
    showSeekForward: true,
    showSeekBackward: true,
    showNextTrack: true,
    showPreviousTrack: true,
  })
  lockScreenActive = true
  player.play()
}

export const pauseBibleAudio = () => {
  playlist?.pause()
  resetSleepTimer()
}

/** Stops the Bible audio, empties the queue and removes the lock screen controls. */
export const stopBibleAudio = () => {
  if (!playlist) return
  playlist.pause()
  playlist.clear()
  tracks = []
  if (lockScreenActive) {
    playlist.clearLockScreenControls()
    lockScreenActive = false
  }
  resetSleepTimer()
}

/** Pauses the Bible audio for another sound, such as the pronunciation of a Strong word. */
export const interruptBibleAudio = () => {
  if (!playlist?.playing) return
  pauseBibleAudio()
  getDefaultStore().set(playingBibleTabIdAtom, '')
}
