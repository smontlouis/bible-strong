import React, { useCallback } from 'react'
import { View } from 'react-native'

import TimelineSection from './TimelineSection'
import { TimelineSection as TimelineSectionProps, ShallowTimelineSection } from './types'

import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '~helpers/react-query-lite'
import { getEvents } from './events'

const omitEvents = ({ events, ...rest }: TimelineSectionProps): ShallowTimelineSection => rest

interface Props {
  initialSectionIndex?: number
  onBackPress?: () => void
  onSectionChange?: (sectionIndex: number) => void
}

const Timeline = ({ initialSectionIndex, onBackPress, onSectionChange }: Props) => {
  const params = useLocalSearchParams<{ goTo?: string }>()
  const goTo = initialSectionIndex ?? (params.goTo ? Number(params.goTo) : 0)

  const [current, setCurrent] = React.useState(goTo)
  const [entrance, setEntrance] = React.useState<0 | 1>(1)

  const onPrev = useCallback(() => {
    setEntrance(0)
    setCurrent(s => {
      const next = s - 1
      onSectionChange?.(next)
      return next
    })
  }, [onSectionChange])

  const onNext = useCallback(() => {
    setEntrance(1)
    setCurrent(s => {
      const next = s + 1
      onSectionChange?.(next)
      return next
    })
  }, [onSectionChange])

  const { data: events } = useQuery({
    queryKey: 'timeline',
    queryFn: getEvents,
  })

  React.useEffect(() => {
    if (!events?.length) return

    setCurrent(value => Math.min(Math.max(value, 0), events.length - 1))
  }, [events?.length])

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f6fa' }}>
      <View style={{ flex: 1, position: 'relative' }}>
        {events?.map((ev, i) => {
          const prevEvent = events[i - 1] && omitEvents(events[i - 1])
          const nextEvent = events[i + 1] && omitEvents(events[i + 1])
          return (
            <TimelineSection
              {...ev}
              key={`${i}-${current === i}`}
              entrance={entrance}
              isCurrent={current === i}
              isFirst={i === 0}
              isLast={i === events.length - 1}
              onPrev={onPrev}
              onNext={onNext}
              onBackPress={onBackPress}
              prevEvent={prevEvent}
              nextEvent={nextEvent}
              sectionIndex={i}
            />
          )
        })}
      </View>
    </View>
  )
}
export default Timeline
