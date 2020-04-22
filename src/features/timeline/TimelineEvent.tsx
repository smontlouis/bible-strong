import React from 'react'
import Animated, { Extrapolate, interpolate } from 'react-native-reanimated'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { offset, rowToPx, yearsToPx, calculateEventWidth } from './constants'
import { Divider } from 'react-native-paper'
import FastImage from 'react-native-fast-image'

const AnimatedBox = Animated.createAnimatedComponent(Box)

interface Props {
  row: number
  start: number
  end: number
  x: Animated.Node<number>
}

const descSize = 140
const imageSize = 60

const TimelineEvent = ({ row, start, end, x }: Props) => {
  const [top, setTop] = React.useState(rowToPx(row))
  const [left, setLeft] = React.useState(yearsToPx(start))
  const [width, setWidth] = React.useState(calculateEventWidth(start, end))

  const posX = interpolate(x, {
    inputRange: [left + offset, left + width + offset - descSize - imageSize],
    outputRange: [0, width - descSize - imageSize],
    extrapolate: Extrapolate.CLAMP,
  })

  return (
    <Box
      pos="absolute"
      h={60}
      w={width}
      left={left}
      top={top}
      rounded
      lightShadow
      row
    >
      <AnimatedBox
        width={descSize}
        pos="relative"
        px={10}
        py={6}
        center
        justifyContent="space-around"
        style={{
          transform: [{ translateX: posX }],
        }}
      >
        <Text>SETH</Text>
        <Divider style={{ width: '100%' }} />
        <Text fontSize={10}>3719-2814 av. J.C (905)</Text>
      </AnimatedBox>
      <Box
        ml="auto"
        width={imageSize}
        borderTopRightRadius={10}
        borderBottomRightRadius={10}
      >
        <FastImage
          style={{ width: imageSize, height: '100%' }}
          source={{
            uri:
              'http://timeline.biblehistory.com/media/images/t/GoodSalt-prcas2581_8-8-2013%209-50-05%20AM.jpg',
          }}
        />
      </Box>
    </Box>
  )
}

export default TimelineEvent
