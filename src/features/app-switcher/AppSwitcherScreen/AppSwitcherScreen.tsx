import { useAtom, useAtomValue } from 'jotai/react'
import React, { memo, useCallback, useEffect, useRef } from 'react'
import { NavigationStackScreenProps } from 'react-navigation-stack'

import { BackHandler } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import DrawerLayout from 'react-native-gesture-handler/DrawerLayout'

import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { AnimatedBox } from '~common/ui/Box'
import BottomTabBar from '~features/app-switcher/BottomTabBar/BottomTabBar'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import HomeScreen from '~features/home/HomeScreen'
import MoreScreen from '~features/settings/MoreScreen'
import { wp } from '~helpers/utils'
import { tabsAtomsAtom, tabsCountAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import CachedTabScreens from '../CachedTabScreens'
import TabPreviewCarousel from '../TabPreviewCarousel/TabPreviewCarousel'
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
    const { scrollView } = useAppSwitcherContext()
    const insets = useSafeAreaInsets()

    return (
      <Box flex={1} bg="lightGrey">
        <AnimatedScrollView
          // @ts-ignore
          ref={scrollView.ref}
          showsVerticalScrollIndicator={false}
          // onScroll={scrollHandler}
          // scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: SCREEN_MARGIN + insets.top,
            paddingLeft: PADDING_HORIZONTAL,
            paddingRight: PADDING_HORIZONTAL,
            paddingBottom: TAB_ICON_SIZE,
            minHeight: '100%',
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

const AppSwitcherScreenWrapper = (props: any) => {
  const moreDrawerRef = useRef<DrawerLayout>(null)
  const homeDrawerRef = useRef<DrawerLayout>(null)
  const tabsCount = useAtomValue(tabsCountAtom)
  const isMenuOpen = React.useRef(false)
  const isHomeOpen = React.useRef(false)

  const openMenu = useCallback(() => {
    moreDrawerRef.current?.openDrawer()
    isMenuOpen.current = true
  }, [])

  const closeMenu = useCallback(() => {
    moreDrawerRef.current?.closeDrawer()
    isMenuOpen.current = false
  }, [])

  const openHome = useCallback(() => {
    homeDrawerRef.current?.openDrawer()
    isHomeOpen.current = true
  }, [])

  const closeHome = useCallback(() => {
    homeDrawerRef.current?.closeDrawer()
    isHomeOpen.current = false
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

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isMenuOpen.current) {
          closeMenu()
          return true
        }

        if (isHomeOpen.current) {
          closeHome()
          return true
        }

        return false
      }
    )

    return () => backHandler.remove()
  }, [closeHome, closeMenu])

  return (
    <DrawerLayout
      ref={homeDrawerRef}
      drawerWidth={wp(95, 450)}
      drawerPosition="left"
      drawerType="slide"
      useNativeAnimations={false}
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
        <AppSwitcherScreen openHome={openHome} openMenu={openMenu} {...props} />
      </DrawerLayout>
    </DrawerLayout>
  )
}

export default AppSwitcherScreenWrapper
