import { PrimitiveAtom, useAtom } from 'jotai'
import React, { memo } from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import { useAnimatedStyle } from 'react-native-reanimated'

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
import { TabItem } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'

import TabScreenWrapper from './TabScreenWrapper'

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
  const { height: HEIGHT, width: WIDTH } = useWindowDimensions()
  const { activeTabScreen } = useAppSwitcherContext()

  const imageStyles = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: WIDTH,
      height: HEIGHT,
      opacity: activeTabScreen.opacity.value,
    }
  })

  const { component: Component, atomName } = getComponentTab(tab) || {}

  if (Component && atomName) {
    return (
      <TabScreenWrapper style={imageStyles} ref={activeTabScreen.ref}>
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
    <TabScreenWrapper style={imageStyles} ref={activeTabScreen.ref}>
      <Box flex={1} bg="reverse" style={StyleSheet.absoluteFill} center>
        <Text>{tab.title}</Text>
      </Box>
    </TabScreenWrapper>
  )
}

export default memo(TabScreen)
