import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { getDefaultStore } from 'jotai/vanilla'
import { bibleAudioMusicAtom, bibleAudioStateAtom, type BackgroundMusicVolume } from './atoms'
import {
  bibleAudioCatalogAtom,
  getBackgroundMusic,
  getRecording,
  passageHasMusic,
} from './audioCatalog'
import type { BibleAudioState } from './types'

/**
 * The background music the reader chose, looped under the voice (ADR-0117), with a recording or
 * the device's voice alike. It plays while the passage plays and pauses with it; a chapter that
 * already has music under its voice gets none.
 */

const store = getDefaultStore()

export const MUSIC_VOLUMES: Record<BackgroundMusicVolume, number> = {
  low: 0.2,
  medium: 0.35,
  high: 0.55,
}

/**
 * The address of the music to hear now, or nothing. A passage that is loading keeps the music
 * already playing, so that it flows on from one chapter to the next.
 */
export const getWantedMusicUrl = (
  state: BibleAudioState,
  musicUrl: string | undefined,
  isPlayingNow: boolean,
  hasMusicAlready: boolean
) => {
  if (!musicUrl || !state.passage || hasMusicAlready) return undefined
  if (state.status === 'playing') return musicUrl
  return state.status === 'loading' && isPlayingNow ? musicUrl : undefined
}

let player: AudioPlayer | null = null
let loadedUrl: string | undefined

const sync = () => {
  const state = store.get(bibleAudioStateAtom)
  const choice = store.get(bibleAudioMusicAtom)
  const recording = state.source === 'recorded' ? getRecording(state.recordingId) : undefined
  const url = getWantedMusicUrl(
    state,
    getBackgroundMusic(choice.id)?.url,
    !!player?.playing,
    !!state.passage && passageHasMusic(state.passage, recording)
  )
  if (!url) {
    player?.pause()
    return
  }
  if (!player) player = createAudioPlayer(null)
  if (loadedUrl !== url) {
    player.replace({ uri: url })
    loadedUrl = url
  }
  // On the web, a new source is a new media element, which forgets the loop.
  player.loop = true
  player.volume = MUSIC_VOLUMES[choice.volume] ?? MUSIC_VOLUMES.medium
  if (!player.playing) player.play()
}

let watching = false

/** Follows the player, the reader's choice and the catalog, from the first listening on. */
export const watchBackgroundMusic = () => {
  if (watching) return
  watching = true
  store.sub(bibleAudioStateAtom, sync)
  store.sub(bibleAudioMusicAtom, sync)
  store.sub(bibleAudioCatalogAtom, sync)
}
