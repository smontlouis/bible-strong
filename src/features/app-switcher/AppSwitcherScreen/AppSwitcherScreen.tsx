import { useAtom } from 'jotai'
import React from 'react'
import { useWindowDimensions } from 'react-native'
import { NavigationStackScreenProps } from 'react-navigation-stack'

import Animated from 'react-native-reanimated'
import Box, { AnimatedBox } from '~common/ui/Box'
import { tabsAtomsAtom } from '../../../state/tabs'
import AddTab from '../AddTab'
import useAppSwitcher from './useAppSwitcher'
import TabPreview from '../TabPreview'
import BottomTabBar from '~features/app-switcher/BottomTabBar/BottomTabBar'
import TabScreen from '../TabScreen/TabScreen'
import { ScrollView } from 'react-native-gesture-handler'
import { AppSwitcherProvider } from '../AppSwitcherProvider'

interface AppSwitcherProps {}

export const TAB_PREVIEW_SCALE = 0.6

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

const AppSwitcherScreen = ({
  navigation,
}: NavigationStackScreenProps<AppSwitcherProps>) => {
  const [tabsAtoms] = useAtom(tabsAtomsAtom)
  const { width } = useWindowDimensions()
  const {
    scrollViewRef,
    tapGestureRefs,
    onItemPress,
    onDeleteItem,
    scrollHandler,
    PADDING_HORIZONTAL,
    scrollViexBoxStyle,
    activeAtom,
  } = useAppSwitcher()

  return (
    <AppSwitcherProvider>
      <Box flex={1} bg="lightGrey" center>
        <AddTab />
        <AnimatedScrollView
          // @ts-ignore
          ref={scrollViewRef}
          simultaneousHandlers={tapGestureRefs}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate={0}
          snapToInterval={width * TAB_PREVIEW_SCALE + 20}
          onScroll={scrollHandler}
          style={{ flexGrow: 0, overflow: 'visible' }}
          contentContainerStyle={{
            alignItems: 'center',
            paddingLeft: PADDING_HORIZONTAL,
            paddingRight: PADDING_HORIZONTAL,
          }}
        >
          <AnimatedBox overflow="visible" row style={scrollViexBoxStyle}>
            {tabsAtoms.map((tabAtom, i) => (
              <TabPreview
                key={`${tabAtom}`}
                index={i}
                tabAtom={tabAtom}
                marginRight={i !== tabsAtoms.length - 1 ? 20 : 0}
                tapGestureRef={tapGestureRefs[i]}
                simultaneousHandlers={scrollViewRef}
                onPress={onItemPress}
                onDelete={onDeleteItem}
              />
            ))}
          </AnimatedBox>
        </AnimatedScrollView>
        {activeAtom && (
          <TabScreen tabAtom={activeAtom} navigation={navigation} />
        )}
        <BottomTabBar />
      </Box>
    </AppSwitcherProvider>
  )
}

export default AppSwitcherScreen
