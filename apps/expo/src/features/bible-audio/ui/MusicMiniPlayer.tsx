import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { twMerge } from '~common/ui/classNames'
import { radii } from '~common/ui/surfaces'
import { backgroundMusicStateAtom, bibleAudioMusicAtom } from '../atoms'
import { getMusicName, useBackgroundMusicList } from '../audioCatalog'
import { closeMusic, toggleMusic } from '../backgroundMusic'
import MusicDisc from './MusicDisc'
import MusicPanel from './MusicPanel'
import { MINI_PLAYER_HEIGHT } from './useBibleAudioMiniPlayerHeight'

/**
 * The small player in music mode: the background music alone, with no Bible passage loaded. Its
 * piece opens the music's player; play and pause, and a way out.
 */
const MusicMiniPlayer = ({ variant }: { variant: 'bar' | 'card' }) => {
  const { t } = useTranslation()
  const state = useAtomValue(backgroundMusicStateAtom)
  const music = useAtomValue(bibleAudioMusicAtom)
  const pieces = useBackgroundMusicList()
  const current = pieces.find(piece => piece.id === music.id)
  if (state === 'off' || !current) return null
  const isPlaying = state === 'playing'

  return (
    <Box
      className={twMerge(
        'overflow-hidden border-continuous flex-row items-center pl-[10px] pr-[8px]',
        variant === 'card' ? 'bg-surface-raised' : 'border-separator'
      )}
      style={[
        { height: MINI_PLAYER_HEIGHT },
        variant === 'card'
          ? { borderRadius: radii.card }
          : { borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Box className="flex-[1] min-w-0">
        <MusicPanel
          placement="top start"
          trigger={
            <Box className="flex-row items-center h-full">
              <MusicDisc id={current.id} size={40} />
              <Box className="flex-[1] min-w-0 ml-[10px]">
                <Text className="text-[14px] font-bold" numberOfLines={1}>
                  {getMusicName(current)}
                </Text>
                <Text className="text-[12px] text-grey" numberOfLines={1}>
                  {t('bibleAudio.music.panelTitle')}
                </Text>
              </Box>
            </Box>
          }
        />
      </Box>
      <TouchableBox
        className="w-[44px] h-[44px] items-center justify-center"
        onPress={toggleMusic}
        accessibilityRole="button"
        accessibilityLabel={t(isPlaying ? 'bibleAudio.music.pause' : 'bibleAudio.music.play')}
      >
        <IonIcon name={isPlaying ? 'pause' : 'play'} size={24} color="default" />
      </TouchableBox>
      <TouchableBox
        className="w-[44px] h-[44px] items-center justify-center"
        onPress={closeMusic}
        accessibilityRole="button"
        accessibilityLabel={t('bibleAudio.music.close')}
      >
        <FeatherIcon name="x" size={20} color="grey" />
      </TouchableBox>
    </Box>
  )
}

export default MusicMiniPlayer
