import { useAtom } from 'jotai/react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import TrackPlayer, { RepeatMode } from 'react-native-track-player'
import { BoxProps, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { audioRepeatAtom } from './atom'
import AudioChip from './AudioChip'

export interface AudioRepeatButtonProps extends BoxProps {}

const AudioRepeatButton = (props: AudioRepeatButtonProps) => {
  const { t } = useTranslation()
  const [repeatMode, setRepeatMode] = useAtom(audioRepeatAtom)

  useEffect(() => {
    ;(async () => {
      setRepeatMode(await TrackPlayer.getRepeatMode())
    })()
  }, [setRepeatMode])

  const onToggle = async () => {
    const newValue =
      repeatMode === RepeatMode.Off ? RepeatMode.Track : RepeatMode.Off

    setRepeatMode(newValue)
    await TrackPlayer.setRepeatMode(newValue)
  }

  const isActive = repeatMode === RepeatMode.Track

  return (
    <TouchableBox onPress={onToggle}>
      <AudioChip {...props} isActive={isActive}>
        <FeatherIcon
          name="repeat"
          size={14}
          color={isActive ? 'primary' : 'grey'}
        />
        <Text ml={5} bold fontSize={10} color={isActive ? 'primary' : 'grey'}>
          {t('audio.repeat')}
        </Text>
      </AudioChip>
    </TouchableBox>
  )
}

export default AudioRepeatButton
