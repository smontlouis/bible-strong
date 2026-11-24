import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { TouchableBox } from '~common/ui/Box'
import { ttsRepeatAtom } from '../atoms'
import PlayerOption from './PlayerOption'

const TTSRepeatButton = () => {
  const { t } = useTranslation()
  const [isActive, setIsActive] = useAtom(ttsRepeatAtom)

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

export default TTSRepeatButton
