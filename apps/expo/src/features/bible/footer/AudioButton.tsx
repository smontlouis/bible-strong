import { ActivityIndicator } from 'react-native'
import { VStack } from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import MusicEqualizer from '~features/bible-audio/ui/MusicEqualizer'
import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'

type AudioButtonProps = {
  error: boolean
  isPlaying: boolean
  isLoading?: boolean
  /** `tts`: the device's voice reads, which a small « TTS » under the icon says. */
  type?: 'url' | 'tts'
}

/**
 * The footer's way to listen: play while nothing plays, bars that move while the passage is
 * heard. Its press then opens the player rather than pausing, so it never shows a pause.
 */
const AudioButton = ({ error, isPlaying, isLoading, type = 'url' }: AudioButtonProps) => {
  const stylingTheme = useStylingTheme()
  const ink = isPlaying
    ? resolveThemeColor(stylingTheme, 'reverse') || stylingTheme.colors.reverse
    : stylingTheme.colors.default

  if (error) {
    return <FeatherIcon name="x" size={20} color={isPlaying ? 'reverse' : ''} />
  }

  if (isPlaying && isLoading) {
    return <ActivityIndicator color="white" />
  }

  const isSpeech = type === 'tts'
  const icon = isPlaying ? (
    <MusicEqualizer color={ink} size={isSpeech ? 12 : 16} />
  ) : (
    // The triangle sits a little right of the centre, where the eye expects it.
    <IonIcon
      name="play"
      size={isSpeech ? 15 : 19}
      color={isPlaying ? 'reverse' : 'default'}
      style={{ marginLeft: 2 }}
    />
  )
  if (!isSpeech) return icon

  return (
    <VStack className="items-center">
      {icon}
      <Text
        className="text-[8px] leading-[9px] font-bold mt-[2px]"
        style={{ color: ink, letterSpacing: 0.4 }}
      >
        TTS
      </Text>
    </VStack>
  )
}

export default AudioButton
