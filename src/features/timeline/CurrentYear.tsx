import React from 'react'
import { ReText } from 'react-native-redash'
import Animated, {
  interpolate,
  Extrapolate,
  multiply,
  concat,
} from 'react-native-reanimated'
import { getBottomSpace } from 'react-native-iphone-x-helper'

import Box, { AnimatedBox } from '~common/ui/Box'
import Link from '~common/Link'
import { offset } from './constants'
import { FeatherIcon } from '~common/ui/Icon'
import { wp } from '~helpers/utils'
import { Platform } from 'react-native'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'

const LinkBox = Box.withComponent(Link)

const CurrentYear = ({
  year,
  x,
  width,
  lineX,
  color,
  onPrev,
  onNext,
  nextColor,
  prevColor,
}: {
  year: Animated.Node<string>
  x: Animated.Value<number>
  lineX: Animated.Node<number>
  color: string
  width: number
  onPrev: () => void
  onNext: () => void
  prevColor?: string
  nextColor?: string
}) => {
  const r = useMediaQueriesArray()
  const progressInSection = concat(
    interpolate(multiply(-1, x), {
      inputRange: [0, width - wp(100)],
      outputRange: [0, 100],
      extrapolate: Extrapolate.CLAMP,
    }),
    '%'
  )

  return (
    <AnimatedBox
      style={{ transform: [{ translateX: lineX }] }}
      pos="absolute"
      bottom={getBottomSpace()}
      left={0}
      right={0}
      height={r([30, 40, 60, 60])}
    >
      {prevColor && (
        <LinkBox
          onPress={onPrev}
          height={r([30, 40, 60, 60])}
          width={r([30, 40, 60, 60])}
          borderTopRightRadius={5}
          borderTopLeftRadius={5}
          pos="absolute"
          left={0}
          bottom={0}
          center
          bg="reverse"
          lightShadow
        >
          <FeatherIcon name="chevrons-left" size={20} color={prevColor} />
        </LinkBox>
      )}
      {nextColor && (
        <LinkBox
          ml="auto"
          onPress={onNext}
          height={r([30, 40, 60, 60])}
          width={r([30, 40, 60, 60])}
          borderTopRightRadius={5}
          borderTopLeftRadius={5}
          pos="absolute"
          right={0}
          bottom={0}
          center
          bg="reverse"
          lightShadow
        >
          <FeatherIcon name="chevrons-right" size={20} color={nextColor} />
        </LinkBox>
      )}
      <Box
        pointerEvents="none"
        pos="absolute"
        l={offset - 50}
        b={0}
        bg={color}
        width={100}
        height={30}
        center
        borderTopLeftRadius={5}
        borderTopRightRadius={5}
        paddingTop={Platform.OS === 'android' ? 8 : 0}
      >
        <ReText
          text={year}
          style={{
            color: 'white',
            width: 120,
            textAlign: 'center',
            fontWeight: 'bold',
            ...(Platform.OS === 'android' && {
              lineHeight: 1,
              textAlignVertical: 'center',
            }),
          }}
        />
      </Box>
      <AnimatedBox
        lightShadow
        position="absolute"
        left={0}
        b={0}
        bg={color}
        height={3}
        style={{
          width: progressInSection,
        }}
      />
    </AnimatedBox>
  )
}

export default CurrentYear
