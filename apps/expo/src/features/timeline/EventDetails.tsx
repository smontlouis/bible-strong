import { timelineContext } from '~features/study-assistant/referenceContext'
import { titleFontStyle } from '~themes/styleValues'
import { useAssistantResourceContext } from '~features/study-assistant/useAssistantResourceContext'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import useTimelineLanguage from './useTimelineLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import Box, { HStack, VStack } from '~common/ui/Box'
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
import { Image } from 'expo-image'
import Media from './EventDetailsMedia'
import Loading from '~common/Loading'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import {
  getOfflineResourceQuerySignal,
  useOfflineResourceRegistry,
} from '~features/resources/useOfflineResourceRegistry'
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

  return (
    <Box className="overflow-hidden border-continuous">
      <VStack className="gap-[10px] pt-[2px] pb-[4px]">
        {image && (
          <Image
            style={{ width: 120, height: 120, borderRadius: radii.card, marginBottom: 6 }}
            source={{
              uri: image,
            }}
          />
        )}
        <HStack className="items-center gap-[10px]">
          <IconTile bg={timelineUniverse.background}>
            <FeatherIcon name="clock" size={18} color={timelineUniverse.foreground} />
          </IconTile>
          <Text className="flex-[1] text-[15px] text-grey">{date}</Text>
        </HStack>
        <Text className="text-[30px] leading-[38px]" style={titleFontStyle(stylingTheme)}>
          {getLegacyLocalizedField(lang, { fr: title, en: titleEn })}
        </Text>
      </VStack>
      <Description {...event} />
      <Media {...event} onOpenEvent={onOpenEvent} />
    </Box>
  )
}

const EventDetails = (props: EventDetailsProps) => <EventDetailsContent {...props} />

export default EventDetails
