import type { StudyLinkLanguage } from '@bible-strong/resource-domain/contracts/studyLinksContract'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import Animated from 'react-native-reanimated'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import Card from '~common/ui/Card'
import { StudySection } from '~common/ui/StudySection'
import { radii } from '~common/ui/surfaces'
import Text from '~common/ui/Text'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  getOfflineResourceQuerySignal,
  useOfflineResourceRegistry,
} from '~features/resources/useOfflineResourceRegistry'
import { timelineEventsQueryOptions } from '~features/timeline/timelineEventsQuery'
import { useTimelinePaintings } from '~features/timeline/useTimelinePaintings'
import { staticResourceQueryOptions } from '~helpers/queryOptions'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import {
  buildEntityChronology,
  closestMark,
  seenEvents,
  type ChronologyEvent,
  type ChronologyRuler,
  type EntityChronology,
} from './entityChronology'
import { studyLinkRoute } from './studyLinksPresentation'
import { StudyLinksSection, useStudyLinks } from './StudyLinksSections'

/** The page's margin: the strip runs past it to the edges of the screen. */
const PAGE_GUTTER = 20
const CARD_WIDTH = 200
const CARD_GAP = 12
const CARD_STEP = CARD_WIDTH + CARD_GAP
const IMAGE_RATIO = 3 / 2
const RULER_ROW = 12
const RULER_MARK = 9

// On the Web a press is the browser's click, which measures from its target in other names.
const touchPoint = (touch: {
  locationX?: number
  locationY?: number
  offsetX?: number
  offsetY?: number
}) => ({
  x: touch.locationX ?? touch.offsetX ?? 0,
  y: touch.locationY ?? touch.offsetY ?? 0,
})

const Picture = ({ uri, width }: { uri?: string; width?: number }) => (
  <Box className="bg-light-grey" style={{ width: width ?? '100%', aspectRatio: IMAGE_RATIO }}>
    {!!uri && (
      <Image
        source={{ uri }}
        contentFit="cover"
        transition={150}
        style={{ width: '100%', height: '100%' }}
      />
    )}
  </Box>
)

const Ruler = ({
  ruler,
  count,
  seen,
  pointed,
  pointedEvent,
  onPoint,
}: {
  ruler: ChronologyRuler
  count: number
  seen?: { first: number; last: number }
  pointed?: number
  pointedEvent?: ChronologyEvent
  onPoint: (event: number) => void
}) => {
  const { t } = useTranslation()
  const [width, setWidth] = useState(0)
  const height = ruler.levels * RULER_ROW
  return (
    <VStack className="gap-[8px]">
      {/* The cards say all of this: the ruler is for the eye and the finger. */}
      <Pressable
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ height, marginHorizontal: RULER_MARK / 2 }}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        onPress={event => {
          const mark = closestMark(ruler.marks, touchPoint(event.nativeEvent), {
            width,
            rowHeight: RULER_ROW,
            levels: ruler.levels,
          })
          if (mark) onPoint(mark.event)
        }}
      >
        <View
          pointerEvents="none"
          className="absolute bg-separator"
          style={{
            bottom: (RULER_MARK - 2) / 2,
            left: -RULER_MARK / 2,
            right: -RULER_MARK / 2,
            height: 2,
          }}
        />
        {ruler.marks.map(mark => {
          const isSeen = !seen || (mark.event >= seen.first && mark.event <= seen.last)
          const isPointed = mark.event === pointed
          return (
            <Animated.View
              key={mark.event}
              pointerEvents="none"
              className={isPointed ? 'absolute bg-default' : 'absolute'}
              style={{
                left: `${mark.left}%`,
                bottom: mark.level * RULER_ROW,
                width: `${mark.width}%`,
                minWidth: RULER_MARK,
                height: RULER_MARK,
                marginLeft: -RULER_MARK / 2,
                borderRadius: radii.pill,
                opacity: isSeen || isPointed ? 1 : 0.35,
                transitionProperty: 'opacity',
                transitionDuration: 180,
                ...(isPointed ? {} : { backgroundColor: ruler.color }),
              }}
            />
          )
        })}
      </Pressable>
      {pointedEvent ? (
        <Text className="text-[13px] text-default text-center" numberOfLines={1}>
          {`${pointedEvent.dates} · ${pointedEvent.title}`}
        </Text>
      ) : (
        <HStack className="items-baseline justify-between gap-[12px]">
          <Text className="text-[13px] text-grey">{ruler.from}</Text>
          <Text className="text-[13px] text-grey">{t('studyLinks.eventCount', { count })}</Text>
          <Text className="text-[13px] text-grey">{ruler.to}</Text>
        </HStack>
      )}
    </VStack>
  )
}

