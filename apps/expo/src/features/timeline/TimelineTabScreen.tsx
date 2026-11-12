import { findTimelinePeriod } from '@bible-strong/resource-domain/timeline-stage'
import { produce } from 'immer'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { activeTabIdAtom, TimelineTab } from '~state/tabs'
import TimelineStageScreen from './TimelineStageScreen'
import type { TimelineStagePosition } from './TimelineStage'
import { timelineUnderSheetAtom } from './timelineStageAtoms'
import useTimelineLanguage from './useTimelineLanguage'

interface Props {
  timelineAtom: PrimitiveAtom<TimelineTab>
}

/** A tab keeps the year it shows once the view has come to rest. */
const REMEMBER_AFTER = 600

/** The timeline in a tab: it opens where the tab was left, and names the period it shows. */
const TimelineTabScreen = ({ timelineAtom }: Props) => {
  const { t } = useTranslation()
  const preferredLanguage = useTimelineLanguage()
  const [timelineTab, setTimelineTab] = useAtom(timelineAtom)
  const language = timelineTab.data.language ?? preferredLanguage
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Tabs opened before the timeline had a single axis name a period by its index.
  const [start] = useState(() => {
    const { eventSlug, year, sectionIndex } = timelineTab.data
    if (eventSlug) return { event: eventSlug }
    if (year !== undefined) return { year }
    if (sectionIndex !== undefined) return { period: String(sectionIndex + 1) }
    return undefined
  })

  useEffect(() => () => clearTimeout(timer.current), [])

  // A tab opened on an event shows it, in its sheet over the timeline, once the tab is in front.
  const isCurrent = useAtomValue(activeTabIdAtom) === timelineTab.id
  const pushRouteOnce = usePushRouteOnce()
  const setUnderSheet = useSetAtom(timelineUnderSheetAtom)
  const startEventOpened = useRef(false)
  const openStartEvent = useEffectEvent(() => {
    if (startEventOpened.current || !start?.event) return
    startEventOpened.current = true
    setUnderSheet(true)
    pushRouteOnce({ pathname: '/event', params: { slug: start.event, language } })
  })
  useEffect(() => {
    if (isCurrent) openStartEvent()
  }, [isCurrent])

  const remember = ({ period, year }: TimelineStagePosition) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setTimelineTab(
        produce(draft => {
          draft.title = period
            ? (findTimelinePeriod(period)?.title[language] ?? t('Chronologie de la Bible'))
            : t('Chronologie de la Bible')
          draft.data.year = period ? year : undefined
          draft.data.eventSlug = undefined
          draft.data.event = undefined
          draft.data.sectionIndex = undefined
        })
      )
    }, REMEMBER_AFTER)
  }

  return (
    <TimelineStageScreen
      languageOverride={timelineTab.data.language}
      hasBackButton={false}
      start={start}
      onPositionChange={remember}
      assistantScope={`tab:${timelineTab.id}`}
    />
  )
}

export default TimelineTabScreen
