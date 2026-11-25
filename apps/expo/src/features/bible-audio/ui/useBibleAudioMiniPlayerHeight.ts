import { useAtomValue } from 'jotai/react'
import { backgroundMusicStateAtom, bibleAudioPassageAtom } from '../atoms'

/** The height of the small audio player in the tab bar: its row while a passage is loaded. */
export const MINI_PLAYER_HEIGHT = 56

/** The row shows the Bible audio, or the background music alone when no passage is loaded. */
export const useBibleAudioMiniPlayerHeight = () => {
  const passage = useAtomValue(bibleAudioPassageAtom)
  const music = useAtomValue(backgroundMusicStateAtom)
  return passage || music !== 'off' ? MINI_PLAYER_HEIGHT : 0
}
