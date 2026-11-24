import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { TouchableBox } from '~common/ui/Box'
import { audioRepeatAtom } from '../atoms'
import PlayerOption from './PlayerOption'

const AudioRepeatButton = () => {
  const { t } = useTranslation()
  const [isActive, setIsActive] = useAtom(audioRepeatAtom)

  return (
    <TouchableBox
      onPress={() => setIsActive(!isActive)}
      accessibilityRole="switch"
      accessibilityLabel={t('audio.repeat')}
      accessibilityState={{ checked: isActive }}
    >
      <PlayerOption isActive={isActive} icon="repeat" />
    </TouchableBox>
  )
}

export default AudioRepeatButton
