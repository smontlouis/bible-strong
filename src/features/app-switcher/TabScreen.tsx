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
import CompareVersesTabScreen from '~features/bible/CompareVersesTabScreen'
import StrongTabScreen from '~features/bible/StrongTabScreen'
import CommentariesTabScreen from '~features/commentaries/CommentariesTabScreen'
import DictionaryDetailTabScreen from '~features/dictionnary/DictionaryDetailTabScreen'
import NaveDetailTabScreen from '~features/nave/NaveDetailTabScreen'
import SearchTabScreen from '~features/search/SearchTabScreen'
import {
  activeTabPropertiesAtom,
  BibleTab,
  CommentaryTab,
  CompareTab,
  DictionaryTab,
  NaveTab,
  SearchTab,
  StrongTab,
  TabItem,
} from '../../state/tabs'
import { TAB_PREVIEW_SCALE } from './AppSwitcherScreen'
import TabScreenWrapper from './TabScreenWrapper'

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
      <TabScreenWrapper style={imageStyles}>
        <BibleTabScreen
          bibleAtom={tabAtom as PrimitiveAtom<BibleTab>}
          navigation={navigation}
        />
      </TabScreenWrapper>
    )
  }

  if (tab.type === 'compare') {
    return (
      <TabScreenWrapper style={imageStyles}>
        <CompareVersesTabScreen
          navigation={navigation}
          compareAtom={tabAtom as PrimitiveAtom<CompareTab>}
        />
      </TabScreenWrapper>
    )
  }

  if (tab.type === 'strong') {
    return (
      <TabScreenWrapper style={imageStyles}>
        <StrongTabScreen
          navigation={navigation}
          strongAtom={tabAtom as PrimitiveAtom<StrongTab>}
        />
      </TabScreenWrapper>
    )
  }

  if (tab.type === 'nave') {
    return (
      <TabScreenWrapper style={imageStyles}>
        <NaveDetailTabScreen
          navigation={navigation}
          naveAtom={tabAtom as PrimitiveAtom<NaveTab>}
        />
      </TabScreenWrapper>
    )
  }

  if (tab.type === 'dictionary') {
    return (
      <TabScreenWrapper style={imageStyles}>
        <DictionaryDetailTabScreen
          navigation={navigation}
          dictionaryAtom={tabAtom as PrimitiveAtom<DictionaryTab>}
        />
      </TabScreenWrapper>
    )
  }

  if (tab.type === 'commentary') {
    return (
      <TabScreenWrapper style={imageStyles}>
        <CommentariesTabScreen
          navigation={navigation}
          commentaryAtom={tabAtom as PrimitiveAtom<CommentaryTab>}
        />
      </TabScreenWrapper>
    )
  }

  if (tab.type === 'search') {
    return (
      <TabScreenWrapper style={imageStyles}>
        <SearchTabScreen
          navigation={navigation}
          searchAtom={tabAtom as PrimitiveAtom<SearchTab>}
        />
      </TabScreenWrapper>
    )
  }

  return (
    <TabScreenWrapper style={imageStyles}>
      <Box flex={1} bg="reverse" style={StyleSheet.absoluteFill} center>
        <Text>{tab.title}</Text>
      </Box>
    </TabScreenWrapper>
  )
}

export default TabScreen
