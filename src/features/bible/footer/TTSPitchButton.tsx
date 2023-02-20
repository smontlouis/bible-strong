import { useAtom } from 'jotai/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import DropdownMenu from '~common/DropdownMenu'
import { BoxProps } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { ttsPitchAtom } from './atom'
import AudioChip from './AudioChip'

export interface TTSPitchButtonProps extends BoxProps {}

const choices = [
  { value: '0.5', label: '0.5x' },
  { value: '0.75', label: '0.75x' },
  { value: '1', label: '1x' },
  { value: '1.25', label: '1.25x' },
  { value: '1.5', label: '1.5x' },
  { value: '1.75', label: '1.75x' },
  { value: '2', label: '2x' },
]
const TTSPitchButton = (props: TTSPitchButtonProps) => {
  const { t } = useTranslation()
  const [pitch, setPitch] = useAtom(ttsPitchAtom)
  const isActive = pitch !== 1

  return (
    <DropdownMenu
      title={t('audio.speed')}
      currentValue={pitch.toString()}
      setValue={v => setPitch(Number(v))}
      choices={choices}
      customRender={
        <AudioChip isActive={isActive} {...props}>
          <Text bold color={isActive ? 'primary' : 'grey'} fontSize={10}>
            {t('audio.pitch')} {pitch}x
          </Text>
        </AudioChip>
      }
    />
  )
}

export default TTSPitchButton
