import React, { useRef, useCallback } from 'react'
import { View } from 'react-native'

import { events } from './events'
import TimelineSection from './TimelineSection'
import TimelineHeader from './TimelineHeader'
import {
  TimelineSection as TimelineSectionProps,
  ShallowTimelineSection,
} from './types'
import {
  Transitioning,
  Transition,
  TransitioningView,
} from 'react-native-reanimated'

const omitEvents = ({
  events,
  ...rest
}: TimelineSectionProps): ShallowTimelineSection => rest

const transition = (
  <Transition.Together>
    <Transition.In type="fade" />
    <Transition.Out type="fade" />
  </Transition.Together>
)

const Timeline = ({}) => {
  const [current, setCurrent] = React.useState(0)
  const [entrance, setEntrance] = React.useState<0 | 1>(1)
  const ref = useRef<TransitioningView>(null)

  const onPrev = useCallback(() => {
    console.log('Prev')
    ref.current?.animateNextTransition()
    setEntrance(0)
    setCurrent(s => s - 1)
  }, [])

  const onNext = useCallback(() => {
    console.log('Next')
    ref.current?.animateNextTransition()
    setEntrance(1)
    setCurrent(s => s + 1)
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f6fa' }}>
      <Transitioning.View
        ref={ref}
        transition={transition}
        style={{ flex: 1, position: 'relative' }}
      >
        {events.map((ev, i) => {
          const prevEvent = events[i - 1] && omitEvents(events[i - 1])
          const nextEvent = events[i + 1] && omitEvents(events[i + 1])
          return (
            <TimelineSection
              {...ev}
              key={i}
              entrance={entrance}
              isCurrent={current === i}
              isFirst={i === 0}
              isLast={i === events.length - 1}
              onPrev={onPrev}
              onNext={onNext}
              prevEvent={prevEvent}
              nextEvent={nextEvent}
            />
          )
        })}
      </Transitioning.View>
    </View>
  )
}
export default Timeline
