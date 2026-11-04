import { findTimelinePeriod } from '@bible-strong/resource-domain/timeline-stage'
import { Pressable, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import Text from '~common/ui/Text'
import { radii } from '~common/ui/surfaces'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import {
  axisToStrip,
  stripOffset,
  stripPointAt,
  stripToAxis,
  timelineStrip,
  type TimelineStageExtent,
} from './timelineStageModel'

/** A period narrower than this on the strip only shows its number. */
const NAMED_WIDTH = 96
const WINDOW_MIN_WIDTH = 6

/**
 * The strip of periods: where the view stands in the whole of time, and a way to go anywhere.
 * Pressing a period carries the view to its start, and dragging along the strip scrubs through
 * time. On a phone it is longer than the screen and slides as the view travels: its start shows
 * at the start of time, its end at the end.
 */
const TimelineStageStrip = ({
  extents,
  language,
  scrollX,
  viewWidth,
  maxScroll,
  height,
  current,
  onPeriodPress,
}: {
  extents: readonly TimelineStageExtent[]
  language: ResourceLanguage
  scrollX: SharedValue<number>
  viewWidth: number
  maxScroll: number
  height: number
  /** The period under the middle of the view. */
  current?: string
  onPeriodPress: (id: string) => void
}) => {
  const theme = useTheme()
  const { t } = useTranslation()
  const { segments, length } = timelineStrip(extents, viewWidth)

  // The finger holds a point of the strip, and the view goes there: the whole of time lies
  // between the two edges of the screen, the first period at the left one, the last at the right.
  const scrubTo = (x: number) => {
    'worklet'
    const target = stripToAxis(extents, segments, stripPointAt(x, length, viewWidth))
    scrollX.set(Math.min(Math.max(target - viewWidth / 2, 0), maxScroll))
  }
  // Only a finger that moves scrubs: one that just presses goes to the period it shows, which
  // on a sliding strip is not the point of the strip its place on the screen stands for.
  const scrub = Gesture.Pan()
    .minDistance(4)
    .onStart(event => scrubTo(event.x))
    .onUpdate(event => scrubTo(event.x))

  // A strip longer than the screen slides under it, so that the window stays under the finger.
  const slide = useAnimatedStyle(() => {
    const middle = axisToStrip(extents, segments, scrollX.get() + viewWidth / 2)
    return { transform: [{ translateX: -stripOffset(middle, length, viewWidth) }] }
  })
  const window = useAnimatedStyle(() => {
    const left = axisToStrip(extents, segments, scrollX.get())
    const right = axisToStrip(extents, segments, scrollX.get() + viewWidth)
    return { left, width: Math.max(right - left, WINDOW_MIN_WIDTH) }
  })

  return (
    <GestureDetector gesture={scrub}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel={t('timeline.stage.periods')}
        style={{
          height,
          overflow: 'hidden',
          borderTopWidth: 1,
          borderTopColor: theme.colors.separator,
          backgroundColor: theme.colors.surface,
        }}
      >
        <Animated.View style={[{ width: length, flex: 1, flexDirection: 'row' }, slide]}>
          {segments.map((segment, index) => {
            const period = findTimelinePeriod(segment.id)
            const number = String(index + 1).padStart(2, '0')
            const isCurrent = segment.id === current
            return (
              <Pressable
                key={segment.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: isCurrent }}
                accessibilityLabel={`${number} ${period?.title[language] ?? ''}`}
                onPress={() => onPeriodPress(segment.id)}
                style={{
                  width: segment.width,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: segment.width < NAMED_WIDTH ? 'center' : 'flex-start',
                  gap: 8,
                  paddingHorizontal: segment.width < NAMED_WIDTH ? 0 : 10,
                  overflow: 'hidden',
                  borderTopWidth: 4,
                  borderTopColor: period?.color ?? theme.colors.primary,
                  backgroundColor: isCurrent
                    ? colorWithOpacity(period?.color ?? theme.colors.primary, 0.15)
                    : 'transparent',
                }}
              >
                <Text
                  className={
                    isCurrent ? 'text-[11px] font-bold' : 'text-[11px] font-bold text-grey'
                  }
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {number}
                </Text>
                {segment.width >= NAMED_WIDTH && (
                  <Text
                    className={
                      isCurrent
                        ? 'flex-shrink text-[11px] font-semibold leading-[14px]'
                        : 'flex-shrink text-[11px] font-semibold leading-[14px] text-grey'
                    }
                    numberOfLines={2}
                  >
                    {period?.title[language]}
                  </Text>
                )}
              </Pressable>
            )
          })}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                bottom: 0,
                borderWidth: 2,
                borderColor: theme.colors.default,
                borderRadius: radii.mark,
                backgroundColor: colorWithOpacity(theme.colors.default, 0.09),
              },
              window,
            ]}
          />
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

export default TimelineStageStrip
