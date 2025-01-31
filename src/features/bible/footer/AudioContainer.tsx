import React from 'react'
import { Linking, TouchableOpacityProps } from 'react-native'
import Link from '~common/Link'
import Box, { BoxProps, TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'

export interface AudioContainerProps {
  children: React.ReactNode
  onReduce: () => void
  audioMode: 'tts' | 'url'
  onChangeMode?: React.Dispatch<React.SetStateAction<'tts' | 'url' | undefined>>
}

type ChipProps = {
  children: string
  isActive?: boolean
}

const Chip = ({
  children,
  isActive,
  ...props
}: ChipProps & BoxProps & TouchableOpacityProps) => (
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

const AudioContainer = ({
  children,
  onReduce,
  audioMode,
  onChangeMode,
}: AudioContainerProps) => {
  return (
    <Box
      height="auto"
      backgroundColor="reverse"
      borderColor="border"
      borderWidth={1}
      paddingHorizontal={20}
      pb={20}
      bottom={20}
      left={20}
      right={20}
      position="absolute"
      borderRadius={30}
    >
      <HStack row pos="absolute" top={8} right={20} zIndex={10}>
        {!!onChangeMode && (
          <>
            <Chip
              isActive={audioMode === 'url'}
              onPress={() => onChangeMode('url')}
            >
              Audio
            </Chip>
            <Chip
              isActive={audioMode === 'tts'}
              onPress={() => onChangeMode('tts')}
            >
              TTS
            </Chip>
          </>
        )}
        <Chip
          onPress={() =>
            Linking.openURL('https://click.audibible.app/5nmN/stephane30')
          }
        >
          Audibible
        </Chip>
      </HStack>
      <Box center mb={10}>
        <Link onPress={onReduce} style={{ padding: 5 }}>
          <FeatherIcon name="chevron-down" size={20} color="tertiary" />
        </Link>
      </Box>
      {children}
    </Box>
  )
}

export default AudioContainer
