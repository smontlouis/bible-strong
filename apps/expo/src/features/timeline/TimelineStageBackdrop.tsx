import { findTimelinePeriod } from '@bible-strong/resource-domain/timeline-stage'
import Color from 'color'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { floatingShadow, radii } from '~common/ui/surfaces'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getTimelinePeriodImageSource } from './timelinePeriodImages'
import TimelineStageYearText from './TimelineStageYearText'
import { stageYearNumber, stickyPosition, type TimelineStageExtent } from './timelineStageModel'

/** The tint of a period fades out over this much at each end, so periods melt into each other. */
const TINT_FADE = 420
const SCENE_MAX_WIDTH = 720

export const SERIF = 'Literata Book'

/** The tint of a period on the ground, from its first year to its last. */
export const PeriodTint = ({ extent }: { extent: TimelineStageExtent }) => {
  const color = findTimelinePeriod(extent.id)?.color
  if (!color) return null
  const tint = colorWithOpacity(color, 0.1)!
  const clear = colorWithOpacity(color, 0)!
  const fade = Math.min(TINT_FADE, extent.width / 2)
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: extent.left,
        width: extent.width,
        flexDirection: 'row',
      }}
    >
      <LinearGradient
        colors={[clear, tint]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width: fade }}
      />
      <View style={{ flex: 1, backgroundColor: tint }} />
      <LinearGradient
        colors={[tint, clear]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width: fade }}
      />
    </View>
  )
}

/**
 * The scene of a period, at the left of the view while the period is under its middle. Scenes
 * fade into the ground on both sides and into one another from a period to the next: the ground
 * covers their edges rather than revealing what lies behind, so two of them never meet.
 */
export const PeriodScene = ({
  extent,
  visible,
  viewWidth,
  height,
}: {
  extent: TimelineStageExtent
  visible: boolean
  viewWidth: number
  height: number
}) => {
  const theme = useTheme()
  const width = Math.min(viewWidth, SCENE_MAX_WIDTH)
  const ground = theme.colors.canvas
  const dark = Color(ground).isDark()
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        opacity: visible ? 1 : 0,
        transitionProperty: 'opacity',
        transitionDuration: 500,
      }}
    >
      <Image
        source={getTimelinePeriodImageSource(`timeline-period-${extent.id}`)}
        contentFit="cover"
        contentPosition={{ top: '30%', left: '50%' }}
        style={{ width, height, opacity: dark ? 0.38 : 0.55 }}
      />
      <LinearGradient
        colors={[ground, colorWithOpacity(ground, 0)!, colorWithOpacity(ground, 0)!, ground]}
        locations={[0, 0.22, 0.38, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', top: 0, left: 0, width, height }}
      />
    </Animated.View>
  )
}

/** The name of a period, in a card that keeps to the top left of the view while it passes. */
export const PeriodName = ({
  extent,
  number,
  language,
  scrollX,
  width,
  compact,
}: {
  extent: TimelineStageExtent
  number: number
  language: ResourceLanguage
  scrollX: SharedValue<number>
  width: number
  compact: boolean
}) => {
  const theme = useTheme()
  const period = findTimelinePeriod(extent.id)
  const inset = compact ? 12 : 20
  const { left, width: length } = extent
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          stickyPosition(scrollX.get(), left, length, width + inset, inset) - scrollX.get(),
      },
    ],
  }))
  if (!period) return null
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityRole="header"
      style={[
        {
          position: 'absolute',
          top: inset,
          left: 0,
          width,
          gap: 4,
          paddingHorizontal: compact ? 16 : 20,
          paddingTop: compact ? 12 : 16,
          paddingBottom: compact ? 14 : 18,
          borderRadius: radii.control,
          backgroundColor: theme.colors.surfaceRaised,
          ...floatingShadow,
        },
        style,
      ]}
    >
      <Box className="flex-row items-center gap-[10px]">
        <Box
          style={{
            paddingHorizontal: 6,
            borderWidth: 2,
            borderColor: period.color,
            borderRadius: radii.mark,
          }}
        >
          <Text className="text-[11px] font-semibold tracking-[1px]">
            {String(number).padStart(2, '0')}
          </Text>
        </Box>
        <Text className="text-[11px] font-semibold uppercase tracking-[1.6px] text-grey">
          {period.era[language]}
        </Text>
      </Box>
      <Text
        style={{ fontFamily: SERIF, fontSize: compact ? 22 : 28, lineHeight: compact ? 26 : 32 }}
      >
        {period.title[language]}
      </Text>
      {!!period.span && (
        <Text className="text-[13px] font-semibold text-grey">{period.span[language]}</Text>
      )}
      {!compact && (
        <Text className="mt-[6px] text-[13px] leading-[20px] text-grey">
          {period.summary[language]}
        </Text>
      )}
    </Animated.View>
  )
}

/** The year under the middle of the view, very large, behind the drawing. */
export const StageYear = ({
  year,
  initial,
  visible,
  viewWidth,
  viewHeight,
}: {
  year: SharedValue<number>
  initial: string
  visible: boolean
  viewWidth: number
  viewHeight: number
}) => {
  const theme = useTheme()
  const fontSize = Math.min(Math.max(viewWidth * 0.15, 72), 208)
  const right = Math.min(Math.max(viewWidth * 0.03, 16), 44)
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        top: Math.min(Math.max(viewHeight * 0.2, 120), 190),
        right,
        opacity: visible ? 0.08 : 0,
        transitionProperty: 'opacity',
        transitionDuration: 400,
      }}
    >
      <TimelineStageYearText
        year={year}
        format={stageYearNumber}
        initial={initial}
        style={{
          width: viewWidth - right * 2,
          textAlign: 'right',
          color: theme.colors.default,
          fontFamily: SERIF,
          fontSize,
          lineHeight: fontSize * 0.95,
          height: fontSize,
          letterSpacing: -fontSize * 0.02,
          fontVariant: ['tabular-nums'],
        }}
      />
    </Animated.View>
  )
}
