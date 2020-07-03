import React from 'react'
import Animated, {
  Extrapolate,
  interpolate,
  multiply,
} from 'react-native-reanimated'

import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import { offset, rowToPx, calculateLabel } from './constants'
import { Divider } from 'react-native-paper'
import FastImage from 'react-native-fast-image'
import { TimelineEvent as TimelineEventProps } from './types'
import { Modalize } from 'react-native-modalize'
import useLanguage from '~helpers/useLanguage'

const AnimatedBox = Animated.createAnimatedComponent(Box)
const LinkBox = Box.withComponent(Link)

interface Props extends TimelineEventProps {
  x: Animated.Node<number>
  yearsToPx: (years: number) => number
  eventModalRef: React.RefObject<Modalize>
  setEvent: (event: Partial<TimelineEventProps>) => void
  calculateEventWidth: (
    yearStart: number,
    yearEnd: number,
    isFixed?: boolean
  ) => number
}

const descSize = 140
const imageSize = 60

const TimelineEvent = ({
  slug,
  row,
  title,
  titleEn,
  start,
  image,
  end,
  type,
  isFixed,
  x,
  yearsToPx,
  calculateEventWidth,
  eventModalRef,
  setEvent,
}: Props) => {
  const isFR = useLanguage()
  const { current: top } = React.useRef(rowToPx(row))
  const { current: left } = React.useRef(yearsToPx(start))
  const { current: width } = React.useRef(
    calculateEventWidth(start, end, isFixed)
  )

  const label = calculateLabel(start, end)

  const onOpenEvent = () => {
    eventModalRef.current?.open()
    setEvent({ slug, title, image, start, end })
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
            {isFR ? title : titleEn}
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
          {isFR ? title : titleEn}
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