const Timeline = ({
  chronology,
  language,
}: {
  chronology: EntityChronology
  language: StudyLinkLanguage
}) => {
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const strip = useRef<ScrollView>(null)
  const viewport = useRef(0)
  const [seen, setSeen] = useState<{ first: number; last: number }>()
  const [pointed, setPointed] = useState<number>()
  const { lead, events, ruler, periods } = chronology

  const open = (event: ChronologyEvent) => pushRouteOnce(studyLinkRoute(event.link, language))

  const measure = (offset: number) => {
    const shown = seenEvents({
      offset,
      viewport: viewport.current,
      count: events.length,
      inset: PAGE_GUTTER,
      cardWidth: CARD_WIDTH,
      gap: CARD_GAP,
    })
    setSeen(current =>
      current?.first === shown.first && current.last === shown.last ? current : shown
    )
  }

  const reveal = (event: number) =>
    strip.current?.scrollTo({ x: event * CARD_STEP, animated: true })

  return (
    <StudySection title={t('studyLinks.timeline')} surface="none">
      {lead && (
        <TouchableBox
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${lead.title}, ${lead.dates}`}
          onPress={() => open(lead)}
        >
          <Card>
            <Picture uri={lead.image} />
            <VStack className="gap-[2px] p-[16px]">
              <Text className="text-[17px] font-bold">{lead.title}</Text>
              <Text className="text-[13px] text-link font-bold">{lead.dates}</Text>
              {!!lead.summary && (
                <Text className="mt-[6px] text-[14px] leading-[20px] text-grey" numberOfLines={3}>
                  {lead.summary}
                </Text>
              )}
            </VStack>
          </Card>
        </TouchableBox>
      )}

      {ruler && (
        <Box className="mt-[8px]">
          <Ruler
            ruler={ruler}
            count={events.length}
            seen={seen}
            pointed={pointed}
            pointedEvent={pointed === undefined ? undefined : events[pointed]}
            onPoint={event => {
              setPointed(event)
              reveal(event)
            }}
          />
        </Box>
      )}

      {periods.length > 0 && (
        <HStack className="flex-wrap gap-[8px]">
          {periods.map(period => (
            <TouchableBox
              key={period.id}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${period.title}, ${period.count}`}
              className="flex-row items-center gap-[6px] rounded-full bg-light-primary px-[12px] py-[5px]"
              onPress={() => reveal(period.first)}
            >
              <Box
                style={{
                  width: RULER_MARK,
                  height: RULER_MARK,
                  borderRadius: radii.pill,
                  backgroundColor: period.color,
                }}
              />
              <Text className="text-[13px] text-link">{period.title}</Text>
              <Text className="text-[13px] text-link">{period.count}</Text>
            </TouchableBox>
          ))}
        </HStack>
      )}

      {events.length > 0 && (
        <ScrollView
          ref={strip}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -PAGE_GUTTER }}
          contentContainerStyle={{ gap: CARD_GAP, paddingHorizontal: PAGE_GUTTER }}
          snapToInterval={CARD_STEP}
          decelerationRate="fast"
          scrollEventThrottle={64}
          onLayout={(event: LayoutChangeEvent) => {
            viewport.current = event.nativeEvent.layout.width
            measure(0)
          }}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
            measure(event.nativeEvent.contentOffset.x)
          }
          onScrollBeginDrag={() => setPointed(undefined)}
        >
          {events.map(event => (
            <TouchableBox
              key={event.link.key}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${event.title}, ${event.dates}`}
              style={{ width: CARD_WIDTH }}
              onPress={() => open(event)}
            >
              <Card className="flex-[1]">
                <Picture uri={event.image} width={CARD_WIDTH} />
                <VStack className="gap-[2px] p-[12px]">
                  <HStack className="items-center gap-[6px]">
                    {periods.length > 0 && (
                      <Box
                        style={{
                          width: RULER_MARK,
                          height: RULER_MARK,
                          borderRadius: radii.pill,
                          backgroundColor: periods.find(item => item.id === event.period)?.color,
                        }}
                      />
                    )}
                    <Text className="text-[13px] text-link font-bold">{event.dates}</Text>
                  </HStack>
                  <Text className="text-[15px] font-bold" numberOfLines={3}>
                    {event.title}
                  </Text>
                </VStack>
              </Card>
            </TouchableBox>
          ))}
        </ScrollView>
      )}
    </StudySection>
  )
}

/**
 * What the timeline holds on an entity: the event about it, a ruler that shows the shape of a
 * life, and the events one after the other. Without the index of the timeline, as offline with
 * no copy of it, its links stay plain rows.
 */
const EntityChronologySection = ({
  subjectKey,
  language,
}: {
  subjectKey: string
  language: StudyLinkLanguage
}) => {
  const { t } = useTranslation()
  const resources = useResourceAccess()
  const resourceRegistry = useOfflineResourceRegistry()
  const links = useStudyLinks('entity', subjectKey, language)
  const timelineLinks = links.filter(link => link.kind === 'timeline')
  const enabled = timelineLinks.length > 0

  const indexQuery = useQuery({
    ...staticResourceQueryOptions,
    queryKey: [
      ...resourceQueryKeys.timeline(language),
      'index',
      getOfflineResourceQuerySignal(resourceRegistry, {
        kind: 'database',
        databaseId: 'TIMELINE',
        language,
      }),
    ],
    queryFn: () => resources.timeline.loadIndex(language),
    enabled,
    networkMode: 'always',
  })
  const sectionsQuery = useQuery({ ...timelineEventsQueryOptions, enabled })

  const { paintings, known: paintingsKnown } = useTimelinePaintings()

  const index = indexQuery.data?.status === 'available' ? indexQuery.data.details : undefined
  const chronology =
    index &&
    buildEntityChronology(
      timelineLinks,
      index,
      (sectionsQuery.data ?? []).map(section => ({
        id: section.id,
        title: language === 'fr' ? section.title : section.titleEn,
        color: section.color,
      })),
      language,
      paintings
    )

  if (!enabled || indexQuery.isPending || sectionsQuery.isPending || !paintingsKnown) return null
  if (!chronology) {
    return (
      <StudyLinksSection
        title={t('studyLinks.timeline')}
        links={timelineLinks}
        language={language}
      />
    )
  }
  return <Timeline chronology={chronology} language={language} />
}

export default EntityChronologySection
