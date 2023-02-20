import { useAtom } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { BoxProps, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { ttsRepeatAtom } from './atom'
import AudioChip from './AudioChip'

export interface TTSRepeatButtonProps extends BoxProps {}

const TTSRepeatButton = (props: TTSRepeatButtonProps) => {
  const { t } = useTranslation()
  const [isRepeat, setRepeat] = useAtom(ttsRepeatAtom)

  const onToggle = async () => {
    setRepeat(s => !s)
  }

  const isActive = isRepeat

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

export default TTSRepeatButton
