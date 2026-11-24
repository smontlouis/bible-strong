import {
  createAudioPlaylist,
  setAudioModeAsync,
  type AudioMetadata,
  type AudioPlaylist,
  type AudioPlaylistStatus,
} from 'expo-audio'
import { getDefaultStore } from 'jotai/vanilla'
import i18n from '~i18n'
import { getAvailableChapters } from '~helpers/bibleCoverage'
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { audioRepeatAtom, audioSpeedAtom } from './atoms'
import {
  getRecordingName,
  getRecordingUrl,
  getVersionName,
  type BibleAudioRecording,
} from './audioCatalog'
import type {
  BibleAudioEngine,
  BibleAudioEngineEvents,
  BibleAudioPassage,
  BibleAudioStatus,
} from './types'

// The lock screen needs an image address; the app icon bundled with the app has none in release builds.
const ARTWORK_URL = 'https://bible-strong.app/images/icon.png'

// The iOS playlist reports no load error: a chapter that does not start this long after the
// request counts as one.
const LOAD_TIMEOUT_MS = 20_000

// Past the end, the iOS player stalls instead of finishing the chapter.
const END_MARGIN_SECONDS = 0.5

const SKIP_SECONDS = 10

type RecordedTrack = {
  chapter: number
  url: string
  title: string
  artist?: string
}

export const getRecordedTracks = (
  passage: BibleAudioPassage,
  recording: BibleAudioRecording,
  coverage?: BibleVersionCoverage
): RecordedTrack[] => {
  const artist = `${getVersionName(passage.version)} · ${getRecordingName(recording)}`
  return getAvailableChapters(passage.book, coverage).flatMap(chapter => {
    const url = getRecordingUrl(recording, passage.book.Numero, chapter)
    return url
      ? [
          {
            chapter,
            url,
            title: `${i18n.t(passage.book.Nom)} ${chapter} ${passage.version}`,
            artist,
          },
        ]
      : []
  })
}

/**
 * Whether an update shows playback stopped by a pause rather than by the end of the queue or by
 * loading: the playlist has no paused state of its own.
 */
export const isPausedUpdate = (status: AudioPlaylistStatus) =>
  !status.playing && status.isLoaded && !status.isBuffering && !status.didJustFinish

/**
 * The recordings of a version, one book at a time in an expo-audio playlist: the chapters follow
 * each other natively, and the lock screen and the notification drive them.
 */
