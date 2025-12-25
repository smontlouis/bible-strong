import { useAtom, useAtomValue } from 'jotai/react'
import React, { useCallback, useEffect, useRef } from 'react'

import { BackHandler, useWindowDimensions } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'

import { StackScreenProps } from '@react-navigation/stack'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { AnimatedBox } from '~common/ui/Box'
import BottomTabBar from '~features/app-switcher/BottomTabBar/BottomTabBar'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import { Home } from '~features/home/HomeScreen'
import { More } from '~features/settings/MoreScreen'
import { MainStackProps } from '~navigation/type'
import { tabsAtomsAtom, tabsCountAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import CachedTabScreens from '../CachedTabScreens'
import { TabContextProvider } from '../context/TabContext'
import TabPreviewCarousel from '../TabPreviewCarousel/TabPreviewCarousel'
import useTabConstants from '../utils/useTabConstants'
import { DebugView } from './DebugView'
import TabPreview from './TabPreview'
import useAppSwitcher from './useAppSwitcher'

type AppSwitcherScreenFuncs = {
  openMenu: () => void
  openHome: () => void
}

export const TAB_PREVIEW_SCALE = 0.6

const DRAWER_WIDTH_PERCENT = 0.95
const MAX_DRAWER_WIDTH = 450

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

const AppSwitcherScreen = ({
  navigation,
  route,
  openHome,
  openMenu,
}: StackScreenProps<MainStackProps, 'AppSwitcher'> & AppSwitcherScreenFuncs) => {
  const [tabsAtoms] = useAtom(tabsAtomsAtom)
  const { TABS_PER_ROW, GAP, SCREEN_MARGIN } = useTabConstants()
  const { PADDING_HORIZONTAL, scrollViewBoxStyle } = useAppSwitcher()
  const { scrollView } = useAppSwitcherContext()
  const insets = useSafeAreaInsets()

  return (
    <TabContextProvider>
      <Box flex={1} bg="lightGrey">
        <AnimatedScrollView
          ref={scrollView.ref}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: SCREEN_MARGIN + insets.top,
            paddingLeft: PADDING_HORIZONTAL,
            paddingRight: PADDING_HORIZONTAL,
            paddingBottom: TAB_ICON_SIZE + 60,
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
            {__DEV__ && <DebugView />}
          </AnimatedBox>
        </AnimatedScrollView>
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
