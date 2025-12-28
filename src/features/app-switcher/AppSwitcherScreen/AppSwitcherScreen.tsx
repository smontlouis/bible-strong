import { useAtom, useAtomValue } from 'jotai/react'
import React, { useCallback, useEffect, useRef } from 'react'

import { BackHandler, useWindowDimensions } from 'react-native'

import { StackScreenProps } from '@react-navigation/stack'
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Box, { AnimatedBox } from '~common/ui/Box'
import BottomTabBar from '~features/app-switcher/BottomTabBar/BottomTabBar'
import { Home } from '~features/home/HomeScreen'
import { More } from '~features/settings/MoreScreen'
import { MainStackProps } from '~navigation/type'
import { tabsAtomsAtom, tabsCountAtom } from '../../../state/tabs'
import CachedTabScreens from '../CachedTabScreens'
import { TabContextProvider } from '../context/TabContext'
import TabPreviewCarousel from '../TabPreviewCarousel/TabPreviewCarousel'
import TabGroupPager from './TabGroupPager'

type AppSwitcherScreenFuncs = {
  openMenu: () => void
  openHome: () => void
}

export const TAB_PREVIEW_SCALE = 0.6

const DRAWER_WIDTH_PERCENT = 0.95
const MAX_DRAWER_WIDTH = 450

const AppSwitcherScreen = ({
  navigation,
  route,
  openHome,
  openMenu,
}: StackScreenProps<MainStackProps, 'AppSwitcher'> & AppSwitcherScreenFuncs) => {
  const [tabsAtoms] = useAtom(tabsAtomsAtom)

  return (
    <TabContextProvider>
      <Box flex={1} bg="lightGrey">
        <TabGroupPager />
        <CachedTabScreens navigation={navigation} route={route} />
        <TabPreviewCarousel tabsAtoms={tabsAtoms} />
        <BottomTabBar openMenu={openMenu} openHome={openHome} />
      </Box>
    </TabContextProvider>
  )
}

const AppSwitcherScreenWrapper = (props: StackScreenProps<MainStackProps, 'AppSwitcher'>) => {
  const { width: screenWidth } = useWindowDimensions()
  const drawerWidth = Math.min(screenWidth * DRAWER_WIDTH_PERCENT, MAX_DRAWER_WIDTH)

  const tabsCount = useAtomValue(tabsCountAtom)
  const isMenuOpen = useRef(false)
  const isHomeOpen = useRef(false)

  // SharedValue pour la position: -1 (menu), 0 (centre), 1 (home)
  const position = useSharedValue(0)

  const openMenu = useCallback(() => {
    position.set(withSpring(-1))
    isMenuOpen.current = true
  }, [position])

  const closeMenu = useCallback(() => {
    position.set(withSpring(0))
    isMenuOpen.current = false
  }, [position])

  const openHome = useCallback(() => {
    position.set(withSpring(1))
    isHomeOpen.current = true
  }, [position])

  const closeHome = useCallback(() => {
    position.set(withSpring(0))
    isHomeOpen.current = false
  }, [position])

  // Not the best, but when adding a new tab, close home drawer
  useEffect(() => {
    closeHome()
    closeMenu()
  }, [tabsCount, closeHome, closeMenu])

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isMenuOpen.current) {
        closeMenu()
        return true
      }

      if (isHomeOpen.current) {
        closeHome()
        return true
      }

      return false
    })

    return () => backHandler.remove()
  }, [closeHome, closeMenu])

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * drawerWidth }],
  }))

  return (
    <Box flex={1} bg="lightGrey" overflow="hidden">
      <AnimatedBox
        row
        flex={1}
        style={[{ width: drawerWidth * 2 + screenWidth, marginLeft: -drawerWidth }, containerStyle]}
      >
        <Box width={drawerWidth}>
          <Home closeHome={closeHome} navigation={props.navigation} />
        </Box>

        <Box width={screenWidth}>
          <AppSwitcherScreen openHome={openHome} openMenu={openMenu} {...props} />
        </Box>

        <Box width={drawerWidth}>
          <More closeMenu={closeMenu} />
        </Box>
      </AnimatedBox>
    </Box>
  )
}

export default AppSwitcherScreenWrapper
