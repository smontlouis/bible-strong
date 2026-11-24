import { useAtomValue } from 'jotai/react'
import { bibleAudioPassageAtom } from '../atoms'

/** The height of the small audio player in the tab bar: its row while a passage is loaded. */
export const MINI_PLAYER_HEIGHT = 56

export const useBibleAudioMiniPlayerHeight = () =>
  useAtomValue(bibleAudioPassageAtom) ? MINI_PLAYER_HEIGHT : 0
