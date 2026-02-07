import { atom } from 'jotai/vanilla'
import { RepeatMode } from 'react-native-track-player'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

export const ttsPitchAtom = atomWithAsyncStorage('ttsPitch', 1)
export const ttsSpeedAtom = atomWithAsyncStorage('ttsSpeed', 1)
export const ttsVoiceAtom = atomWithAsyncStorage('ttsVoice', 'default')
export const ttsRepeatAtom = atomWithAsyncStorage('ttsRepeat', false)

export const audioSleepTimeAtom = atom(0)
export const audioSleepMinutesAtom = atom('off')
export const audioSpeedAtom = atomWithAsyncStorage('audioSpeed', 1)
export const audioRepeatAtom = atomWithAsyncStorage<RepeatMode>('audioRepeat', RepeatMode.Off)

export const playingBibleTabIdAtom = atom<string>('')

export const isINTCompleteAtom = atomWithAsyncStorage('isINTComplete', true)
