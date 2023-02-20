import { atom } from 'jotai/vanilla'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

export const ttsPitchAtom = atomWithAsyncStorage('ttsPitch', 1)
export const ttsSpeedAtom = atomWithAsyncStorage('ttsSpeed', 1)
export const ttsVoiceAtom = atomWithAsyncStorage('ttsVoice', 'default')
export const ttsRepeatAtom = atomWithAsyncStorage('ttsRepeat', false)

export const audioSleepTimeAtom = atom(0)
export const audioSleepMinutesAtom = atom('off')
