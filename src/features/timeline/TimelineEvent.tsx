import React from 'react'
import Animated, {
  Extrapolate,
  interpolate,
  multiply,
  useCode,
  call,
} from 'react-native-reanimated'

import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { offset, rowToPx } from './constants'
import { Divider } from 'react-native-paper'
import FastImage from 'react-native-fast-image'
import { TimelineEvent as TimelineEventProps } from './types'

const AnimatedBox = Animated.createAnimatedComponent(Box)
const LinkBox = Box.withComponent(Link)

interface Props extends TimelineEventProps {
  x: Animated.Node<number>
  yearsToPx: (years: number) => number
  calculateEventWidth: (
    yearStart: number,
    yearEnd: number,
    isFixed?: boolean
  ) => number
}

const descSize = 140
const imageSize = 60

const calculateLabel = (start: number, end: number) => {
  const absStart = Math.abs(start)
  const absEnd = Math.abs(end)
  const range = Math.abs(start - end)

  if (start >= 3000 && end >= 3000) {
    return 'Après le millenium'
  }

  if (start >= 2010 && end >= 2010) {
    return 'Futur'
  }

  if (end === 2020) {
    return `${absStart}-Futur`
  }

  if (end === 1844) {
    return '457 av. J.-C. à 1844'
  }

  if (start === end) {
    return `${absStart}${start < 0 ? ' av. J.-C.' : ''}`
  }

  if (start < 0 && end < 0) {
    return `${absStart}-${absEnd} av. J.-C.${range > 50 ? ` (${range})` : ''}`
  }

  if (start > 0 && end > 0) {
    return `${absStart}-${absEnd}${range > 50 ? ` (${range})` : ''}`
  }

  if (start < 0 && end > 0) {
    return `${absStart} av. J.-C à ${end}${range > 50 ? ` (${range})` : ''}`
  }

  return start
}

const TimelineEvent = ({
  slug,
  row,
  title,
  start,
  image,
  end,
  type,
  isFixed,
  x,
  yearsToPx,
  calculateEventWidth,
}: Props) => {
  const { current: top } = React.useRef(rowToPx(row))
  const { current: left } = React.useRef(yearsToPx(start))
  const { current: width } = React.useRef(
    calculateEventWidth(start, end, isFixed)
  )

  const label = calculateLabel(start, end)

  const onOpenEvent = () => {
    console.log(slug)
  }

  if (type === 'minor') {
    return (
      <LinkBox
        onPress={onOpenEvent}
        pos="absolute"
        h={25}
        left={left + offset}
        top={top}
        rounded
        bg="reverse"
        lightShadow
        row
      >
        <Box
          borderTopLeftRadius={10}
          borderBottomLeftRadius={10}
          bg="tertiary"
          px={10}
          justifyContent="center"
        >
          <Text color="white" fontSize={10} numberOfLines={1}>
            {title}
          </Text>
        </Box>
        <Box px={10} justifyContent="center">
          <Text fontSize={8}>{label}</Text>
        </Box>
      </LinkBox>
    )
  }

  const posX = interpolate(multiply(x, -1), {
    inputRange: [left + offset, left + width + offset - descSize - imageSize],
    outputRange: [0, width - descSize - imageSize],
    extrapolate: Extrapolate.CLAMP,
  })

  return (
    <LinkBox
      onPress={onOpenEvent}
      pos="absolute"
      h={60}
      w={width}
      left={left + offset}
      top={top}
      rounded
      bg="reverse"
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
        <Text fontSize={12} numberOfLines={2}>
          {title}
        </Text>
        <Divider style={{ width: '100%' }} />
        <Text fontSize={10} textAlign="center">
          {label}
        </Text>
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
            uri: image,
          }}
        />
      </Box>
    </LinkBox>
  )
}

export default TimelineEvent
