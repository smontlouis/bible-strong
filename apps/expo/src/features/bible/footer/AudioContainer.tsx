import { twMerge } from '~common/ui/classNames'
import React from 'react'
import { Linking, TouchableOpacityProps } from 'react-native'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { isBibleOverlayOpenAtom, isFullScreenBibleAtom } from 'src/state/app'
import Box, { AnimatedBox, BoxProps, HStack, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { HEADER_HEIGHT } from '~features/app-switcher/utils/constants'
export interface AudioContainerProps {
  children: React.ReactNode
  onReduce: () => void
  audioMode: 'tts' | 'url'
  onChangeMode?: (mode: 'tts' | 'url') => void
}

type ChipProps = {
  children: string
  isActive?: boolean
}

const Chip = ({ children, isActive, ...props }: ChipProps & BoxProps & TouchableOpacityProps) => {
  return (
    <TouchableBox
      {...props}
      style={props.style}
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          isActive ? 'border-primary' : 'border-border',
          twMerge(
            'overflow-hidden border-continuous px-[6px] py-[3px] rounded-[8px] border-[1px] flex-row',
            props.className
          )
        )
      )}
    >
      <Text className={twMerge(isActive ? 'text-primary' : 'text-default', 'text-[10px]')}>
        {children}
      </Text>
    </TouchableBox>
  )
}

const AudioContainer = ({ children, onReduce, audioMode, onChangeMode }: AudioContainerProps) => {
  const { t } = useTranslation()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)
  const isBibleOverlayOpen = useAtomValue(isBibleOverlayOpenAtom)

  if (isBibleOverlayOpen) return null

  return (
    <AnimatedBox
      className="overflow-hidden border-continuous h-auto bg-reverse border-border border-[1px] px-[20px] pb-[20px] left-[20px] right-[20px] absolute rounded-[30px]"
      style={[
        { bottom: 20 + bottomBarHeight },
        {
          transform: [{ translateY: isFullScreenBible ? HEADER_HEIGHT : 0 }],
          transitionProperty: 'transform',
          transitionDuration: 300,
        },
      ]}
    >
      <HStack className="overflow-hidden border-continuous flex-row absolute top-[8px] right-[20px] z-[10] gap-[3px]">
        {!!onChangeMode && (
          <>
            <Chip
              isActive={audioMode === 'url'}
              onPress={() => onChangeMode('url')}
              accessibilityRole="radio"
              accessibilityLabel={t('accessibility.audioSource', { source: 'Audio' })}
              accessibilityState={{ checked: audioMode === 'url' }}
            >
              Audio
            </Chip>
            <Chip
              isActive={audioMode === 'tts'}
              onPress={() => onChangeMode('tts')}
              accessibilityRole="radio"
              accessibilityLabel={t('accessibility.audioSource', { source: 'TTS' })}
              accessibilityState={{ checked: audioMode === 'tts' }}
            >
              TTS
            </Chip>
          </>
        )}
        <Chip
          onPress={() => Linking.openURL('https://click.audibible.app/5nmN/stephane30')}
          accessibilityRole="link"
          accessibilityLabel={t('accessibility.openAudibible')}
        >
          Audibible
        </Chip>
      </HStack>
      <Box className="overflow-hidden border-continuous items-center justify-center mb-[10px]">
        <TouchableBox
          className="overflow-hidden border-continuous p-[5px]"
          onPress={onReduce}
          accessibilityRole="button"
          accessibilityLabel={t('accessibility.reduceAudioPlayer')}
        >
          <FeatherIcon name="chevron-down" size={20} color="tertiary" />
        </TouchableBox>
      </Box>
      {children}
    </AnimatedBox>
  )
}

export default AudioContainer
