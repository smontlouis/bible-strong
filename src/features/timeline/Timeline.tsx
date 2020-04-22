import React from 'react'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Animated, { useCode, call } from 'react-native-reanimated'
import { useValues, onScrollEvent } from 'react-native-redash'
import TimelineEvent from './TimelineEvent'

import {
  offset,
  scrollViewWidth,
  scrollViewHeight,
  pxToYears,
} from './constants'
import Container from '~common/ui/Container'

const events = [
  {
    row: 1,
    id: 1016,
    period: 1,
    hoverId: 1023,
    slug: 'adam',
    start: -4100,
    end: -3924,
  },
  {
    row: 3,
    id: 1016,
    period: 1,
    hoverId: 1023,
    slug: 'adam',
    start: -3924,
    end: -2912,
  },
  {
    row: 5,
    id: 1016,
    period: 1,
    hoverId: 1023,
    slug: 'pouce',
    start: -3854,
    end: -3500,
  },
  {
    row: 8,
    id: 1016,
    period: 1,
    hoverId: 1023,
    slug: 'balaham',
    start: -4000,
    end: -3950,
  },
]

const CurrentYear = ({ year }: { year: number }) => (
  <>
    <Box
      pos="absolute"
      b={0}
      l={offset}
      w={1}
      h="100%"
      bg="primary"
      opacity={0.3}
    />
    <Box
      pos="absolute"
      l={offset}
      b={0}
      bg="primary"
      p={10}
      width={80}
      transform={[{ translateX: -(80 / 2) }]}
      center
      rounded
    >
      <Text fontSize={14} title color="reverse">
        {year}
      </Text>
    </Box>
  </>
)

const Timeline = () => {
  const [currentYear, setCurrentYear] = React.useState(-4100)
  const [x] = useValues([0], [])

  useCode(() => {
    return call([x], ([x]) => {
      setCurrentYear(pxToYears(x))
    })
  }, [x])

  return (
    <Container noPadding>
      <Box flex>
        <CurrentYear year={currentYear} />
        <Animated.ScrollView
          onScroll={onScrollEvent({ x })}
          scrollEventThrottle={1}
          contentContainerStyle={{
            position: 'relative',
            width: scrollViewWidth,
            height: scrollViewHeight,
          }}
          style={{
            paddingLeft: offset,
          }}
        >
          {events.map((event, i) => (
            <TimelineEvent
              x={x}
              key={i}
              row={event.row}
              start={event.start}
              end={event.end}
            />
          ))}
        </Animated.ScrollView>
      </Box>
    </Container>
  )
}

export default Timeline
