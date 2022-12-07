import { useAtom } from 'jotai'
import React, { memo, useCallback, useRef } from 'react'
import { NavigationStackScreenProps } from 'react-navigation-stack'

import { DrawerLayout, ScrollView } from 'react-native-gesture-handler'
import {
  getBottomSpace,
  getStatusBarHeight,
} from 'react-native-iphone-x-helper'
import Animated from 'react-native-reanimated'
import Box, { AnimatedBox } from '~common/ui/Box'
import BottomTabBar from '~features/app-switcher/BottomTabBar/BottomTabBar'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import HomeScreen from '~features/home/HomeScreen'
import MoreScreen from '~features/settings/MoreScreen'
import { wp } from '~helpers/utils'
import { tabsAtomsAtom } from '../../../state/tabs'
import {
  AppSwitcherProvider,
  useAppSwitcherContext,
} from '../AppSwitcherProvider'
import CachedTabScreens from '../CachedTabScreens'
import TabPreviewCarousel from '../TabPreviewCarousel/TabPreviewCarousel'
import useNewTab from '../utils/useNewTab'
import useTabConstants from '../utils/useTabConstants'
import TabPreview from './TabPreview'
import useAppSwitcher from './useAppSwitcher'

interface AppSwitcherProps {
  openMenu: () => void
  openHome: () => void
}

export const TAB_PREVIEW_SCALE = 0.6

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

const AppSwitcherScreen = memo(
  ({
    navigation,
    openMenu,
    openHome,
  }: NavigationStackScreenProps<{}> & AppSwitcherProps) => {
    const [tabsAtoms] = useAtom(tabsAtomsAtom)

    const { TABS_PER_ROW, GAP, SCREEN_MARGIN } = useTabConstants()

    const { PADDING_HORIZONTAL, scrollViewBoxStyle } = useAppSwitcher()

    const { scrollView, tabPreviews } = useAppSwitcherContext()

    useNewTab()

    return (
      <Box flex={1} bg="lightGrey">
        <AnimatedScrollView
          // @ts-ignore
          ref={scrollView.ref}
          simultaneousHandlers={tabPreviews.gestureRefs}
          showsVerticalScrollIndicator={false}
          // onScroll={scrollHandler}
          // scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: getStatusBarHeight() + SCREEN_MARGIN,
            paddingLeft: PADDING_HORIZONTAL,
            paddingRight: PADDING_HORIZONTAL,
            paddingBottom: getBottomSpace() + TAB_ICON_SIZE,
          }}
        >
          <AnimatedBox
            overflow="visible"
            row
            style={[
              scrollViewBoxStyle,
              {
                flexWrap: 'wrap',
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              },
            ]}
          >
            {tabsAtoms.map((tabAtom, i) => (
              <TabPreview
                key={`${tabAtom}`}
                index={i}
                tabAtom={tabAtom}
                marginRight={(i + 1) % TABS_PER_ROW ? GAP : 0}
                tapGestureRef={tabPreviews.gestureRefs[i]}
                simultaneousHandlers={scrollView.ref}
              />
            ))}
          </AnimatedBox>
        </AnimatedScrollView>
        <CachedTabScreens navigation={navigation} />
        <TabPreviewCarousel tabsAtoms={tabsAtoms} />
        <BottomTabBar openMenu={openMenu} openHome={openHome} />
      </Box>
    )
  }
)

export default (props: any) => {
  const moreDrawerRef = useRef<DrawerLayout>(null)
  const homeDrawerRef = useRef<DrawerLayout>(null)

  const openMenu = useCallback(() => {
    moreDrawerRef.current?.openDrawer()
  }, [])

  const closeMenu = useCallback(() => {
    moreDrawerRef.current?.closeDrawer()
  }, [])

  const openHome = useCallback(() => {
    homeDrawerRef.current?.openDrawer()
  }, [])

  const closeHome = useCallback(() => {
    homeDrawerRef.current?.closeDrawer()
  }, [])

  const renderHomeScreen = useCallback(
    () => <HomeScreen closeHome={closeHome} />,
    [closeHome]
  )

  const renderMoreScreen = useCallback(
    () => <MoreScreen closeMenu={closeMenu} />,
    [closeMenu]
  )

  return (
    <DrawerLayout
      ref={homeDrawerRef}
      drawerWidth={wp(100, 450)}
      drawerPosition="left"
      drawerType="slide"
      overlayColor="transparent"
      renderNavigationView={renderHomeScreen}
      drawerLockMode="locked-closed"
    >
      <DrawerLayout
        ref={moreDrawerRef}
        drawerWidth={wp(100, 450)}
        drawerPosition="right"
        drawerType="slide"
        overlayColor="transparent"
        renderNavigationView={renderMoreScreen}
        drawerLockMode="locked-closed"
      >
        <AppSwitcherProvider>
          <AppSwitcherScreen
            openHome={openHome}
            openMenu={openMenu}
            {...props}
          />
        </AppSwitcherProvider>
      </DrawerLayout>
    </DrawerLayout>
  )
}
