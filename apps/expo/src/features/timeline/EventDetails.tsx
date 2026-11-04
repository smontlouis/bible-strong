import { formatTimelineDates, timelineYearSpan } from '@bible-strong/resource-domain/timeline-dates'
import { TIMELINE_LAYOUT } from '@bible-strong/resource-domain/timeline-stage'
import { timelineContext } from '~features/study-assistant/referenceContext'
import { titleFontStyle } from '~themes/styleValues'
import { useAssistantResourceContext } from '~features/study-assistant/useAssistantResourceContext'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import { useRouter } from 'expo-router'
import ListSection, { ListRow } from '~common/ui/ListSection'
import useTimelineLanguage from './useTimelineLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import IconTile from '~common/ui/IconTile'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { StudySection } from '~common/ui/StudySection'
import { useTranslation } from 'react-i18next'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import Paragraph from '~common/ui/Paragraph'
import { radii } from '~common/ui/surfaces'
import { calculateLabel } from './constants'
import { TimelineEventDetail, TimelineEvent as TimelineEventProps } from './types'
import { getTimelineEventPictures, type TimelinePicture } from './timelinePaintings'
import { useTimelineEventPicture, useTimelinePaintings } from './useTimelinePaintings'
import { Image } from 'expo-image'
import StudyLinksSections from '~features/studyLinks/StudyLinksSections'
import Media from './EventDetailsMedia'
import Loading from '~common/Loading'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import {
  getOfflineResourceQuerySignal,
  useOfflineResourceRegistry,
} from '~features/resources/useOfflineResourceRegistry'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { timelineUnderSheetAtom } from './timelineStageAtoms'
import { useTimelineNeighbours } from './useTimelineNeighbours'
export type EventDetailsProps = Pick<
  TimelineEventProps,
  'slug' | 'image' | 'title' | 'titleEn' | 'start' | 'end'
> & { dateLabel?: string }

const Description = ({ description, article }: Partial<TimelineEventDetail>) => {
  const { t } = useTranslation()
  if (!description && !article) return null
  return (
    <StudySection title={t('timeline.event.description')}>
      {!!description && (
        <Paragraph className="font-semibold" scale={-1}>
          {description}
        </Paragraph>
      )}
      {!!article && <Paragraph scale={-1}>{article}</Paragraph>}
    </StudySection>
  )
}

/** Takes the reader to the place of an event on the timeline. */
const LocateOnTimeline = ({ slug, language }: { slug: string; language: ResourceLanguage }) => {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <TouchableBox
      className="self-start py-[4px]"
      accessibilityRole="link"
      onPress={() => router.dismissTo({ pathname: '/timeline', params: { event: slug, language } })}
    >
      <Text className="text-[15px] font-semibold text-link">{t('timeline.event.locate')}</Text>
    </TouchableBox>
  )
}

/** The events before and after this one, one step away, as the public site shows them. */
const Neighbours = ({ slug, language }: { slug: string; language: ResourceLanguage }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const { previous, next } = useTimelineNeighbours(slug, language)
  if (!previous && !next) return null
  // The sheet turns to the neighbour rather than piling one more page on the way back.
  const step = (neighbour: string) => router.setParams({ slug: neighbour })
  return (
    <ListSection title={t('timeline.event.neighbours')} className="mx-[0px] mt-[26px]">
      {[
        previous && (
          <ListRow
            key="previous"
            icon={<FeatherIcon name="arrow-left" size={18} color="grey" />}
            iconTint="grey"
            label={previous.title}
            description={`${t('timeline.event.previous')} · ${formatTimelineDates(previous.dates, language)}`}
            hasChevron={false}
            onPress={() => step(previous.slug)}
          />
        ),
        next && (
          <ListRow
            key="next"
            icon={<FeatherIcon name="arrow-right" size={18} color="grey" />}
            iconTint="grey"
            label={next.title}
            description={`${t('timeline.event.next')} · ${formatTimelineDates(next.dates, language)}`}
            hasChevron={false}
            onPress={() => step(next.slug)}
          />
        ),
      ].filter(Boolean)}
    </ListSection>
  )
}

