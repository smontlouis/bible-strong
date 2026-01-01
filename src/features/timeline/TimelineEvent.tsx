import React from 'react'
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated'

import BottomSheet from '@gorhom/bottom-sheet'
import { Image } from 'expo-image'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import useLanguage from '~helpers/useLanguage'
import { calculateLabel, offset, rowToPx } from './constants'
import { TimelineEvent as TimelineEventProps } from './types'

const AnimatedBox = Animated.createAnimatedComponent(Box)
const LinkBox = Box.withComponent(Link)

interface Props extends TimelineEventProps {
  x: SharedValue<number>
  yearsToPx: (years: number) => number
  eventModalRef: React.RefObject<BottomSheet | null>
  setEvent: (event: Partial<TimelineEventProps>) => void
  calculateEventWidth: (yearStart: number, yearEnd: number, isFixed?: boolean) => number
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
  const { current: width } = React.useRef(calculateEventWidth(start, end, isFixed))

  const label = calculateLabel(start, end)

  const onOpenEvent = () => {
    eventModalRef.current?.expand()
    setEvent({ slug, title, titleEn, image, start, end })
  }

  const posX = useDerivedValue(() => {
    return interpolate(
      x.get() * -1,
      [left + offset, left + width + offset - descSize - imageSize],
      [0, width - descSize - imageSize],
      Extrapolation.CLAMP
    )
  })

  const styles = useAnimatedStyle(() => ({
    transform: [{ translateX: posX.get() }],
  }))

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
        style={styles}
      >
        <Text fontSize={12} numberOfLines={2}>
          {isFR ? title : titleEn}
        </Text>
        <Box borderBottomWidth={1} borderColor="border" />
        <Text fontSize={10} textAlign="center">
          {label}
        </Text>
      </AnimatedBox>
      <Box ml="auto" width={imageSize} borderTopRightRadius={10} borderBottomRightRadius={10}>
        <Image
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
