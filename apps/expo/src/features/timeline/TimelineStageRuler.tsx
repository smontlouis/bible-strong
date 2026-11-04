import {
  findTimelinePeriod,
  TIMELINE_RULER_HEIGHT,
} from '@bible-strong/resource-domain/timeline-stage'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { floatingShadow, radii } from '~common/ui/surfaces'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import TimelineStageYearText from './TimelineStageYearText'
import type { TimelineStageExtent } from './timelineStageModel'

const TICK_LABEL_WIDTH = 80
/** Wide enough for the longest year it names, « 1517 ap. J.-C. »: nothing measures it again. */
const CURSOR_WIDTH = 132

/**
 * The axis along the bottom of the view: each period in its colour, ticks a hundred points
 * apart, and the year under the middle of the view riding it.
 */
const TimelineStageRuler = ({
  extents,
  ticks,
  scrollX,
  year,
  cursorFormat,
  cursorInitial,
  inTime,
}: {
  extents: readonly TimelineStageExtent[]
  /** The ticks near the view, with the label each shows. */
  ticks: readonly { left: number; label?: string }[]
  scrollX: SharedValue<number>
  /** The year under the middle of the view, and the worklet that names it. */
  year: SharedValue<number>
  cursorFormat: (year: number) => string
  cursorInitial: string
  inTime: boolean
}) => {
  const theme = useTheme()
  const last = extents[extents.length - 1]
  const axisEnd = last ? last.left + last.width + TICK_LABEL_WIDTH : 0
  const travel = useAnimatedStyle(() => ({ transform: [{ translateX: -scrollX.get() }] }))
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: TIMELINE_RULER_HEIGHT }}
    >
      <Animated.View
        style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: axisEnd }, travel]}
      >
        {extents.map(extent => (
          <View
            key={extent.id}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: extent.left,
              width: extent.width,
              borderTopWidth: 3,
              borderTopColor: findTimelinePeriod(extent.id)?.color ?? theme.colors.primary,
              backgroundColor: colorWithOpacity(theme.colors.canvas, 0.86),
            }}
          />
        ))}
        {ticks.map(tick => (
          <View
            key={tick.left}
            style={{
              position: 'absolute',
              top: 3,
              left: tick.left - TICK_LABEL_WIDTH / 2,
              width: TICK_LABEL_WIDTH,
              alignItems: 'center',
            }}
          >
            <View
              style={{ width: 1, height: 8, backgroundColor: theme.colors.grey, opacity: 0.55 }}
            />
            {!!tick.label && (
              <Text
                className="mt-[6px] text-[11px] font-semibold text-grey"
                style={{ fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
              >
                {tick.label}
              </Text>
            )}
          </View>
        ))}
      </Animated.View>

      <Box
        className="absolute left-[0px] right-[0px] items-center"
        style={{
          top: -18,
          opacity: inTime ? 1 : 0,
        }}
      >
        <Box style={{ width: 2, height: 18 + 20, backgroundColor: theme.colors.default }} />
        <Box
          className="justify-center"
          style={{
            marginTop: -2,
            width: CURSOR_WIDTH,
            height: 26,
            borderRadius: radii.pill,
            backgroundColor: theme.colors.default,
            ...floatingShadow,
          }}
        >
          <TimelineStageYearText
            year={year}
            format={cursorFormat}
            initial={cursorInitial}
            style={{
              width: CURSOR_WIDTH,
              height: 18,
              textAlign: 'center',
              color: theme.colors.reverse,
              fontSize: 13,
              fontWeight: '600',
              fontVariant: ['tabular-nums'],
            }}
          />
        </Box>
      </Box>
    </View>
  )
}

export default TimelineStageRuler
