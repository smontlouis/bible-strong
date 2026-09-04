import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'

type PlayButtonProps = {
  disabled?: boolean
  isPlaying: boolean
  onToggle: () => void
  error?: boolean
  isLoading?: boolean
}

const PlayButton = ({ disabled, isPlaying, onToggle, error, isLoading }: PlayButtonProps) => {
  const { t } = useTranslation()

  if (error) {
    return (
      <Box
        width={50}
        height={50}
        bg="reverse"
        mx={10}
        center
        accessible
        accessibilityRole="text"
        accessibilityLabel={t('accessibility.audioUnavailable')}
      >
        <FeatherIcon name="x" size={23} color="quart" />
      </Box>
    )
  }
  // IsBuffering
  if (isLoading) {
    return (
      <Box
        width={50}
        height={50}
        bg="primary"
        borderRadius={25}
        center
        mx={10}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('accessibility.audioLoading')}
        accessibilityLiveRegion="polite"
      >
        <ActivityIndicator color="white" />
      </Box>
    )
  }

  return (
    <TouchableBox
      disabled={disabled}
      activeOpacity={0.5}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? t('accessibility.pauseAudio') : t('accessibility.playAudio')}
      accessibilityState={{ disabled }}
      center
      width={50}
      height={50}
      bg="primary"
      borderRadius={25}
      mx={10}
    >
      <IonIcon
        name={isPlaying ? 'pause' : 'play'}
        size={30}
        style={{ marginLeft: 3 }}
        color="reverse"
      />
    </TouchableBox>
  )
}

export default PlayButton
