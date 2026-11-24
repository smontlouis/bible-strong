import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-worklets'
import { twMerge } from '~common/ui/classNames'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { floatingShadow, radii } from '~common/ui/surfaces'
import { bibleAudioStateAtom } from '../atoms'
import { openBibleAudioPlayer, stop, togglePlay } from '../bibleAudioPlayer'
import { BibleAudioProgressLine } from './BibleAudioProgressBar'
import { useBibleAudioLabels } from './useBibleAudioLabels'
import { MINI_PLAYER_HEIGHT } from './useBibleAudioMiniPlayerHeight'

type BibleAudioMiniPlayerProps = {
  /** `bar`: the top row of the tab bar. `card`: a floating card, in the sidebar or beside it. */
  variant: 'bar' | 'card'
  /** Classes of the card's frame, such as its margins. */
  className?: string
}

/** The player while it is small: what plays, play and pause, and a way out. Opens the large one. */
const BibleAudioMiniPlayer = ({ variant, className }: BibleAudioMiniPlayerProps) => {
  const { t } = useTranslation()
  const { passage, status } = useAtomValue(bibleAudioStateAtom)
  const { title, subtitle } = useBibleAudioLabels()

  // Swiping the small player up opens the large one.
  const swipeUp = Gesture.Pan()
    .activeOffsetY(-12)
    .failOffsetY(12)
    .failOffsetX([-16, 16])
    .onEnd(event => {
      'worklet'
      if (event.translationY < -24 || event.velocityY < -400) runOnJS(openBibleAudioPlayer)()
    })

  if (!passage) return null

  const isPlaying = status === 'playing'
  const isLoading = status === 'loading'
  const hasError = status === 'error'

  const row = (
    <Box
      className={twMerge(
        'overflow-hidden border-continuous flex-row items-center pl-[16px] pr-[8px]',
        variant === 'card' ? 'bg-surface-raised' : 'border-separator'
      )}
      style={[
        { height: MINI_PLAYER_HEIGHT },
        variant === 'card'
          ? { borderRadius: radii.card }
          : { borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <BibleAudioProgressLine />
      <TouchableBox
        className="flex-[1] min-w-0 justify-center h-full"
        onPress={openBibleAudioPlayer}
        accessibilityRole="button"
        accessibilityLabel={t('bibleAudio.open')}
        accessibilityHint={`${title}, ${subtitle}`}
      >
        <Text className="text-[14px] font-bold" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-[12px] text-grey" numberOfLines={1}>
          {hasError ? t('accessibility.audioUnavailable') : subtitle}
        </Text>
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
          <IonIcon name={isPlaying ? 'pause' : 'play'} size={24} color="default" />
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

export default BibleAudioMiniPlayer
