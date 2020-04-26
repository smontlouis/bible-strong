import React, { useRef } from 'react'
import { View } from 'react-native'
import Box from '~common/ui/Box'

import { events } from './events'
import TimelineSection from './TimelineSection'

const Timeline = ({}) => {
  const [current, setCurrent] = React.useState(0)
  const onPrev = () => {
    console.log('Prev')
    setCurrent(s => s - 1)
  }

  const onNext = () => {
    console.log('Next')
    setCurrent(s => s + 1)
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f6fa' }}>
      {events.map((ev, i) => (
        <TimelineSection
          {...ev}
          key={i}
          isCurrent={current === i}
          isFirst={i === 0}
          isLast={i === events.length - 1}
          onPrev={onPrev}
          onNext={onNext}
        />
      ))}
    </View>
  )
}
export default Timeline