export const createRecordedEngine = (
  events: BibleAudioEngineEvents,
  loadCoverage: (version: string) => Promise<BibleVersionCoverage | undefined>
): BibleAudioEngine => {
  let playlist: AudioPlaylist | null = null
  let tracks: RecordedTrack[] = []
  let loadedBook: { recording: string; book: number } | null = null
  let lockScreenActive = false
  // Playback asked for and not paused since; the playlist has no such state.
  let wantsPlayback = false
  let wasPlaying = false
  let loadTimeout: ReturnType<typeof setTimeout> | undefined
  let status: BibleAudioStatus = 'idle'

  const setStatus = (next: BibleAudioStatus) => {
    if (next === status) return
    status = next
    if (next !== 'loading') clearTimeout(loadTimeout)
    events.onStatus(next)
  }

  const startLoading = () => {
    setStatus('loading')
    clearTimeout(loadTimeout)
    loadTimeout = setTimeout(() => {
      console.warn('[Bible audio] The current track did not start.')
      wantsPlayback = false
      setStatus('error')
    }, LOAD_TIMEOUT_MS)
  }

  const getMetadata = (index: number): AudioMetadata => ({
    title: tracks[index]?.title,
    artist: tracks[index]?.artist,
    artworkUrl: ARTWORK_URL,
  })

  const onStatusUpdate = (update: AudioPlaylistStatus) => {
    const playedBefore = wasPlaying
    wasPlaying = update.playing

    events.onProgress({
      kind: 'time',
      position: update.currentTime,
      duration: update.duration,
    })

    // Android reports a failed load in a single status update, which the next one forgets.
    if ((update as typeof update & { error?: unknown }).error) {
      console.warn('[Bible audio] An error occured while playing the current track.')
      wantsPlayback = false
      setStatus('error')
      return
    }
    if (update.didJustFinish) {
      // The last chapter of the queue ended: the iOS queue is then empty and reports itself
      // buffering. The player decides what comes next.
      wantsPlayback = false
      setStatus('ended')
      events.onEnded()
      return
    }
    if (update.playing) {
      setStatus('playing')
      return
    }
    if (playedBefore && isPausedUpdate(update)) {
      // Paused from the lock screen, the notification or another app taking the sound.
      wantsPlayback = false
      setStatus('paused')
      return
    }
    if (wantsPlayback) {
      if (status !== 'loading') startLoading()
      return
    }
    if (status === 'playing' || status === 'loading') setStatus('paused')
  }

  const getPlaylist = () => {
    if (!playlist) {
      const created = createAudioPlaylist({ updateInterval: 250 })
      created.addListener('playlistStatusUpdate', onStatusUpdate)
      created.addListener('trackChanged', ({ currentIndex }) => {
        if (lockScreenActive) created.updateLockScreenMetadata(getMetadata(currentIndex))
        const track = tracks[currentIndex]
        if (track) events.onChapterChange(track.chapter)
      })
      // Speed and repeat chips change the playlist that plays, whichever screen holds them.
      const store = getDefaultStore()
      store.sub(audioSpeedAtom, () => {
        created.playbackRate = store.get(audioSpeedAtom) || 1
      })
      store.sub(audioRepeatAtom, () => {
        created.loop = store.get(audioRepeatAtom) ? 'single' : 'none'
      })
      playlist = created
    }
    return playlist
  }

  const open = async (passage: BibleAudioPassage, recording: BibleAudioRecording | null) => {
    if (!recording) throw new Error(`No recording given for ${passage.version}`)
    const player = getPlaylist()
    const isSameBook =
      loadedBook?.recording === recording.id && loadedBook.book === passage.book.Numero

    if (!isSameBook) {
      const coverage = await loadCoverage(passage.version).catch(() => undefined)
      const nextTracks = getRecordedTracks(passage, recording, coverage)
      player.clear()
      tracks = nextTracks
      loadedBook = { recording: recording.id, book: passage.book.Numero }
      nextTracks.forEach(track => player.add({ uri: track.url, name: track.title }))
    }

    const index = tracks.findIndex(track => track.chapter === passage.chapter)
    if (index === -1) {
      throw new Error(`No recording for ${recording.id} ${passage.book.Numero}:${passage.chapter}`)
    }
    if (index !== player.currentIndex) player.skipTo(index)

    const store = getDefaultStore()
    player.playbackRate = store.get(audioSpeedAtom) || 1
    player.loop = store.get(audioRepeatAtom) ? 'single' : 'none'
    // A new queue fires no track change when it starts on its first chapter.
    if (lockScreenActive) player.updateLockScreenMetadata(getMetadata(index))
    if (status === 'ended' || status === 'error') setStatus('paused')
  }

  const play = async () => {
    const player = getPlaylist()
    wantsPlayback = true
    if (!player.playing) startLoading()

    // Set on every play: the Strong words, the reading aloud and the dictation change the mode too.
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // Lock screen controls only attach to an app that takes the audio focus.
      interruptionMode: 'doNotMix',
    })

    if (lockScreenActive) {
      player.updateLockScreenMetadata(getMetadata(player.currentIndex))
    } else {
      // Once only: on Android a second call rebuilds the media session, which stops the player.
      player.setActiveForLockScreen(true, getMetadata(player.currentIndex), {
        showSeekForward: true,
        showSeekBackward: true,
        showNextTrack: true,
        showPreviousTrack: true,
      })
      lockScreenActive = true
    }
    player.play()
  }

  const pause = () => {
    wantsPlayback = false
    playlist?.pause()
    if (status === 'playing' || status === 'loading') setStatus('paused')
  }

  const stop = () => {
    wantsPlayback = false
    clearTimeout(loadTimeout)
    if (!playlist) return
    playlist.pause()
    playlist.clear()
    tracks = []
    loadedBook = null
    if (lockScreenActive) {
      playlist.clearLockScreenControls()
      lockScreenActive = false
    }
    status = 'idle'
  }

  const seekToTime = (player: AudioPlaylist, seconds: number) => {
    const end =
      player.duration > 0 ? player.duration - END_MARGIN_SECONDS : Number.POSITIVE_INFINITY
    void player.seekTo(Math.max(0, Math.min(seconds, end)))
  }

  const skip = (direction: -1 | 1) => {
    if (!playlist) return
    // Read live: quick taps would otherwise all start from the last rendered position.
    seekToTime(playlist, playlist.currentTime + direction * SKIP_SECONDS)
  }

  const seekTo = (ratio: number) => {
    if (!playlist || !(playlist.duration > 0)) return
    seekToTime(playlist, ratio * playlist.duration)
  }

  return { source: 'recorded', open, play, pause, stop, skip, seekTo }
}
