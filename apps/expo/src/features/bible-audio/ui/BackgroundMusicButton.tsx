import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { backgroundMusicStateAtom, bibleAudioMusicAtom } from '../atoms'
import { getMusicName, useBackgroundMusicList } from '../audioCatalog'
import MusicPanel from './MusicPanel'
import PlayerPill from './PlayerPill'

/**
 * The music's pill in the large player: the piece once the reader has played some, in the accent
 * while it plays. It opens the music's own player, which the Bible audio does not drive.
 */
const BackgroundMusicButton = () => {
  const { t } = useTranslation()
  const state = useAtomValue(backgroundMusicStateAtom)
  const music = useAtomValue(bibleAudioMusicAtom)
  const pieces = useBackgroundMusicList()
  const current = pieces.find(piece => piece.id === music.id)
  const label = state !== 'off' && current ? getMusicName(current) : t('bibleAudio.music.title')
  return (
    <MusicPanel
      placement="top start"
      trigger={
        <PlayerPill icon="musical-notes-outline" label={label} isActive={state === 'playing'} />
      }
    />
  )
}

export default BackgroundMusicButton
