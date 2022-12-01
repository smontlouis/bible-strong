import { PrimitiveAtom, useAtom } from 'jotai'
import React, { useEffect, useRef } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
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
import CompareVersesTabScreen from '~features/bible/CompareVersesTabScreen'
import StrongTabScreen from '~features/bible/StrongTabScreen'
import CommentariesTabScreen from '~features/commentaries/CommentariesTabScreen'
import DictionaryDetailTabScreen from '~features/dictionnary/DictionaryDetailTabScreen'
import NaveDetailTabScreen from '~features/nave/NaveDetailTabScreen'
import SearchTabScreen from '~features/search/SearchTabScreen'
import {
  activeTabPropertiesAtom,
  activeTabRefAtom,
  TabItem,
} from '../../../state/tabs'
import { TAB_PREVIEW_SCALE } from '../AppSwitcherScreen/AppSwitcherScreen'

import TabScreenWrapper from './TabScreenWrapper'

export const tabTimingConfig = {
  duration: 400,
  easing: Easing.bezierFn(0.33, 0.01, 0, 1),
}

const getComponentTab = (tab: TabItem) => {
  switch (tab.type) {
    case 'bible':
      return {
        component: BibleTabScreen,
        atomName: 'bibleAtom',
      }
    case 'compare':
      return {
        component: CompareVersesTabScreen,
        atomName: 'compareAtom',
      }
    case 'strong':
      return {
        component: StrongTabScreen,
        atomName: 'strongAtom',
      }
    case 'commentary':
      return {
        component: CommentariesTabScreen,
        atomName: 'commentaryAtom',
      }
    case 'dictionary':
      return {
        component: DictionaryDetailTabScreen,
        atomName: 'dictionaryAtom',
      }
    case 'nave':
      return {
        component: NaveDetailTabScreen,
        atomName: 'naveAtom',
      }
    case 'search':
      return {
        component: SearchTabScreen,
        atomName: 'searchAtom',
      }
  }
}

const TabScreen = ({
  tabAtom,
  navigation,
}: {
  tabAtom: PrimitiveAtom<TabItem>
  navigation: NavigationStackProp
}) => {
  const [tab] = useAtom(tabAtom)
  const tabScreenRef = useRef<View>(null)
  const [, setActiveTabRef] = useAtom(activeTabRefAtom)
  const [activeTabProperties] = useAtom(activeTabPropertiesAtom)
  const { height: HEIGHT, width: WIDTH } = useWindowDimensions()

  const imageStyles = useAnimatedStyle(() => {
    if (activeTabProperties) {
      const { x, y, animationProgress } = activeTabProperties

      const interpolateProgress = (
        range: [number, number],
        easingFn = (val: number) => val
      ) =>
        interpolate(
          easingFn(animationProgress.value),
          [0, 1],
          range,
          Extrapolate.CLAMP
        )

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
        borderRadius: interpolateProgress([30, 0], Easing.in(Easing.exp)),
        opacity: interpolateProgress([0, 1], Easing.bezierFn(1, 0, 0.75, 0)),
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

  useEffect(() => {
    setActiveTabRef(tabScreenRef)

    return () => {
      setActiveTabRef(undefined)
    }
  }, [setActiveTabRef])

  const { component: Component, atomName } = getComponentTab(tab) || {}

  if (Component && atomName) {
    return (
      <TabScreenWrapper style={imageStyles} ref={tabScreenRef}>
        {/* @ts-ignore */}
        <Component
          {...{
            [atomName]: tabAtom,
            navigation,
          }}
        />
      </TabScreenWrapper>
    )
  }

  return (
    <TabScreenWrapper style={imageStyles} ref={tabScreenRef}>
      <Box flex={1} bg="reverse" style={StyleSheet.absoluteFill} center>
        <Text>{tab.title}</Text>
      </Box>
    </TabScreenWrapper>
  )
}

export default TabScreen
