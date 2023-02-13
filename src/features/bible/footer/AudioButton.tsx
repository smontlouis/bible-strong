import React from 'react'
import { ActivityIndicator } from 'react-native'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

type AudioButtonProps = {
  error: boolean
  isPlaying: boolean
  isBuffering?: boolean
  isLoading?: boolean
  type?: 'audio' | 'tts'
}

const AudioButton = ({
  error,
  isPlaying,
  isBuffering,
  isLoading,
  type = 'audio',
}: AudioButtonProps) => {
  if (error) {
    return (
      <FeatherIcon
        name="x"
        size={20}
        color={isPlaying || isBuffering ? 'reverse' : ''}
      />
    )
  }

  if (isPlaying && (isLoading || isBuffering)) {
    return <ActivityIndicator color="white" />
  }

  if (type === 'tts') {
    return (
      <Text
        fontSize={12}
        bold
        color={isPlaying || isBuffering ? 'reverse' : ''}
      >
        TTS
      </Text>
    )
  }

  return (
    <FeatherIcon
      name={isPlaying || isBuffering ? 'volume-2' : 'volume-1'}
      style={{ marginLeft: 3 }}
      size={20}
      color={isPlaying || isBuffering ? 'reverse' : ''}
    />
  )
}

export default AudioButton
