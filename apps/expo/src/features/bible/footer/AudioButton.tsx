import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import React from 'react'
import { ActivityIndicator } from 'react-native'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
type AudioButtonProps = {
  error: boolean
  isPlaying: boolean
  isBuffering?: boolean
  isLoading?: boolean
  type?: 'url' | 'tts'
}

const AudioButton = ({
  error,
  isPlaying,
  isBuffering,
  isLoading,
  type = 'url',
}: AudioButtonProps) => {
  const stylingTheme = useStylingTheme()

  if (error) {
    return <FeatherIcon name="x" size={20} color={isPlaying || isBuffering ? 'reverse' : ''} />
  }

  if (isPlaying && (isLoading || isBuffering)) {
    return <ActivityIndicator color="white" />
  }

  if (type === 'tts') {
    return (
      <Text
        className="text-[12px] font-bold"
        style={{
          color:
            resolveThemeColor(stylingTheme, isPlaying || isBuffering ? 'reverse' : '') ||
            stylingTheme.colors.default,
        }}
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
