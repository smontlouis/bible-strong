import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import DropdownMenu from '~common/DropdownMenu'
import { ttsSpeedAtom } from '../atoms'
import PlayerOption from './PlayerOption'

const choices = [
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '1.75', label: '1.75x' },
  { value: '2', label: '2x' },
]

const TTSSpeedButton = () => {
  const { t } = useTranslation()
  const [speed, setSpeed] = useAtom(ttsSpeedAtom)

  return (
    <DropdownMenu
      title={t('audio.speed')}
      currentValue={speed.toString()}
      setValue={value => setSpeed(Number(value))}
      choices={choices}
      customRender={<PlayerOption isActive={speed !== 1} value={`x${speed}`} />}
    />
  )
}

export default TTSSpeedButton
