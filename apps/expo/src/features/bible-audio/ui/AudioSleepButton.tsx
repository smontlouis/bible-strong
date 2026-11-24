import { useAtom } from 'jotai/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DropdownMenu from '~common/DropdownMenu'
import { secondsToMinutes } from '~helpers/secondsToMinutes'
import { audioSleepMinutesAtom, audioSleepTimeAtom } from '../atoms'
import PlayerOption from './PlayerOption'

const choices = [
  { value: 'off', label: 'Off' },
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 heure' },
  { value: '120', label: '2 heures' },
]

const AudioSleepButton = () => {
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

  // The time left counts down under the icon.
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!audioSleepTime) return
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [audioSleepTime])

  const remaining = Math.max(0, audioSleepTime - now)

  return (
    <DropdownMenu
      title={t('audio.timer')}
      currentValue={timer}
      setValue={onChange}
      choices={choices}
      customRender={
        <PlayerOption
          isActive={isActive}
          icon="timer-outline"
          caption={isActive ? secondsToMinutes(remaining / 1000) : undefined}
        />
      }
    />
  )
}

export default AudioSleepButton
