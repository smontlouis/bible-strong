import { useAtom, useAtomValue } from 'jotai'
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react'
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
import {
  activeTabIndexAtom,
  tabsAtomsAtom,
  tabsCountAtom,
} from '../../../state/tabs'
import {
  AppSwitcherProvider,
  useAppSwitcherContext,
} from '../AppSwitcherProvider'
import CachedTabScreens from '../CachedTabScreens'
import TabPreviewCarousel from '../TabPreviewCarousel/TabPreviewCarousel'
import useExpandNewTab from '../utils/useExpandNewTab'
import useTabConstants from '../utils/useTabConstants'
import TabPreview from './TabPreview'
import useAppSwitcher from './useAppSwitcher'
import BibleSelectTabNavigator from '~navigation/BibleSelectTabNavigator'

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

    useExpandNewTab()

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

const useOnceAtoms = () => {
  const [tabsAtoms] = useAtom(tabsAtomsAtom)
  const [tabIndex] = useAtom(activeTabIndexAtom)
  const initialAtomId = useRef(tabsAtoms[tabIndex]?.toString())
  const initialTabIndex = useRef(tabIndex)
  return {
    initialAtomId: initialAtomId.current,
    initialTabIndex: initialTabIndex.current,
  }
}

const AppSwitcherScreenWrapper = (props: any) => {
  const moreDrawerRef = useRef<DrawerLayout>(null)
  const homeDrawerRef = useRef<DrawerLayout>(null)
  const { initialAtomId, initialTabIndex } = useOnceAtoms()
  const tabsCount = useAtomValue(tabsCountAtom)

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

  // Not the best, but when adding a new tab, close home drawer
  useEffect(() => {
    closeHome()
  }, [tabsCount, closeHome])

  const renderHomeScreen = useCallback(
    () => <HomeScreen closeHome={closeHome} />,
    [closeHome]
  )

  const renderMoreScreen = useCallback(
    () => <MoreScreen closeMenu={closeMenu} />,
    [closeMenu]
  )

  const children = useMemo(
    () => (
      <AppSwitcherScreen openHome={openHome} openMenu={openMenu} {...props} />
    ),
    []
  )

  return (
    <DrawerLayout
      ref={homeDrawerRef}
      drawerWidth={wp(95, 450)}
      drawerPosition="left"
      drawerType="back"
      overlayColor="rgba(0,0,0,0.1)"
      renderNavigationView={renderHomeScreen}
      drawerLockMode="locked-closed"
    >
      <DrawerLayout
        ref={moreDrawerRef}
        drawerWidth={wp(95, 450)}
        drawerPosition="right"
        drawerType="slide"
        overlayColor="rgba(0,0,0,0.1)"
        renderNavigationView={renderMoreScreen}
        drawerLockMode="locked-closed"
      >
        <AppSwitcherProvider
          initialAtomId={initialAtomId}
          initialTabIndex={initialTabIndex}
          children={children}
        />
      </DrawerLayout>
    </DrawerLayout>
  )
}

export default AppSwitcherScreenWrapper

// * TODO might be dangerous
AppSwitcherScreenWrapper.router = BibleSelectTabNavigator.router
