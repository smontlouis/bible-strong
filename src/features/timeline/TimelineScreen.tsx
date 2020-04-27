import React, { useRef, useCallback } from 'react'
import { View } from 'react-native'

import { events } from './events'
import TimelineSection from './TimelineSection'
import {
  TimelineSection as TimelineSectionProps,
  ShallowTimelineSection,
} from './types'

import { NavigationStackProp } from 'react-navigation-stack'

const omitEvents = ({
  events,
  ...rest
}: TimelineSectionProps): ShallowTimelineSection => rest

interface Props {
  navigation: NavigationStackProp<{ goTo: number }>
}

const Timeline = ({ navigation }: Props) => {
  const goTo = navigation.getParam('goTo', 0)

  const [current, setCurrent] = React.useState(goTo)
  const [entrance, setEntrance] = React.useState<0 | 1>(1)

  const onPrev = useCallback(() => {
    setEntrance(0)
    setCurrent(s => s - 1)
  }, [])

  const onNext = useCallback(() => {
    setEntrance(1)
    setCurrent(s => s + 1)
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f6fa' }}>
      <View style={{ flex: 1, position: 'relative' }}>
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
      </View>
    </View>
  )
}
export default Timeline
