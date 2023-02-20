import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import TrackPlayer from 'react-native-track-player'
import DropdownMenu from '~common/DropdownMenu'
import { BoxProps } from '~common/ui/Box'
import Text from '~common/ui/Text'
import AudioChip from './AudioChip'

export interface AudioSpeedButtonProps extends BoxProps {}

const choices = [
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '1.75', label: '1.75x' },
  { value: '2', label: '2x' },
]
const AudioSpeedButton = (props: AudioSpeedButtonProps) => {
  const { t } = useTranslation()
  const [rate, setRate] = React.useState('1')

  useEffect(() => {
    ;(async () => {
      setRate((await TrackPlayer.getRate()).toString())
    })()
  }, [])

  const onChange = async (value: string) => {
    setRate(value)
    await TrackPlayer.setRate(parseFloat(value))
  }

  const isActive = rate !== '1'

  return (
    <DropdownMenu
      title={t('audio.speed')}
      currentValue={rate.toString()}
      setValue={onChange}
      choices={choices}
      customRender={
        <AudioChip isActive={isActive} {...props}>
          <Text bold color={isActive ? 'primary' : 'grey'} fontSize={10}>
            {rate}x
          </Text>
        </AudioChip>
      }
    />
  )
}

export default AudioSpeedButton
