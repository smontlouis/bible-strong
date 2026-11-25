import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  LayoutAnimationConfig,
} from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'
import { twMerge } from '~common/ui/classNames'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { popIn } from '~common/ui/motion'
import { floatingShadow, radii } from '~common/ui/surfaces'
import { getBiblePart, getBiblePartColors } from '~themes/bibleBookColors'
import { useTheme } from '~themes/ThemeProvider'
import { backgroundMusicStateAtom, bibleAudioPassageAtom, bibleAudioStateAtom } from '../atoms'
import { openBibleAudioPlayer, stop, togglePlay } from '../bibleAudioPlayer'
import BibleAudioCover from './BibleAudioCover'
import MusicMiniPlayer from './MusicMiniPlayer'
import { BibleAudioProgressLine } from './BibleAudioProgressBar'
import { useBibleAudioLabels } from './useBibleAudioLabels'
import { MINI_PLAYER_HEIGHT } from './useBibleAudioMiniPlayerHeight'

// In the tab bar the row fades while the bar folds or unfolds over its height.
const miniPlayerIn = FadeIn.duration(220).delay(80)
const miniPlayerOut = FadeOut.duration(140)

type BibleAudioMiniPlayerProps = {
  /** `bar`: the top row of the tab bar. `card`: a floating card, in the sidebar or beside it. */
  variant: 'bar' | 'card'
  /** Classes of the card's frame, such as its margins. */
  className?: string
}

const MiniPlayerContent = ({ variant, className }: BibleAudioMiniPlayerProps) => {
  const { t } = useTranslation()
  const { passage, status } = useAtomValue(bibleAudioStateAtom)
  const musicState = useAtomValue(backgroundMusicStateAtom)
  const { title, subtitle } = useBibleAudioLabels()
  const theme = useTheme()

  // Swiping the small player up opens the large one.
  const swipeUp = Gesture.Pan()
    .activeOffsetY(-12)
    .failOffsetY(12)
    .failOffsetX([-16, 16])
    .onEnd(event => {
      'worklet'
      if (event.translationY < -24 || event.velocityY < -400) runOnJS(openBibleAudioPlayer)()
    })

  // With no passage loaded, the row shows the background music if the reader plays some.
  if (!passage) {
    if (musicState === 'off') return null
    if (variant === 'bar') return <MusicMiniPlayer variant="bar" />
    return (
      <Box className={className} style={{ borderRadius: radii.card, ...floatingShadow }}>
        <MusicMiniPlayer variant="card" />
      </Box>
    )
  }

  const partColors = getBiblePartColors(getBiblePart(passage.book.Numero), theme)
  const isPlaying = status === 'playing'
  const isLoading = status === 'loading'
  const hasError = status === 'error'

  const row = (
    <Box
      className={twMerge(
        'overflow-hidden border-continuous flex-row items-center pl-[10px] pr-[8px]',
        variant === 'card' ? 'bg-surface-raised' : 'border-separator'
      )}
      style={[
        { height: MINI_PLAYER_HEIGHT },
        variant === 'card'
          ? { borderRadius: radii.card }
          : { borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <BibleAudioProgressLine color={partColors.accent} />
      <TouchableBox
        className="flex-[1] min-w-0 flex-row items-center h-full"
        onPress={openBibleAudioPlayer}
        accessibilityRole="button"
        accessibilityLabel={t('bibleAudio.open')}
        accessibilityHint={`${title}, ${subtitle}`}
      >
        <BibleAudioCover passage={passage} size={40} />
        <Box className="flex-[1] min-w-0 ml-[10px]">
          <Text className="text-[14px] font-bold" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-[12px] text-grey" numberOfLines={1}>
            {hasError ? t('accessibility.audioUnavailable') : subtitle}
          </Text>
        </Box>
      </TouchableBox>
      <TouchableBox
        className="w-[44px] h-[44px] items-center justify-center"
        onPress={togglePlay}
        accessibilityRole="button"
        accessibilityLabel={t(isPlaying ? 'accessibility.pauseAudio' : 'accessibility.playAudio')}
        accessibilityState={{ busy: isLoading }}
      >
        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <AnimatedBox key={isPlaying ? 'pause' : 'play'} entering={popIn}>
            <IonIcon name={isPlaying ? 'pause' : 'play'} size={24} color="default" />
          </AnimatedBox>
        )}
      </TouchableBox>
      <TouchableBox
        className="w-[44px] h-[44px] items-center justify-center"
        onPress={stop}
        accessibilityRole="button"
        accessibilityLabel={t('bibleAudio.stop')}
      >
        <FeatherIcon name="x" size={20} color="grey" />
      </TouchableBox>
    </Box>
  )

  if (variant === 'bar') return <GestureDetector gesture={swipeUp}>{row}</GestureDetector>

  // The card floats: the shadow sits outside the box that clips the progress line.
  return (
    <Box className={className} style={{ borderRadius: radii.card, ...floatingShadow }}>
      {row}
    </Box>
  )
}

/**
 * The player while it is small: what plays, play and pause, and a way out. Opens the large one.
 * It fades in and out as it comes and goes, while the tab bar folds and unfolds around it.
 */
const BibleAudioMiniPlayer = (props: BibleAudioMiniPlayerProps) => {
  const passage = useAtomValue(bibleAudioPassageAtom)
  const musicState = useAtomValue(backgroundMusicStateAtom)
  const mode = passage ? 'passage' : musicState !== 'off' ? 'music' : null
  if (!mode) return null
  return (
    <AnimatedBox
      key={mode}
      entering={props.variant === 'bar' ? miniPlayerIn : FadeInDown.duration(240)}
      exiting={props.variant === 'bar' ? miniPlayerOut : FadeOutDown.duration(200)}
    >
      <LayoutAnimationConfig skipEntering>
        <MiniPlayerContent {...props} />
      </LayoutAnimationConfig>
    </AnimatedBox>
  )
}

export default BibleAudioMiniPlayer
