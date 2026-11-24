import { atom } from 'jotai/vanilla'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import type { BibleAudioProgress, BibleAudioState } from './types'

export const bibleAudioStateAtom = atom<BibleAudioState>({
  passage: null,
  source: 'recorded',
  recordingId: null,
  status: 'idle',
})

/** The passage alone, so that a change of status re-renders nothing that only reads it. */
export const bibleAudioPassageAtom = atom(get => get(bibleAudioStateAtom).passage)

/** Apart from the state: it changes four times a second while a recording plays. */
export const bibleAudioProgressAtom = atom<BibleAudioProgress | null>(null)

/** The large player is open over the app. */
export const bibleAudioPlayerOpenAtom = atom(false)

/**
 * The Bible tab that turns its pages with the audio. It lets go as soon as its reader goes
 * elsewhere; « Show the text » in the player takes it back.
 */
export const bibleAudioFollowingTabIdAtom = atom('')

/** The tab the last listening started from, which « Show the text » goes back to. */
export const bibleAudioSourceTabIdAtom = atom('')

// The storage keys predate the player: they keep the reader's settings.
export const audioSpeedAtom = atomWithAsyncStorage('audioSpeed', 1)
// Saved as react-native-track-player's RepeatMode before expo-audio: 0 for off, 1 for the chapter.
export const audioRepeatAtom = atomWithAsyncStorage<boolean>('audioRepeat', false, {
  migrate: value => Boolean(value),
})
export const ttsPitchAtom = atomWithAsyncStorage('ttsPitch', 1)
export const ttsSpeedAtom = atomWithAsyncStorage('ttsSpeed', 1)
export const ttsVoiceAtom = atomWithAsyncStorage('ttsVoice', 'default')
export const ttsRepeatAtom = atomWithAsyncStorage('ttsRepeat', false)

/** When the sleep timer stops playback, in milliseconds since the epoch; 0 when off. */
export const audioSleepTimeAtom = atom(0)
export const audioSleepMinutesAtom = atom('off')
