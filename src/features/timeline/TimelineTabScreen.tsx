import { produce } from 'immer'
import { useAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler } from 'react-native'

import { useQuery } from '~helpers/react-query-lite'
import { TimelineTab, useIsCurrentTab } from '~state/tabs'
import { getEvents } from './events'
import TimelineEventDetailPage from './TimelineEventDetailPage'
import TimelineHomeScreen from './TimelineHomeScreen'
import TimelineScreen from './TimelineScreen'
import { TimelineEvent } from './types'

interface Props {
  timelineAtom: PrimitiveAtom<TimelineTab>
}

const TimelineTabScreen = ({ timelineAtom }: Props) => {
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
  }, [isCurrentTab, timelineAtom, timelineTab.data.eventSlug, timelineTab.data.sectionIndex])

  if (timelineTab.data.eventSlug) {
    return <TimelineEventDetailPage event={activeEvent} onOpenEvent={goToEvent} />
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
