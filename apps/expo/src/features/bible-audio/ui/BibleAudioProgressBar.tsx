import { useAtomValue } from 'jotai/react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'
import Box, { AnimatedBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { secondsToMinutes } from '~helpers/secondsToMinutes'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import { bibleAudioProgressAtom } from '../atoms'
import { seekTo, skip } from '../bibleAudioPlayer'
import type { BibleAudioProgress } from '../types'

export const getProgressRatio = (progress: BibleAudioProgress | null) => {
  if (!progress) return 0
  if (progress.kind === 'time')
    return progress.duration > 0 ? Math.min(progress.position / progress.duration, 1) : 0
  return progress.count > 0 ? (progress.index + 1) / progress.count : 0
}

/** The thin line along the top of the small player. */
export const BibleAudioProgressLine = ({ color }: { color?: string }) => {
  const progress = useAtomValue(bibleAudioProgressAtom)
  return (
    <Box
      className="absolute top-[0px] left-[0px] h-[2px] bg-primary"
      style={[
        { width: `${getProgressRatio(progress) * 100}%` },
        color ? { backgroundColor: color } : undefined,
      ]}
    />
  )
}

const TRACK_HEIGHT = 7
const TRACK_HEIGHT_HELD = 14
/** The finger's room around the bar. */
const TOUCH_HEIGHT = 36

const clampRatio = (value: number) => {
  'worklet'
  return Math.max(0, Math.min(value, 1))
}

/** What the two ends of the bar say, at the playing point or at the one the finger holds. */
const useProgressLabels = (progress: BibleAudioProgress | null, heldRatio: number | null) => {
  const { t } = useTranslation()
  if (progress?.kind === 'verses') {
    const index =
      heldRatio == null
        ? progress.index
        : Math.max(0, Math.min(Math.ceil(heldRatio * progress.count) - 1, progress.count - 1))
    // Away from the verse read, its number is counted from the first: chapters start at 1.
    const verse = heldRatio == null ? progress.verse : index + 1
    return [
      t('bibleAudio.verse', { verse }),
      t('bibleAudio.verseCount', { index: index + 1, count: progress.count }),
    ]
  }
  const duration = progress?.duration ?? 0
  const position = heldRatio == null ? (progress?.position ?? 0) : heldRatio * duration
  return [
    duration ? secondsToMinutes(position) : '--:--',
    duration ? secondsToMinutes(duration) : '--:--',
  ]
}

type BibleAudioProgressBarProps = {
  /** The fill, in the colour of the book's part. */
  color: string
}

/**
 * The bar of the large player: minutes of a recording, verses of the device's voice. The finger
 * drags it or taps it to go elsewhere in the chapter; it thickens while held.
 */
const BibleAudioProgressBar = ({ color }: BibleAudioProgressBarProps) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const progress = useAtomValue(bibleAudioProgressAtom)
  const ratio = getProgressRatio(progress)
  const [heldRatio, setHeldRatio] = useState<number | null>(null)
  const [start, end] = useProgressLabels(progress, heldRatio)

  const width = useSharedValue(0)
  const isHeld = useSharedValue(false)
  const held = useSharedValue(0)
  const shown = useSharedValue(ratio)

  useEffect(() => {
    // A jump back (another chapter) is not drawn as a slide.
    shown.set(ratio < shown.get() - 0.05 ? ratio : withTiming(ratio, { duration: 250 }))
  }, [ratio, shown])

  const commit = (value: number) => {
    setHeldRatio(null)
    seekTo(value)
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-14, 14])
    .onBegin(event => {
      'worklet'
      isHeld.set(true)
      held.set(clampRatio(event.x / (width.get() || 1)))
      runOnJS(setHeldRatio)(held.get())
    })
    .onUpdate(event => {
      'worklet'
      held.set(clampRatio(event.x / (width.get() || 1)))
      runOnJS(setHeldRatio)(held.get())
    })
    .onEnd(() => {
      'worklet'
      shown.set(held.get())
      runOnJS(commit)(held.get())
    })
    .onFinalize((_event, success) => {
      'worklet'
      isHeld.set(false)
      if (!success) runOnJS(setHeldRatio)(null)
    })

  const tap = Gesture.Tap().onEnd(event => {
    'worklet'
    const value = clampRatio(event.x / (width.get() || 1))
    shown.set(value)
    runOnJS(commit)(value)
  })

  const trackStyle = useAnimatedStyle(() => ({
    height: withTiming(isHeld.get() ? TRACK_HEIGHT_HELD : TRACK_HEIGHT, { duration: 180 }),
  }))
  const fillStyle = useAnimatedStyle(() => ({
    width: `${(isHeld.get() ? held.get() : shown.get()) * 100}%`,
  }))

  return (
    <Box>
      <GestureDetector gesture={Gesture.Race(pan, tap)}>
        <Box
          className="justify-center"
          style={{ height: TOUCH_HEIGHT }}
          onLayout={event => width.set(event.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('bibleAudio.position')}
          accessibilityValue={{ text: `${start}, ${end}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={event =>
            skip(event.nativeEvent.actionName === 'increment' ? 1 : -1)
          }
        >
          <ProgressTrack
            trackStyle={trackStyle}
            fillStyle={fillStyle}
            color={color}
            background={colorWithOpacity(theme.colors.default, 0.12) ?? theme.colors.lightGrey}
          />
        </Box>
      </GestureDetector>
      <Box className="flex-row px-[2px]">
        <Text
          className="text-[12px] font-semibold text-grey"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {start}
        </Text>
        <Box className="flex-[1]" />
        <Text
          className="text-[12px] font-semibold text-grey"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {end}
        </Text>
      </Box>
    </Box>
  )
}

type ProgressTrackProps = {
  trackStyle: ReturnType<typeof useAnimatedStyle>
  fillStyle: ReturnType<typeof useAnimatedStyle>
  color: string
  background: string
}

const ProgressTrack = ({ trackStyle, fillStyle, color, background }: ProgressTrackProps) => (
  <AnimatedBox
    className="overflow-hidden border-continuous rounded-full"
    style={[{ backgroundColor: background }, trackStyle]}
  >
    <AnimatedBox
      className="absolute top-[0px] bottom-[0px] left-[0px] rounded-full"
      style={[{ backgroundColor: color }, fillStyle]}
    />
  </AnimatedBox>
)

export default BibleAudioProgressBar
