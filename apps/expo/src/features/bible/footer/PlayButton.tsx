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
        className="overflow-hidden border-continuous w-[50px] h-[50px] bg-reverse mx-[10px] items-center justify-center"
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
        className="overflow-hidden border-continuous w-[50px] h-[50px] bg-primary rounded-[25px] items-center justify-center mx-[10px]"
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
      className="overflow-hidden border-continuous items-center justify-center w-[50px] h-[50px] bg-primary rounded-[25px] mx-[10px]"
      disabled={disabled}
      activeOpacity={0.5}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? t('accessibility.pauseAudio') : t('accessibility.playAudio')}
      accessibilityState={{ disabled }}
      style={[{ opacity: disabled ? 0.6 : 1 }, [{ opacity: disabled ? 0.6 : 1 }]]}
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
