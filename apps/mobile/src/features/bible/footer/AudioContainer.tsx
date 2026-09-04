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

const Chip = ({ children, isActive, ...props }: ChipProps & BoxProps & TouchableOpacityProps) => (
  <TouchableBox
    py={3}
    px={6}
    borderRadius={8}
    borderWidth={1}
    borderColor={isActive ? 'primary' : 'border'}
    row
    {...props}
  >
    <Text fontSize={10} color={isActive ? 'primary' : 'default'}>
      {children}
    </Text>
  </TouchableBox>
)

const AudioContainer = ({ children, onReduce, audioMode, onChangeMode }: AudioContainerProps) => {
  const { t } = useTranslation()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const isFullScreenBible = useAtomValue(isFullScreenBibleAtom)
  const isBibleOverlayOpen = useAtomValue(isBibleOverlayOpenAtom)

  if (isBibleOverlayOpen) return null

  return (
    <AnimatedBox
      height="auto"
      backgroundColor="reverse"
      borderColor="border"
      borderWidth={1}
      paddingHorizontal={20}
      pb={20}
      bottom={20 + bottomBarHeight}
      left={20}
      right={20}
      position="absolute"
      borderRadius={30}
      style={{
        transform: [{ translateY: isFullScreenBible ? HEADER_HEIGHT : 0 }],
        transitionProperty: 'transform',
        transitionDuration: 300,
      }}
    >
      <HStack row pos="absolute" top={8} right={20} zIndex={10} gap={3}>
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
      <Box center mb={10}>
        <TouchableBox
          onPress={onReduce}
          padding={5}
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
