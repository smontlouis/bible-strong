import { formatTimelineDates } from '@bible-strong/resource-domain/timeline-dates'
import {
  findTimelinePeriod,
  TIMELINE_CARD_HEIGHT,
  TIMELINE_CARD_WIDTH,
  TIMELINE_PILL_HEIGHT,
} from '@bible-strong/resource-domain/timeline-stage'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { floatingShadow, radii } from '~common/ui/surfaces'
import { colorWithOpacity } from '~themes/colorValues'
import { useTheme } from '~themes/ThemeProvider'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getTimelineImageUri } from './timelineImage'
import { getTimelinePaintingUri } from './timelinePaintings'
import { stickyPosition, type TimelineStageEvent } from './timelineStageModel'
import { useTimelinePaintings } from './useTimelinePaintings'

/** A card follows the view along its ribbon this far from the left edge. */
const CARD_INSET = 16
const RIBBON_HEIGHT = 6
const RING_SIZE = 12

const periodColor = (event: TimelineStageEvent) => findTimelinePeriod(event.period)?.color

type ItemProps = {
  event: TimelineStageEvent
  language: ResourceLanguage
  selected: boolean
  scrollX: SharedValue<number>
  picture?: string
  onPress: (event: TimelineStageEvent) => void
}

// The shadow stays outside the card: a view that casts one no longer clips what it holds.
const CARD_SHELL = {
  width: TIMELINE_CARD_WIDTH,
  height: TIMELINE_CARD_HEIGHT,
  borderRadius: radii.control,
  ...floatingShadow,
} as const

/** The face of a card: the painting of its event, its title and its dates. */
const CardFace = ({
  event,
  dates,
  color,
  selected,
  picture,
  onPress,
}: {
  event: TimelineStageEvent
  dates: string
  color: string
  selected: boolean
  picture?: string
  onPress: (event: TimelineStageEvent) => void
}) => {
  const theme = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${dates}`}
      accessibilityState={{ selected }}
      onPress={() => onPress(event)}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        overflow: 'hidden',
        borderRadius: radii.control,
        borderWidth: 2,
        borderColor: selected ? color : 'transparent',
        backgroundColor: theme.colors.surfaceRaised,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {picture ? (
        <Image
          source={{ uri: picture }}
          recyclingKey={picture}
          contentFit="cover"
          transition={150}
          style={{
            width: TIMELINE_CARD_HEIGHT - 4,
            height: '100%',
            borderTopLeftRadius: radii.control - 2,
            borderBottomLeftRadius: radii.control - 2,
            backgroundColor: colorWithOpacity(color, 0.22),
          }}
        />
      ) : (
        <Box style={{ width: 4, backgroundColor: color }} />
      )}
      <Box className="flex-[1] justify-center gap-[3px] px-[12px]">
        <Text className="text-[13px] font-semibold leading-[16px]" numberOfLines={2}>
          {event.title}
        </Text>
        <Text className="text-[11px] text-grey" numberOfLines={1}>
          {dates}
        </Text>
      </Box>
    </Pressable>
  )
}

/**
 * A card that keeps its face while its life passes under the view, riding its ribbon. Only these
 * cards follow the view at each frame; the others stand still.
 */
const RidingShell = ({
  left,
  width,
  scrollX,
  children,
}: {
  left: number
  width: number
  scrollX: SharedValue<number>
  children: ReactNode
}) => {
  const ride = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          stickyPosition(scrollX.get(), left, width, TIMELINE_CARD_WIDTH, CARD_INSET) - left,
      },
    ],
  }))
  return <Animated.View style={[CARD_SHELL, ride]}>{children}</Animated.View>
}

/** An event drawn over the years it lasts: a ribbon to its last year, and its card riding it. */
const EventCard = ({ event, language, selected, scrollX, picture, onPress }: ItemProps) => {
  const theme = useTheme()
  const color = periodColor(event) ?? theme.colors.primary
  const dates = formatTimelineDates(event.dates, language)
  const hasRibbon = event.width > TIMELINE_CARD_WIDTH
  const face = (
    <CardFace
      event={event}
      dates={dates}
      color={color}
      selected={selected}
      picture={picture}
      onPress={onPress}
    />
  )

  return (
    <View
      style={{
        position: 'absolute',
        left: event.left,
        top: event.top,
        width: event.width,
        height: TIMELINE_CARD_HEIGHT,
        justifyContent: 'center',
        zIndex: selected ? 2 : 1,
      }}
    >
      {hasRibbon && (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={[colorWithOpacity(color, 0.7)!, colorWithOpacity(color, 0.3)!]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              position: 'absolute',
              left: 24,
              right: RING_SIZE / 2 - 1,
              height: RIBBON_HEIGHT,
              borderRadius: radii.pill,
              opacity: selected ? 1 : 0.75,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: 0,
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: radii.pill,
              borderWidth: 3,
              borderColor: color,
              backgroundColor: theme.colors.canvas,
            }}
          />
        </>
      )}
      {hasRibbon ? (
        <RidingShell left={event.left} width={event.width} scrollX={scrollX}>
          {face}
        </RidingShell>
      ) : (
        <View style={CARD_SHELL}>{face}</View>
      )}
    </View>
  )
}

/** An event drawn at the year it happens. */
const EventPill = ({ event, language, selected, onPress }: ItemProps) => {
  const theme = useTheme()
  const color = periodColor(event) ?? theme.colors.primary
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${formatTimelineDates(event.dates, language)}`}
      accessibilityState={{ selected }}
      onPress={() => onPress(event)}
      style={({ pressed }) => ({
        position: 'absolute',
        left: event.left,
        top: event.top,
        maxWidth: event.width,
        height: TIMELINE_PILL_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingLeft: 10,
        paddingRight: 12,
        borderRadius: radii.pill,
        borderWidth: selected ? 2 : 0,
        borderColor: color,
        backgroundColor: theme.colors.surfaceRaised,
        opacity: pressed ? 0.85 : 1,
        zIndex: selected ? 2 : 1,
        ...floatingShadow,
      })}
    >
      <Box style={{ width: 8, height: 8, borderRadius: radii.pill, backgroundColor: color }} />
      <Text className="flex-shrink text-[12px] font-semibold" numberOfLines={1}>
        {event.title}
      </Text>
    </Pressable>
  )
}

/** The events near the view, each on its lane; the others are not drawn. */
const TimelineStageEvents = ({
  events,
  language,
  selected,
  scrollX,
  onPress,
}: {
  events: readonly TimelineStageEvent[]
  language: ResourceLanguage
  selected?: string
  scrollX: SharedValue<number>
  onPress: (event: TimelineStageEvent) => void
}) => {
  const { paintings, known } = useTimelinePaintings()
  const pictureOf = (event: TimelineStageEvent) => {
    const painting = paintings?.[event.slug]
    if (painting) return getTimelinePaintingUri(event.slug, painting.hash, 'w256')
    // Until the catalog is known, a card waits rather than flash the old picture (ADR-0096).
    return known ? getTimelineImageUri(event.image) : undefined
  }
  return (
    <>
      {events.map(event =>
        event.card ? (
          <EventCard
            key={event.slug}
            event={event}
            language={language}
            selected={event.slug === selected}
            scrollX={scrollX}
            picture={pictureOf(event)}
            onPress={onPress}
          />
        ) : (
          <EventPill
            key={event.slug}
            event={event}
            language={language}
            selected={event.slug === selected}
            scrollX={scrollX}
            onPress={onPress}
          />
        )
      )}
    </>
  )
}

export default TimelineStageEvents
