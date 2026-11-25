import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import { getDefaultStore } from 'jotai/vanilla'
import {
  backgroundMusicStateAtom,
  bibleAudioMusicAtom,
  bibleAudioStateAtom,
  type BackgroundMusicVolume,
} from './atoms'
import {
  bibleAudioCatalogAtom,
  getBackgroundMusic,
  getMusicName,
  getRecording,
  passageHasMusic,
} from './audioCatalog'
import type { BibleAudioState } from './types'

/**
 * The background music (ADR-0117): a player of its own, apart from the Bible audio, which the
 * reader plays and pauses by its own button, to read, pray or listen. While the Bible audio speaks
 * it fades down under the voice, and back up when the voice stops; under a chapter that already
 * has music it fades out.
 */

const store = getDefaultStore()

/** The music alone; under a voice it plays at `UNDER_VOICE` of this. */
export const MUSIC_VOLUMES: Record<BackgroundMusicVolume, number> = {
  low: 0.35,
  medium: 0.6,
  high: 0.9,
}
export const UNDER_VOICE = 0.45
const FADE_MS = 900
const FADE_STEP_MS = 50

/** Whether the Bible audio is speaking, or about to, so that the music makes room for it. */
const isVoiceActive = (state: BibleAudioState) =>
  !!state.passage && (state.status === 'playing' || state.status === 'loading')

/** How loud the music should be now, from 0 (silent and paused) to its volume alone. */
export const getMusicTargetVolume = (
  isOn: boolean,
  volume: number,
  state: BibleAudioState,
  chapterHasMusic: boolean
) => {
  if (!isOn) return 0
  if (!isVoiceActive(state)) return volume
  return chapterHasMusic ? 0 : volume * UNDER_VOICE
}

let player: AudioPlayer | null = null
let loadedUrl: string | undefined
let currentVolume = 0
let fadeTimer: ReturnType<typeof setInterval> | undefined
let ownsLockScreen = false
let audioModeSet = false
// Set while this module pauses the player itself, so that its status is not taken for the lock screen's.
let pausingOnPurpose = false

const pausePlayer = () => {
  if (!player?.playing) return
  pausingOnPurpose = true
  player.pause()
  setTimeout(() => {
    pausingOnPurpose = false
  }, 500)
}

const fadeTo = (target: number) => {
  clearInterval(fadeTimer)
  if (!player) return
  const fadingPlayer = player
  if (target > 0 && !fadingPlayer.playing) fadingPlayer.play()
  const from = currentVolume
  const steps = Math.max(1, Math.round(FADE_MS / FADE_STEP_MS))
  let step = 0
  fadeTimer = setInterval(() => {
    step += 1
    currentVolume = from + ((target - from) * step) / steps
    fadingPlayer.volume = currentVolume
    if (step < steps) return
    clearInterval(fadeTimer)
    if (target === 0) pausePlayer()
  }, FADE_STEP_MS)
}

const ensurePlayer = () => {
  if (player) return player
  player = createAudioPlayer(null)
  player.volume = 0
  // A pause from the lock screen or the control centre pauses the music for the reader too.
  player.addListener('playbackStatusUpdate', status => {
    if (pausingOnPurpose || !status.isLoaded || status.playing || status.isBuffering) return
    if (store.get(backgroundMusicStateAtom) === 'playing' && currentVolume > 0)
      store.set(backgroundMusicStateAtom, 'paused')
  })
  return player
}

const sync = () => {
  const musicState = store.get(backgroundMusicStateAtom)
  const choice = store.get(bibleAudioMusicAtom)
  const piece = getBackgroundMusic(choice.id)
  const state = store.get(bibleAudioStateAtom)
  const recording = state.source === 'recorded' ? getRecording(state.recordingId) : undefined
  const isOn = musicState === 'playing' && !!piece

  if (!isOn) {
    fadeTo(0)
  } else {
    const musicPlayer = ensurePlayer()
    if (!audioModeSet) {
      audioModeSet = true
      void setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      })
    }
    if (loadedUrl !== piece.url) {
      musicPlayer.replace({ uri: piece.url })
      loadedUrl = piece.url
      // A new source starts at full volume on the web: it takes the fade's.
      musicPlayer.volume = currentVolume
    }
    // On the web, a new source is a new media element, which forgets the loop.
    musicPlayer.loop = true
    fadeTo(
      getMusicTargetVolume(
        true,
        MUSIC_VOLUMES[choice.volume] ?? MUSIC_VOLUMES.medium,
        state,
        !!state.passage && passageHasMusic(state.passage, recording)
      )
    )
  }

  // The lock screen shows the music while no Bible passage is loaded; the Bible's player takes it back.
  const shouldOwnLockScreen = musicState !== 'off' && !!piece && !state.passage
  if (player && shouldOwnLockScreen !== ownsLockScreen) {
    ownsLockScreen = shouldOwnLockScreen
    player.setActiveForLockScreen(
      shouldOwnLockScreen,
      shouldOwnLockScreen ? { title: getMusicName(piece), artist: 'Bible Strong' } : undefined
    )
  } else if (player && ownsLockScreen && piece) {
    player.updateLockScreenMetadata({ title: getMusicName(piece), artist: 'Bible Strong' })
  }
}

let watching = false

/** Follows the music's state, the reader's choice, the Bible audio and the catalog. */
export const watchBackgroundMusic = () => {
  if (watching) return
  watching = true
  store.sub(backgroundMusicStateAtom, sync)
  store.sub(bibleAudioMusicAtom, sync)
  store.sub(bibleAudioStateAtom, sync)
  store.sub(bibleAudioCatalogAtom, sync)
}

const firstPieceId = () => store.get(bibleAudioCatalogAtom).music?.[0]?.id ?? null

/** Plays the music last chosen, or the first of the catalog. */
export const playMusic = () => {
  watchBackgroundMusic()
  const choice = store.get(bibleAudioMusicAtom)
  if (!getBackgroundMusic(choice.id))
    store.set(bibleAudioMusicAtom, { ...choice, id: firstPieceId() })
  store.set(backgroundMusicStateAtom, 'playing')
}

export const pauseMusic = () => store.set(backgroundMusicStateAtom, 'paused')

export const toggleMusic = () =>
  store.get(backgroundMusicStateAtom) === 'playing' ? pauseMusic() : playMusic()

/** Stops the music and hides it from the small player. */
export const closeMusic = () => store.set(backgroundMusicStateAtom, 'off')

/** Plays a piece of the catalog. */
export const chooseMusic = (id: string) => {
  store.set(bibleAudioMusicAtom, { ...store.get(bibleAudioMusicAtom), id })
  playMusic()
}

/** The piece before or after in the catalog, round the list. */
export const stepMusic = (direction: -1 | 1) => {
  const pieces = store.get(bibleAudioCatalogAtom).music ?? []
  if (!pieces.length) return
  const index = pieces.findIndex(piece => piece.id === store.get(bibleAudioMusicAtom).id)
  const next = pieces[(index + direction + pieces.length) % pieces.length]!
  chooseMusic(next.id)
}

export const setMusicVolume = (volume: BackgroundMusicVolume) =>
  store.set(bibleAudioMusicAtom, { ...store.get(bibleAudioMusicAtom), volume })
