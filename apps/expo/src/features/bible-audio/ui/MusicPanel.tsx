import { useAtomValue } from 'jotai/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ContextualPanel from '~common/ContextualPanel'
import type { PanelPlacement } from '~common/ContextualPanel/types'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { twMerge } from '~common/ui/classNames'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { backgroundMusicStateAtom, bibleAudioMusicAtom, type BackgroundMusicVolume } from '../atoms'
import { getMusicName, useBackgroundMusicList } from '../audioCatalog'
import { setMusicVolume, stepMusic, toggleMusic } from '../backgroundMusic'
import MusicDisc from './MusicDisc'

const VOLUMES: BackgroundMusicVolume[] = ['low', 'medium', 'high']
const DISC_SIZE = 150
const DISC_INK = '#2b2340'

/** Low, medium or high. */
const VolumeChoice = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const music = useAtomValue(bibleAudioMusicAtom)
  return (
    <HStack
      className="rounded-full p-[3px]"
      style={{ backgroundColor: colorWithOpacity(theme.colors.default, 0.07) }}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('bibleAudio.music.volume')}
    >
      {VOLUMES.map(volume => {
        const isSelected = music.volume === volume
        return (
          <TouchableBox
            key={volume}
            className="flex-[1] h-[32px] rounded-full items-center justify-center"
            style={isSelected ? { backgroundColor: theme.colors.reverse } : undefined}
            onPress={() => setMusicVolume(volume)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
          >
            <Text
              className={twMerge(
                isSelected ? 'text-default font-semibold' : 'text-grey',
                'text-[13px]'
              )}
            >
              {t(`bibleAudio.music.${volume}`)}
            </Text>
          </TouchableBox>
        )
      })}
    </HStack>
  )
}

/** The music's own player: its disc to play and pause, the piece before and after, its volume. */
const MusicPlayerContent = () => {
  const { t } = useTranslation()
  const state = useAtomValue(backgroundMusicStateAtom)
  const music = useAtomValue(bibleAudioMusicAtom)
  const pieces = useBackgroundMusicList()
  const current = pieces.find(piece => piece.id === music.id) ?? pieces[0]
  const isPlaying = state === 'playing'

  return (
    <Box className="px-[16px] pb-[16px] items-center">
      <TouchableBox
        className="mt-[8px]"
        onPress={toggleMusic}
        accessibilityRole="button"
        accessibilityLabel={t(isPlaying ? 'bibleAudio.music.pause' : 'bibleAudio.music.play')}
      >
        <MusicDisc id={current?.id} size={DISC_SIZE}>
          <Box
            className="w-[56px] h-[56px] rounded-full items-center justify-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.55)' }}
          >
            <IonIcon
              name={isPlaying ? 'pause' : 'play'}
              size={26}
              // The disc is light in either theme: a dark ink reads on it.
              color={DISC_INK}
              style={isPlaying ? undefined : { marginLeft: 3 }}
            />
          </Box>
        </MusicDisc>
      </TouchableBox>
      <HStack className="items-center self-stretch mt-[14px]">
        <TouchableBox
          className="w-[44px] h-[44px] items-center justify-center"
          onPress={() => stepMusic(-1)}
          accessibilityRole="button"
          accessibilityLabel={t('bibleAudio.music.previous')}
        >
          <IonIcon name="play-skip-back-outline" size={22} color="default" />
        </TouchableBox>
        <Box className="flex-[1] items-center min-w-0">
          <Text className="text-[17px] font-bold" numberOfLines={1}>
            {current ? getMusicName(current) : ''}
          </Text>
          <Text className="text-[13px] text-grey mt-[2px]">{t('bibleAudio.music.panelTitle')}</Text>
        </Box>
        <TouchableBox
          className="w-[44px] h-[44px] items-center justify-center"
          onPress={() => stepMusic(1)}
          accessibilityRole="button"
          accessibilityLabel={t('bibleAudio.music.next')}
        >
          <IonIcon name="play-skip-forward-outline" size={22} color="default" />
        </TouchableBox>
      </HStack>
      <Box className="self-stretch mt-[16px]">
        <VolumeChoice />
      </Box>
    </Box>
  )
}

type MusicPanelProps = {
  trigger: ReactNode
  /** Where the web popover opens: the footer and the player sit low, so it opens above them. */
  placement?: PanelPlacement
}

/**
 * The background music, apart from the Bible audio (ADR-0117): HelloBible's disc, to play music
 * while reading, praying or listening. A sheet on a phone, a popover on the web.
 */
const MusicPanel = ({ trigger, placement = 'top' }: MusicPanelProps) => {
  const { t } = useTranslation()
  const pieces = useBackgroundMusicList()
  if (!pieces.length) return null
  return (
    <ContextualPanel
      accessibilityLabel={t('bibleAudio.music.panelTitle')}
      initialScreen="music"
      width={320}
      placement={placement}
      trigger={trigger}
      screens={{
        music: { title: t('bibleAudio.music.panelTitle'), content: () => <MusicPlayerContent /> },
      }}
    />
  )
}

export default MusicPanel
