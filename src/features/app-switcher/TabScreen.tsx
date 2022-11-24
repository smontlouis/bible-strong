import { PrimitiveAtom, useAtom } from 'jotai'
import React, { useEffect } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import {
  Easing,
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import { NavigationStackProp } from 'react-navigation-stack'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import BibleTabScreen from '~features/bible/BibleTabScreen'
import { activeTabPropertiesAtom, BibleTab, TabItem } from '../../state/tabs'
import { TAB_PREVIEW_SCALE } from './AppSwitcherScreen'
import { AnimatedBox } from './TabPreview'

export const tabTimingConfig = {
  duration: 400,
  easing: Easing.bezierFn(0.33, 0.01, 0, 1),
}

const TabScreen = ({
  tabAtom,
  navigation,
}: {
  tabAtom: PrimitiveAtom<TabItem>
  navigation: NavigationStackProp
}) => {
  const [tab] = useAtom(tabAtom)
  const [activeTabProperties] = useAtom(activeTabPropertiesAtom)
  const { height: HEIGHT, width: WIDTH } = useWindowDimensions()

  const imageStyles = useAnimatedStyle(() => {
    if (activeTabProperties) {
      const { x, y, animationProgress } = activeTabProperties

      const interpolateProgress = (range: [number, number]) =>
        interpolate(animationProgress.value, [0, 1], range, Extrapolate.CLAMP)

      const top = interpolateProgress([
        y.value === 0
          ? 0
          : y.value - HEIGHT / 2 + (HEIGHT * TAB_PREVIEW_SCALE) / 2,
        0,
      ])
      const left = interpolateProgress([
        x.value === 0
          ? 0
          : x.value - WIDTH / 2 + (WIDTH * TAB_PREVIEW_SCALE) / 2,
        0,
      ])

      return {
        position: 'absolute',
        top,
        left,
        width: WIDTH,
        height: HEIGHT,
        transform: [
          {
            scale: interpolateProgress([TAB_PREVIEW_SCALE, 1]),
          },
        ],
        borderRadius: interpolateProgress([30, 0]),
        opacity: interpolateProgress([0, 1]),
      }
    }

    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: WIDTH,
      height: HEIGHT,
      borderRadius: 30,
    }
  })

  useEffect(() => {
    if (activeTabProperties) {
      const { animationProgress } = activeTabProperties
      animationProgress.value = withTiming(1, tabTimingConfig)
    }
  }, [activeTabProperties])

  if (tab.type === 'bible') {
    return (
      <AnimatedBox style={imageStyles}>
        <BibleTabScreen
          bibleAtom={tabAtom as PrimitiveAtom<BibleTab>}
          navigation={navigation}
        />
      </AnimatedBox>
    )
  }
  return (
    <AnimatedBox style={imageStyles}>
      <Box flex={1} bg="reverse" style={StyleSheet.absoluteFill} center>
        <Text>{tab.name}</Text>
      </Box>
    </AnimatedBox>
  )
}

export default TabScreen
