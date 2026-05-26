import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler } from 'react-native'
import { useRouter } from 'expo-router'

import { useQuery } from '~helpers/react-query-lite'
import { TimelineTab, useIsCurrentTab } from '~state/tabs'
import { getEvents } from './events'
import TimelineEventDetailView from './TimelineEventDetailView'
import TimelineHomeScreen from './TimelineHomeScreen'
import TimelineScreen from './TimelineScreen'
import { TimelineEvent } from './types'

interface Props {
  timelineAtom: PrimitiveAtom<TimelineTab>
}

const TimelineTabScreen = ({ timelineAtom }: Props) => {
  const router = useRouter()
  const { t } = useTranslation()
  const [timelineTab, setTimelineTab] = useAtom(timelineAtom)
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
    router.push({
      pathname: '/event',
      params: { slug: event.slug },
    })
  }

  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isCurrentTab(timelineAtom)) return false

      if (timelineTab.data.eventSlug) {
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
    isCurrentTab,
    timelineAtom,
    timelineTab.data.eventSlug,
    timelineTab.data.sectionIndex,
  ])

  if (timelineTab.data.eventSlug) {
    return (
      <TimelineEventDetailView
        event={activeEvent}
        onOpenEvent={goToEvent}
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
