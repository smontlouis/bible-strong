import { atom } from 'jotai/vanilla'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

export const ttsPitchAtom = atomWithAsyncStorage('ttsPitch', 1)
export const ttsSpeedAtom = atomWithAsyncStorage('ttsSpeed', 1)
export const ttsVoiceAtom = atomWithAsyncStorage('ttsVoice', 'default')
export const ttsRepeatAtom = atomWithAsyncStorage('ttsRepeat', false)

export const audioSleepTimeAtom = atom(0)
export const audioSleepMinutesAtom = atom('off')
export const audioSpeedAtom = atomWithAsyncStorage('audioSpeed', 1)
// Saved as react-native-track-player's RepeatMode before expo-audio: 0 for off, 1 for the chapter.
export const audioRepeatAtom = atomWithAsyncStorage<boolean>('audioRepeat', false, {
  migrate: value => Boolean(value),
})

export const playingBibleTabIdAtom = atom<string>('')
