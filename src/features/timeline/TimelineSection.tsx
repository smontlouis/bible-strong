import React from 'react'
import ScrollView from './ScrollView'
import Box from '~common/ui/Box'
import { useTimeline } from './timeline.hooks'
import TimelineEvent from './TimelineEvent'
import { TimelineSection as TimelineSectionProps } from './types'
import CurrentYear from './CurrentYear'
import Container from '~common/ui/Container'
import Link from '~common/Link'
import Text from '~common/ui/Text'

const Timeline = ({
  events,
  startYear,
  endYear,
  interval,
  image,
  description,
  title,
  sectionTitle,
  subTitle,
  color,
  onPrev,
  onNext,
  isCurrent,
  isFirst,
  isLast,
}: TimelineSectionProps) => {
  const {
    x,
    y,
    year,
    width,
    height,
    yearsToPx,
    calculateEventWidth,
  } = useTimeline({
    startYear,
    endYear,
    interval,
  })

  if (!isCurrent) {
    return null
  }

  return (
    <Box flex bg="#f5f6fa" pos="absolute" left={0} bottom={0} right={0} top={0}>
      <ScrollView translateX={x} translateY={y} width={width} height={height}>
        <Box width={width} height={height} lightShadow>
          <Box
            pos="relative"
            width={width}
            height={height}
            bg="lightGrey"
            pt={40}
          >
            {/* <SectionTitle
            {...{
              image,
              description,
              title,
              sectionTitle,
              subTitle,
              color,
            }}
          /> */}
            {events.map((event, i) => (
              <TimelineEvent
                x={x}
                key={i}
                yearsToPx={yearsToPx}
                calculateEventWidth={calculateEventWidth}
                {...event}
              />
            ))}

            {!isFirst && (
              <Link onPress={onPrev}>
                <Text>Previous</Text>
              </Link>
            )}
            {!isLast && (
              <Link onPress={onNext}>
                <Text>Continue</Text>
              </Link>
            )}
          </Box>
        </Box>
      </ScrollView>
      <CurrentYear year={year} />
    </Box>
  )
}
export default Timeline
