import { PrimitiveAtom } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import React, { memo, Ref } from 'react'
import { StyleSheet, View } from 'react-native'
import { useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import BibleTabScreen from '~features/bible/BibleTabScreen'
import CompareVersesTabScreen from '~features/bible/CompareVersesTabScreen'
import StrongTabScreen from '~features/lexique/StrongTabScreen'
import CommentariesTabScreen from '~features/commentaries/CommentariesTabScreen'
import DictionaryTabScreen from '~features/dictionnary/DictionaryTabScreen'
import NaveTabScreen from '~features/nave/NaveTabScreen'
import { NotesTabScreen } from '~features/notes'
import PlanTabScreen from '~features/plans/PlanTabScreen'
import SearchTabScreen from '~features/search/SearchTabScreen'
import StudiesTabScreen from '~features/studies/StudiesTabScreen'
import TimelineTabScreen from '~features/timeline/TimelineTabScreen'
import {
  BibleTab,
  CommentaryTab,
  CompareTab,
  DictionaryTab,
  NaveTab,
  NewTab,
  NotesTab,
  PlanTab,
  SearchTab,
  StrongTab,
  StudyTab,
  TabItem,
  TimelineTab,
} from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import NewTabScreen from './NewTab/NewTabScreen'
import useScrollToActiveTab from '../utils/useScrollToActiveTab'

import TabScreenWrapper from './TabScreenWrapper'
import { useSafeAreaFrame } from 'react-native-safe-area-context'

const renderTabComponent = (tab: TabItem, tabAtom: PrimitiveAtom<TabItem>) => {
  switch (tab.type) {
    case 'bible':
      return <BibleTabScreen bibleAtom={tabAtom as PrimitiveAtom<BibleTab>} />
    case 'compare':
      return <CompareVersesTabScreen compareAtom={tabAtom as PrimitiveAtom<CompareTab>} />
    case 'strong':
      return <StrongTabScreen strongAtom={tabAtom as PrimitiveAtom<StrongTab>} />
    case 'nave':
      return <NaveTabScreen naveAtom={tabAtom as PrimitiveAtom<NaveTab>} />
    case 'dictionary':
      return <DictionaryTabScreen dictionaryAtom={tabAtom as PrimitiveAtom<DictionaryTab>} />
    case 'commentary':
      return <CommentariesTabScreen commentaryAtom={tabAtom as PrimitiveAtom<CommentaryTab>} />
    case 'search':
      return <SearchTabScreen searchAtom={tabAtom as PrimitiveAtom<SearchTab>} />
    case 'new':
      return <NewTabScreen newAtom={tabAtom as PrimitiveAtom<NewTab>} />
    case 'study':
      return <StudiesTabScreen studyAtom={tabAtom as PrimitiveAtom<StudyTab>} />
    case 'notes':
      return <NotesTabScreen notesAtom={tabAtom as PrimitiveAtom<NotesTab>} />
    case 'plan':
      return <PlanTabScreen planAtom={tabAtom as PrimitiveAtom<PlanTab>} />
    case 'timeline':
      return <TimelineTabScreen timelineAtom={tabAtom as PrimitiveAtom<TimelineTab>} />
  }
}

export type TabScreenProps = {
  tabAtom: PrimitiveAtom<TabItem>
  ref?: Ref<View>
}

const TabScreen = ({ tabAtom, ref }: TabScreenProps) => {
  const tab = useAtomValue(tabAtom)
  const { height: HEIGHT, width: WIDTH } = useSafeAreaFrame()
  const { activeTabScreen } = useAppSwitcherContext()
  const scrollToActiveTab = useScrollToActiveTab()

  const tabId = tab.id

  const tabComponent = renderTabComponent(tab, tabAtom)

  // Scroll to active tab in background when this tab becomes visible
  useAnimatedReaction(
    () => activeTabScreen.tabId.get() === tabId,
    (isActive, wasActive) => {
      if (isActive && !wasActive) {
        runOnJS(scrollToActiveTab)()
      }
    }
  )

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
          translateY: activeTabScreen.tabId.get() === tabId ? 0 : HEIGHT,
        },
      ],
    }
  })

  if (tabComponent) {
    return (
      <TabScreenWrapper style={imageStyles} ref={ref}>
        {tabComponent}
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
