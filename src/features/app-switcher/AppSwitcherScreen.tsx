import { useAtom } from 'jotai'
import React, { RefObject, useEffect, useRef } from 'react'
import { useWindowDimensions } from 'react-native'
import { NavigationStackScreenProps } from 'react-navigation-stack'
import { ScrollView, TapGestureHandler } from 'react-native-gesture-handler'

import Box from '~common/ui/Box'
import { activeTabIndexAtom, tabsAtomsAtom } from '../../state/tabs'
import TabPreview from './TabPreview'
import TabScreen from './TabScreen'

interface AppSwitcherProps {}

export const TAB_PREVIEW_SCALE = 0.6

const AppSwitcherScreen = ({
  navigation,
}: NavigationStackScreenProps<AppSwitcherProps>) => {
  const [tabsAtoms] = useAtom(tabsAtomsAtom)
  const [activeTabIndex] = useAtom(activeTabIndexAtom)
  const { width } = useWindowDimensions()

  const scrollViewRef = useRef<ScrollView>(null)
  const tapGestureRefs = useRef<RefObject<TapGestureHandler>[]>(
    tabsAtoms.map(() => React.createRef())
  )

  const activeAtom =
    typeof activeTabIndex !== 'undefined'
      ? tabsAtoms[activeTabIndex]
      : undefined

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: (width * TAB_PREVIEW_SCALE + 20) * (activeTabIndex || 0),
        animated: false,
      })
    }, 0)
  }, [])

  return (
    <Box flex={1} bg="border">
      <ScrollView
        ref={scrollViewRef}
        simultaneousHandlers={tapGestureRefs}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate={0}
        snapToInterval={width * TAB_PREVIEW_SCALE + 20}
        style={{
          flex: 1,
        }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingLeft: width / 2 - (width * TAB_PREVIEW_SCALE) / 2,
          paddingRight: width / 2 - (width * TAB_PREVIEW_SCALE) / 2,
        }}
      >
        {tabsAtoms.map((tabAtom, i) => (
          <TabPreview
            key={i}
            index={i}
            tabAtom={tabAtom}
            marginRight={i !== tabsAtoms.length - 1 ? 20 : 0}
            tapGestureRef={tapGestureRefs.current[i]}
            simultaneousHandlers={scrollViewRef}
          />
        ))}
      </ScrollView>
      {activeAtom && <TabScreen tabAtom={activeAtom} navigation={navigation} />}
    </Box>
  )
}

export default AppSwitcherScreen
