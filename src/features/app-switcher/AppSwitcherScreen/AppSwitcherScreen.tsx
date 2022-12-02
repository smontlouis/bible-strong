import { useAtom } from 'jotai'
import React, { useEffect, useRef } from 'react'
import { Text, useWindowDimensions, View } from 'react-native'
import { NavigationStackScreenProps } from 'react-navigation-stack'

import Animated from 'react-native-reanimated'
import Box, { AnimatedBox } from '~common/ui/Box'
import { tabsAtomsAtom } from '../../../state/tabs'
import AddTab from '../AddTab'
import useAppSwitcher from './useAppSwitcher'
import TabPreview from '../TabPreview'
import BottomTabBar from '~features/app-switcher/BottomTabBar/BottomTabBar'
import TabScreen from '../TabScreen/TabScreen'
import { DrawerLayout, ScrollView } from 'react-native-gesture-handler'
import { AppSwitcherProvider } from '../AppSwitcherProvider'
import MoreScreen from '~features/settings/MoreScreen'
import { wp } from '~helpers/utils'
import HomeScreen from '~features/home/HomeScreen'

interface AppSwitcherProps {}

export const TAB_PREVIEW_SCALE = 0.6

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

const AppSwitcherScreen = ({
  navigation,
}: NavigationStackScreenProps<AppSwitcherProps>) => {
  const [tabsAtoms] = useAtom(tabsAtomsAtom)
  const { width } = useWindowDimensions()
  const moreDrawerRef = useRef<DrawerLayout>(null)
  const homeDrawerRef = useRef<DrawerLayout>(null)
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

  const openMenu = () => {
    moreDrawerRef.current?.openDrawer()
  }

  const closeMenu = () => {
    moreDrawerRef.current?.closeDrawer()
  }

  const openHome = () => {
    homeDrawerRef.current?.openDrawer()
  }

  return (
    <AppSwitcherProvider>
      <DrawerLayout
        ref={homeDrawerRef}
        drawerWidth={wp(100, 450)}
        drawerPosition="left"
        drawerType="slide"
        overlayColor="transparent"
        renderNavigationView={() => <HomeScreen closeMenu={closeMenu} />}
      >
        <DrawerLayout
          ref={moreDrawerRef}
          drawerWidth={wp(100, 450)}
          drawerPosition="right"
          drawerType="slide"
          overlayColor="transparent"
          renderNavigationView={() => <MoreScreen closeMenu={closeMenu} />}
        >
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
            <BottomTabBar openMenu={openMenu} openHome={openHome} />
          </Box>
        </DrawerLayout>
      </DrawerLayout>
    </AppSwitcherProvider>
  )
}

export default AppSwitcherScreen
