import { useAtom, useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import ContextualPanel from '~common/ContextualPanel'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import SheetWell from '~common/ui/SheetWell'
import Text from '~common/ui/Text'
import { twMerge } from '~common/ui/classNames'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { bibleAudioMusicAtom, bibleAudioStateAtom, type BackgroundMusicVolume } from '../atoms'
import {
  getMusicName,
  getRecording,
  passageHasMusic,
  useBackgroundMusicList,
} from '../audioCatalog'
import PlayerPill from './PlayerPill'

const VOLUMES: BackgroundMusicVolume[] = ['low', 'medium', 'high']

type MusicRowProps = { label: string; isSelected: boolean; onPress: () => void }

const MusicRow = ({ label, isSelected, onPress }: MusicRowProps) => (
  <TouchableBox
    className="flex-row items-center px-[14px] min-h-[48px] py-[10px]"
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityLabel={label}
    accessibilityState={{ checked: isSelected }}
  >
    <Text
      className={twMerge(
        isSelected ? 'text-link font-semibold' : 'text-default',
        'flex-[1] text-[15px]'
      )}
      numberOfLines={1}
    >
      {label}
    </Text>
    {isSelected && <IonIcon name="checkmark" size={20} color="primary" />}
  </TouchableBox>
)

const Hairline = () => (
  <Box
    className="ml-[14px] border-separator"
    style={{ borderBottomWidth: StyleSheet.hairlineWidth }}
  />
)

/** Low, medium or high: three steps are enough under a voice. */
const VolumeChoice = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  const [music, setMusic] = useAtom(bibleAudioMusicAtom)
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
            onPress={() => setMusic({ ...music, volume })}
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

/**
 * The background music looped under the voice (ADR-0117): none, or a piece of the catalog, and
 * how loud. A chapter that already has music under its voice shows no pill.
 */
const BackgroundMusicButton = () => {
  const { t } = useTranslation()
  const { passage, source, recordingId } = useAtomValue(bibleAudioStateAtom)
  const [music, setMusic] = useAtom(bibleAudioMusicAtom)
  const pieces = useBackgroundMusicList()
  const recording = source === 'recorded' ? getRecording(recordingId) : undefined
  if (!passage || !pieces.length || passageHasMusic(passage, recording)) return null

  const current = pieces.find(piece => piece.id === music.id)
  const label = current ? getMusicName(current) : t('bibleAudio.music.title')

  return (
    <ContextualPanel
      accessibilityLabel={`${t('bibleAudio.music.panelTitle')}: ${current ? label : t('bibleAudio.music.none')}`}
      initialScreen="music"
      width={320}
      placement="top start"
      trigger={<PlayerPill icon="musical-notes-outline" label={label} isActive={!!current} />}
      screens={{
        music: {
          title: t('bibleAudio.music.panelTitle'),
          content: () => (
            <Box className="px-[16px] pb-[16px] gap-[8px]">
              <SheetWell>
                <MusicRow
                  label={t('bibleAudio.music.none')}
                  isSelected={!current}
                  onPress={() => setMusic({ ...music, id: null })}
                />
                {pieces.map(piece => (
                  <Box key={piece.id}>
                    <Hairline />
                    <MusicRow
                      label={getMusicName(piece)}
                      isSelected={piece.id === current?.id}
                      onPress={() => setMusic({ ...music, id: piece.id })}
                    />
                  </Box>
                ))}
              </SheetWell>
              <Text className="text-[13px] text-grey mt-[8px] ml-[4px]">
                {t('bibleAudio.music.volume')}
              </Text>
              <VolumeChoice />
            </Box>
          ),
        },
      }}
    />
  )
}

export default BackgroundMusicButton