export const EventDetailsContent = ({
  dateLabel,
  languageOverride,
  assistantScope = 'panel',
  slug,
  image,
  title,
  titleEn,
  start,
  end,
  onOpenEvent,
}: EventDetailsProps & {
  languageOverride?: 'fr' | 'en'
  assistantScope?: string
  onOpenEvent?: (event: TimelineEventProps) => void
}) => {
  const preferredLanguage = useTimelineLanguage()
  const stylingTheme = useStylingTheme()
  const lang = languageOverride || preferredLanguage
  const date = dateLabel || calculateLabel(start, end, lang)
  const fallbackPicture = useTimelineEventPicture(slug, image, 'w1254')
  const { paintings, known } = useTimelinePaintings()
  const resources = useResourceAccess()
  const preferredResourceLanguage = useAtomValue(resourcesLanguageAtom).TIMELINE
  const resourceLanguage = languageOverride || preferredResourceLanguage
  const resourceRegistry = useOfflineResourceRegistry()
  const eventQuery = useQuery({
    queryKey: [
      ...resourceQueryKeys.timeline(resourceLanguage),
      'event',
      slug,
      getOfflineResourceQuerySignal(resourceRegistry, {
        kind: 'database',
        databaseId: 'TIMELINE',
        language: resourceLanguage,
      }),
    ],
    queryFn: () => resources.timeline.loadEvent(resourceLanguage, slug),
    networkMode: 'always',
  })
  const event = eventQuery.data?.status === 'available' ? eventQuery.data.detail : undefined
  // Under a timeline that opened this sheet, the event is already shown on it.
  const underTimeline = useAtomValue(timelineUnderSheetAtom)

  useAssistantResourceContext(assistantScope, timelineContext(event, resourceLanguage))

  if (eventQuery.isPending) {
    return (
      <Box className="overflow-hidden border-continuous py-[40px] items-center justify-center">
        <Loading />
      </Box>
    )
  }

  if (!event) {
    return null
  }

  const timelineUniverse = resolveUniverseColors(stylingTheme.colors, 'timeline')
  // The first picture is shown large at the top; the gallery below only shows the others.
  const pictures: TimelinePicture[] = known
    ? getTimelineEventPictures(slug, event.images, paintings?.[slug])
    : []
  const [cover, ...otherPictures] =
    pictures.length || !fallbackPicture ? pictures : [{ uri: fallbackPicture, caption: '' }]
  const painted = Boolean(paintings?.[slug])

  return (
    <Box className="overflow-hidden border-continuous">
      <VStack className="gap-[10px] pt-[2px] pb-[4px]">
        {cover && (
          <VStack className="mb-[6px] gap-[8px]">
            <Image
              style={{ width: '100%', aspectRatio: 1, borderRadius: radii.card }}
              source={{ uri: cover.uri }}
              // A painting fills its square; a picture of the publication keeps its own shape.
              contentFit={painted ? 'cover' : 'contain'}
              accessibilityLabel={getLegacyLocalizedField(lang, { fr: title, en: titleEn })}
            />
            {!!cover.caption && (
              <Text className="text-center text-[13px] text-grey">{cover.caption}</Text>
            )}
          </VStack>
        )}
        <HStack className="items-center gap-[10px]">
          <IconTile bg={timelineUniverse.background}>
            <FeatherIcon name="clock" size={18} color={timelineUniverse.foreground} />
          </IconTile>
          <Text className="flex-[1] text-[15px] text-grey">
            {/* Written from the dating of the publication, as on the timeline and the site. */}
            {event.dates ? formatTimelineDates(event.dates, resourceLanguage) : date}
          </Text>
        </HStack>
        <Text className="text-[30px] leading-[38px]" style={titleFontStyle(stylingTheme)}>
          {getLegacyLocalizedField(lang, { fr: title, en: titleEn })}
        </Text>
        {!underTimeline && (TIMELINE_LAYOUT[slug] || timelineYearSpan(event.dates)) && (
          <LocateOnTimeline slug={slug} language={resourceLanguage} />
        )}
      </VStack>
      <Description {...event} />
      <Media {...event} pictures={otherPictures} onOpenEvent={onOpenEvent} />
      <StudyLinksSections kind="timeline" subjectKey={slug} language={resourceLanguage} />
      <Neighbours slug={slug} language={resourceLanguage} />
    </Box>
  )
}

const EventDetails = (props: EventDetailsProps) => <EventDetailsContent {...props} />

export default EventDetails
