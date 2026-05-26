import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import generateUUID from '~helpers/generateUUID'
import { useQuery } from '~helpers/react-query-lite'
import { getEvents } from './events'
import TimelineEventDetailView from './TimelineEventDetailView'
import { TimelineEvent } from './types'

const EventScreen = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()
  const params = useLocalSearchParams<{ slug?: string }>()
  const { data: sections } = useQuery({
    queryKey: 'timeline',
    queryFn: getEvents,
  })

  const eventsWithSection = sections?.flatMap((section, sectionIndex) =>
    section.events.map(event => ({ ...event, sectionIndex }))
  )
  const event = eventsWithSection?.find(item => item.slug === params.slug)

  const openEvent = (nextEvent: TimelineEvent) => {
    router.push({
      pathname: '/event',
      params: { slug: nextEvent.slug },
    })
  }

  const openEventInNewTab = () => {
    if (!event) return

    openInNewTab({
      id: `timeline-${generateUUID()}`,
      title: event.title,
      isRemovable: true,
      type: 'timeline',
      data: {
        sectionIndex: event.sectionIndex,
        eventSlug: event.slug,
        event: {
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

  return (
    <TimelineEventDetailView
      event={event}
      onOpenEvent={openEvent}
      isFormSheet
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
