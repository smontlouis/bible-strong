import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler } from 'react-native'

import { useQuery } from '~helpers/react-query-lite'
import { TimelineTab, useIsCurrentTab } from '~state/tabs'
import type { EventDetailsProps } from './EventDetails'
import { getEvents } from './events'
import TimelineEventDetailPage from './TimelineEventDetailPage'
import TimelineHomeScreen from './TimelineHomeScreen'
import TimelineScreen from './TimelineScreen'
import { TimelineEvent } from './types'

interface Props {
  timelineAtom: PrimitiveAtom<TimelineTab>
}

type TimelineEventHistoryItem = EventDetailsProps & { sectionIndex?: number }

const TimelineTabScreen = ({ timelineAtom }: Props) => {
  const { t } = useTranslation()
  const [timelineTab, setTimelineTab] = useAtom(timelineAtom)
  const [eventHistory, setEventHistory] = React.useState<TimelineEventHistoryItem[]>([])
  const isCurrentTab = useIsCurrentTab()
  const { data: sections } = useQuery({
    queryKey: 'timeline',
    queryFn: getEvents,
  })

  const eventsWithSection = sections?.flatMap((section, sectionIndex) =>
    section.events.map(event => ({ ...event, sectionIndex }))
  )
  const activeEvent =
    eventsWithSection?.find(event => event.slug === timelineTab.data.eventSlug) ||
    timelineTab.data.event

  const goHome = () => {
    setEventHistory([])
    setTimelineTab(
      produce(draft => {
        draft.title = t('Chronologie de la Bible')
        draft.data.sectionIndex = undefined
        draft.data.eventSlug = undefined
        draft.data.event = undefined
      })
    )
  }

  const goToSection = (sectionIndex: number) => {
    const section = sections?.[sectionIndex]

    setEventHistory([])
    setTimelineTab(
      produce(draft => {
        draft.title = section?.title || t('Chronologie de la Bible')
        draft.data.sectionIndex = sectionIndex
        draft.data.eventSlug = undefined
        draft.data.event = undefined
      })
    )
  }

  const goToEvent = (event: TimelineEvent) => {
    if (timelineTab.data.eventSlug && activeEvent) {
      setEventHistory(prev => [...prev, activeEvent])
    }

    setTimelineTab(
      produce(draft => {
        draft.title = event.title
        draft.data.sectionIndex = event.sectionIndex ?? draft.data.sectionIndex
        draft.data.eventSlug = event.slug
        draft.data.event = {
          slug: event.slug,
          title: event.title,
          titleEn: event.titleEn,
          image: event.image,
          start: event.start,
          end: event.end,
          sectionIndex: event.sectionIndex ?? draft.data.sectionIndex,
        }
      })
    )
  }

  const goBackEvent = () => {
    const previousEvent = eventHistory[eventHistory.length - 1]

    if (!previousEvent) return

    setEventHistory(prev => prev.slice(0, -1))
    setTimelineTab(
      produce(draft => {
        draft.title = previousEvent.title
        draft.data.sectionIndex = previousEvent.sectionIndex ?? draft.data.sectionIndex
        draft.data.eventSlug = previousEvent.slug
        draft.data.event = {
          slug: previousEvent.slug,
          title: previousEvent.title,
          titleEn: previousEvent.titleEn,
          image: previousEvent.image,
          start: previousEvent.start,
          end: previousEvent.end,
          sectionIndex: previousEvent.sectionIndex ?? draft.data.sectionIndex,
        }
      })
    )
  }

  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isCurrentTab(timelineAtom)) return false

      if (timelineTab.data.eventSlug) {
        if (eventHistory.length > 0) {
          goBackEvent()
        }
        return true
      }

      if (timelineTab.data.sectionIndex !== undefined) {
        goHome()
        return true
      }

      return false
    })

    return () => backHandler.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    eventHistory.length,
    isCurrentTab,
    timelineAtom,
    timelineTab.data.eventSlug,
    timelineTab.data.sectionIndex,
  ])

  if (timelineTab.data.eventSlug) {
    return (
      <TimelineEventDetailPage
        event={activeEvent}
        onOpenEvent={goToEvent}
        canGoBack={eventHistory.length > 0}
        onBack={goBackEvent}
      />
    )
  }

  if (timelineTab.data.sectionIndex !== undefined) {
    return (
      <TimelineScreen
        initialSectionIndex={timelineTab.data.sectionIndex}
        onBackPress={goHome}
        onSectionChange={goToSection}
      />
    )
  }

  return <TimelineHomeScreen hasBackButton={false} onSectionPress={goToSection} />
}

export default TimelineTabScreen
