import { twMerge } from '~common/ui/classNames'

import { useAtom } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { BoxProps, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { audioRepeatAtom } from './atom'
import AudioChip from './AudioChip'
import { getBibleAudioPlaylist } from './bibleAudioPlaylist'
export type AudioRepeatButtonProps = BoxProps

const AudioRepeatButton = (props: AudioRepeatButtonProps) => {
  const { t } = useTranslation()
  const [isActive, setIsActive] = useAtom(audioRepeatAtom)

  const onToggle = () => {
    const nextValue = !isActive
    setIsActive(nextValue)
    getBibleAudioPlaylist().loop = nextValue ? 'single' : 'none'
  }

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
            isActive ? 'text-link' : 'text-grey',
            'ml-[5px] font-bold text-[10px]'
          )}
        >
          {t('audio.repeat')}
        </Text>
      </AudioChip>
    </TouchableBox>
  )
}

export default AudioRepeatButton
