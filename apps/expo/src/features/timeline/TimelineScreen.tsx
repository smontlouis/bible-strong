import React, { useCallback } from 'react'
import { View } from 'react-native'

import TimelineSection from './TimelineSection'
import { TimelineSection as TimelineSectionProps, ShallowTimelineSection } from './types'

import { useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import { getEvents } from './events'
import Box from '~common/ui/Box'
import TimelineResourceBoundary from './TimelineResourceBoundary'

const omitEvents = ({ events, ...rest }: TimelineSectionProps): ShallowTimelineSection => rest

interface Props {
  initialSectionIndex?: number
  isFormSheet?: boolean
  onBackPress?: () => void
  onSectionChange?: (sectionIndex: number) => void
}

const Timeline = ({
  initialSectionIndex,
  isFormSheet = false,
  onBackPress,
  onSectionChange,
}: Props) => {
  const params = useLocalSearchParams<{ goTo?: string }>()
  const goTo = initialSectionIndex ?? (params.goTo ? Number(params.goTo) : 0)
  const canGoBackInStack = useCanGoBackInStack()
  const hasBackButton = isFormSheet ? canGoBackInStack : Boolean(onBackPress) || canGoBackInStack

  const [current, setCurrent] = React.useState(goTo)
  const [entrance, setEntrance] = React.useState<0 | 1>(1)
  const { data: events } = useQuery({
    queryKey: ['timeline'],
    queryFn: getEvents,
  })
  const currentSectionIndex = events?.length
    ? Math.min(Math.max(current, 0), events.length - 1)
    : current

  const onPrev = useCallback(() => {
    const next = currentSectionIndex - 1
    setEntrance(0)
    setCurrent(next)
    onSectionChange?.(next)
  }, [currentSectionIndex, onSectionChange])

  const onNext = useCallback(() => {
    const next = currentSectionIndex + 1
    setEntrance(1)
    setCurrent(next)
    onSectionChange?.(next)
  }, [currentSectionIndex, onSectionChange])

  return (
    <TimelineResourceBoundary hasBackButton={hasBackButton} onBackPress={onBackPress}>
      <Box flex bg="reverse">
        <View style={{ flex: 1, position: 'relative' }}>
          {events?.map((ev, i) => {
            const prevEvent = events[i - 1] && omitEvents(events[i - 1])
            const nextEvent = events[i + 1] && omitEvents(events[i + 1])
            return (
              <TimelineSection
                {...ev}
                key={`${ev.id}-${currentSectionIndex === i}`}
                entrance={entrance}
                isCurrent={currentSectionIndex === i}
                isFirst={i === 0}
                isLast={i === events.length - 1}
                onPrev={onPrev}
                onNext={onNext}
                onBackPress={onBackPress}
                hasBackButton={hasBackButton}
                isFormSheet={isFormSheet}
                prevEvent={prevEvent}
                nextEvent={nextEvent}
                sectionIndex={i}
              />
            )
          })}
        </View>
      </Box>
    </TimelineResourceBoundary>
  )
}
export default Timeline
