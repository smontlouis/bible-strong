import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import DropdownMenu from '~common/DropdownMenu'
import { audioSpeedAtom } from '../atoms'
import PlayerOption from './PlayerOption'

const choices = [
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '1.75', label: '1.75x' },
  { value: '2', label: '2x' },
]

const AudioSpeedButton = () => {
  const { t } = useTranslation()
  const [rate, setRate] = useAtom(audioSpeedAtom)

  return (
    <DropdownMenu
      title={t('audio.speed')}
      currentValue={rate.toString()}
      setValue={value => setRate(Number(value))}
      choices={choices}
      customRender={<PlayerOption isActive={rate !== 1} value={`x${rate}`} />}
    />
  )
}

export default AudioSpeedButton
