import Loading from '~common/Loading'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { parseSourcedTimelineDates } from './sourcedDates'
import type { EventDetailsProps } from './EventDetails'
import useTimelineLanguage from './useTimelineLanguage'
import { getLegacyLocalizedField } from '~helpers/languageUtils'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useQuery } from '@tanstack/react-query'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { getEvents } from './events'
import TimelineEventDetailView from './TimelineEventDetailView'
import { TimelineEvent } from './types'
import { IS_FORM_SHEET } from '~helpers/constants'

const EventScreen = () => {
  const pushRouteOnce = usePushRouteOnce()
  const { t } = useTranslation()
  const preferredLanguage = useTimelineLanguage()
  const openInNewTab = useOpenInNewTab()
  const params = useLocalSearchParams<{ slug?: string; language?: string }>()
  const language =
    params.language === 'fr' || params.language === 'en' ? params.language : preferredLanguage
  const { data: sections, isPending: metadataPending } = useQuery({
    queryKey: ['timeline'],
    queryFn: getEvents,
  })

  const eventsWithSection = sections?.flatMap((section, sectionIndex) =>
    section.events.map(event => ({ ...event, sectionIndex }))
  )
  const metadata = eventsWithSection?.find(item => item.slug === params.slug)
  const resources = useResourceAccess()
  const fallback = useQuery({
    queryKey: ['timeline-direct-event', language, params.slug],
    queryFn: () => resources.timeline.loadEvent(language, params.slug!),
    enabled: Boolean(params.slug && !metadata),
    staleTime: 300000,
  })
  const detail = fallback.data?.status === 'available' ? fallback.data.detail : undefined
  const dates = detail ? parseSourcedTimelineDates(detail.dates) : undefined
  const directEvent: (EventDetailsProps & { sectionIndex?: number }) | undefined = detail
    ? {
        slug: detail.slug,
        title: detail.title,
        titleEn: detail.title,
        image: undefined,
        start: dates?.start ?? 0,
        end: dates?.end ?? 0,
        dateLabel: detail.dates || t('timeline.unknownDate'),
      }
    : undefined
  const event = metadata || directEvent

  const openEvent = (nextEvent: TimelineEvent) => {
    pushRouteOnce({
      pathname: '/event',
      params: { slug: nextEvent.slug, language },
    })
  }

  const openEventInNewTab = () => {
    if (!event) return

    openInNewTab({
      id: `timeline-${generateUUID()}`,
      title: getLegacyLocalizedField(language, { fr: event.title, en: event.titleEn }),
      isRemovable: true,
      type: 'timeline',
      data: {
        language,
        sectionIndex: event.sectionIndex,
        eventSlug: event.slug,
        event: {
          dateLabel: 'dateLabel' in event ? event.dateLabel : undefined,
          slug: event.slug,
          title: event.title,
          titleEn: event.titleEn,
          image: event.image,
          start: event.start,
          end: event.end,
          sectionIndex: event.sectionIndex,
        },
      },
    })
  }

  if (!event && params.slug && (metadataPending || fallback.isPending)) return <Loading />
  return (
    <TimelineEventDetailView
      languageOverride={language}
      event={event}
      onOpenEvent={openEvent}
      canGoBack
      isFormSheet={IS_FORM_SHEET}
      menuItems={[
        {
          label: t('tab.openInNewTab'),
          icon: 'external-link',
          onSelect: openEventInNewTab,
        },
      ]}
    />
  )
}

export default EventScreen
