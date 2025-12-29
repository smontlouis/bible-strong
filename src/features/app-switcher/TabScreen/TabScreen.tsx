import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import React, { memo, Ref } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useAnimatedStyle } from 'react-native-reanimated'

import { StackNavigationProp } from '@react-navigation/stack'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import BibleTabScreen from '~features/bible/BibleTabScreen'
import CompareVersesTabScreen from '~features/bible/CompareVersesTabScreen'
import StrongTabScreen from '~features/bible/StrongTabScreen'
import CommentariesTabScreen from '~features/commentaries/CommentariesTabScreen'
import DictionaryDetailTabScreen from '~features/dictionnary/DictionaryDetailTabScreen'
import DictionaryTabScreen from '~features/dictionnary/DictionaryTabScreen'
import LexiqueTabScreen from '~features/lexique/LexiqueTabScreen'
import NaveDetailTabScreen from '~features/nave/NaveDetailTabScreen'
import NaveTabScreen from '~features/nave/NaveTabScreen'
import { NotesTabScreen } from '~features/notes'
import SearchTabScreen from '~features/search/SearchTabScreen'
import StudiesTabScreen from '~features/studies/StudiesTabScreen'
import { TabItem } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import NewTabScreen from './NewTab/NewTabScreen'

import TabScreenWrapper from './TabScreenWrapper'
import { useSafeAreaFrame } from 'react-native-safe-area-context'
import { MainStackProps } from '~navigation/type'
import { RouteProp } from '@react-navigation/native'

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
    case 'strongs':
      return {
        component: LexiqueTabScreen,
        atomName: 'strongsAtom',
      }
    case 'naves':
      return {
        component: NaveTabScreen,
        atomName: 'navesAtom',
      }
    case 'dictionaries':
      return {
        component: DictionaryTabScreen,
        atomName: 'dictionariesAtom',
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
    case 'new':
      return {
        component: NewTabScreen,
        atomName: 'newAtom',
      }
    case 'study':
      return {
        component: StudiesTabScreen,
        atomName: 'studyAtom',
      }
    case 'notes':
      return {
        component: NotesTabScreen,
        atomName: 'notesAtom',
      }
  }
}

export type TabScreenProps = {
  tabAtom: PrimitiveAtom<TabItem>
  navigation: StackNavigationProp<MainStackProps>
  route: RouteProp<MainStackProps>
  ref?: Ref<View>
}

const TabScreen = ({ tabAtom, navigation, route, ref }: TabScreenProps) => {
  const tab = useAtomValue(tabAtom)
  const { height: HEIGHT, width: WIDTH } = useSafeAreaFrame()
  const { activeTabScreen } = useAppSwitcherContext()
  const tabAtomId = tabAtom.toString()

  const imageStyles = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: WIDTH,
      bottom: 0,
      opacity: activeTabScreen.opacity.get(),
      transform: [
        {
          translateY: activeTabScreen.atomId.get() === tabAtomId ? 0 : HEIGHT,
        },
      ],
    }
  })

  const { component: Component, atomName } = getComponentTab(tab) || {}

  if (Component && atomName) {
    return (
      <TabScreenWrapper style={imageStyles} ref={ref}>
        {/* @ts-ignore */}
        <Component
          {...{
            [atomName]: tabAtom,
            navigation,
            route,
          }}
        />
      </TabScreenWrapper>
    )
  }

  return (
    <TabScreenWrapper style={imageStyles} ref={ref}>
      <Box flex={1} bg="reverse" style={StyleSheet.absoluteFill} center>
        <Text>{tab.title} - need component</Text>
      </Box>
    </TabScreenWrapper>
  )
}

export default memo(TabScreen)
