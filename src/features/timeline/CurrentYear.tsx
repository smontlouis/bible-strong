import React from 'react'
import {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated'
import { ReText } from 'react-native-redash'

import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Link from '~common/Link'
import Box, { AnimatedBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import { wp, wpUI } from '~helpers/utils'
import { offset } from './constants'

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
  year: SharedValue<string>
  x: SharedValue<number>
  lineX: SharedValue<number>
  color: string
  width: number
  onPrev: () => void
  onNext: () => void
  prevColor?: string
  nextColor?: string
}) => {
  const r = useMediaQueriesArray()
  const progressInSection = useDerivedValue(() => {
    const progress = interpolate(
      x.value * -1,
      [0, width - wpUI(100)],
      [0, 100],
      Extrapolation.CLAMP
    )
    return Math.round(progress)
  })

  return (
    <AnimatedBox
      style={useAnimatedStyle(() => ({
        transform: [{ translateX: lineX.value }],
      }))}
      pos="absolute"
      bottom={useSafeAreaInsets().bottom}
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
        style={useAnimatedStyle(() => ({
          width: `${progressInSection.value}%`,
        }))}
      />
    </AnimatedBox>
  )
}

export default CurrentYear
