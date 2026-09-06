import { twMerge } from '~common/ui/classNames'

import { useAtom } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { BoxProps, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { ttsRepeatAtom } from './atom'
import AudioChip from './AudioChip'
export type TTSRepeatButtonProps = BoxProps

const TTSRepeatButton = (props: TTSRepeatButtonProps) => {
  const { t } = useTranslation()
  const [isRepeat, setRepeat] = useAtom(ttsRepeatAtom)

  const onToggle = async () => {
    setRepeat(s => !s)
  }

  const isActive = isRepeat

  return (
    <TouchableBox
      className="overflow-hidden border-continuous"
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityLabel={t('audio.repeat')}
      accessibilityState={{ checked: isActive }}
    >
      <AudioChip {...props} isActive={isActive}>
        <FeatherIcon name="repeat" size={14} color={isActive ? 'primary' : 'grey'} />
        <Text
          className={twMerge(
            isActive ? 'text-primary' : 'text-grey',
            'ml-[5px] font-bold text-[10px]'
          )}
        >
          {t('audio.repeat')}
        </Text>
      </AudioChip>
    </TouchableBox>
  )
}

export default TTSRepeatButton
