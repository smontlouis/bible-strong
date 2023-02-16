import React from 'react'
import { ActivityIndicator } from 'react-native'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import IconButton from './IconButton'

type PlayButtonProps = {
  disabled?: boolean
  isPlaying: boolean
  onToggle: () => void
  error?: boolean
  isLoading?: boolean
}

const PlayButton = ({
  disabled,
  isPlaying,
  onToggle,
  error,
  isLoading,
}: PlayButtonProps) => {
  if (error) {
    return (
      <IconButton big disabled={disabled} activeOpacity={0.5} isFlat>
        <FeatherIcon name="x" size={23} color="quart" />
      </IconButton>
    )
  }
  // IsBuffering
  if (isLoading) {
    return (
      <Box width={50} height={50} center>
        <ActivityIndicator />
      </Box>
    )
  }

  return (
    <IconButton
      big
      disabled={disabled}
      activeOpacity={0.5}
      onPress={onToggle}
      isFlat
    >
      <FeatherIcon
        name={isPlaying ? 'pause-circle' : 'play-circle'}
        size={28}
        style={{ marginLeft: 3 }}
      />
    </IconButton>
  )
}

export default PlayButton
