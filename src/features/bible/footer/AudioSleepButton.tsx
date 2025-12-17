import { useAtom, useSetAtom } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import DropdownMenu from '~common/DropdownMenu'
import { BoxProps } from '~common/ui/Box'
import { IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { secondsToMinutes } from '~helpers/secondsToMinutes'
import { audioSleepMinutesAtom, audioSleepTimeAtom } from './atom'
import AudioChip from './AudioChip'

export interface AudioSleepButtonProps extends BoxProps {}

const choices = [
  { value: 'off', label: 'Off' },
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 heure' },
  { value: '120', label: '2 heures' },
]

const AudioSleepButton = (props: AudioSleepButtonProps) => {
  const { t } = useTranslation()
  const [timer, setTimer] = useAtom(audioSleepMinutesAtom)
  const [audioSleepTime, setAudioSleep] = useAtom(audioSleepTimeAtom)
  const isActive = timer !== 'off'

  const onChange = (minutes: string) => {
    setTimer(minutes)

    if (minutes === 'off') {
      setAudioSleep(0)
      return
    }

    // Add minutes to current time
    const date = new Date()
    date.setMinutes(date.getMinutes() + parseInt(minutes, 10))
    setAudioSleep(date.getTime())
    // setAudioSleep(Date.now() + 5000) // For testing purpose only
  }

  const elapsed = audioSleepTime - Date.now()

  return (
    <DropdownMenu
      title={t('audio.timer')}
      currentValue={timer}
      setValue={onChange}
      choices={choices}
      customRender={
        <AudioChip isActive={isActive} {...props}>
          <IonIcon name="timer-outline" size={18} color={isActive ? 'primary' : 'grey'} />
          <Text ml={5} bold fontSize={10} color={isActive ? 'primary' : 'grey'}>
            {isActive ? secondsToMinutes(elapsed / 1000) : t('audio.timer')}
          </Text>
        </AudioChip>
      }
    />
  )
}

export default AudioSleepButton
