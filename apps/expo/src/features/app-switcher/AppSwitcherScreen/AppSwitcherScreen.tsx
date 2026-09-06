import { useAtomValue } from 'jotai/react'
import React, { useEffect, useRef, useState } from 'react'

import { useTranslation } from 'react-i18next'
import { useWindowDimensions } from 'react-native'

import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useOpenInNewTab } from '../utils/useOpenInNewTab'
import WorkspaceSidebar from '../WorkspaceSidebar'
import { useResponsiveWorkspace } from '../utils/useResponsiveWorkspace'
import Box, { AnimatedBox, TouchableBox } from '~common/ui/Box'
import BottomTabBar from '~features/app-switcher/BottomTabBar/BottomTabBar'
import { Home } from '~features/home/HomeScreen'
import { More } from '~features/settings/MoreScreen'
import { subscribeToHardwareBackPress } from '~helpers/hardwareBackPress'
import { tabsCountAtom } from '../../../state/tabs'
import SharedBibleDOM from '~features/bible/SharedBibleDOM'
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

const AppSwitcherScreen = ({ openHome, openMenu }: AppSwitcherScreenFuncs) => {
  const isWide = useResponsiveWorkspace()
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const { t } = useTranslation()
  const tabsCount = useAtomValue(tabsCountAtom)
  const openInNewTab = useOpenInNewTab()

  return (
    <TabContextProvider>
      <Box row flex={1} bg="lightGrey">
        {isWide && !sidebarHidden && (
          <WorkspaceSidebar
            onCollapse={() => setSidebarHidden(true)}
            openHome={openHome}
            openMenu={openMenu}
          />
        )}
        <Box flex={1} minWidth={0} overflow="hidden">
          {isWide && sidebarHidden && (
            <Box row bg="reverse" alignItems="center" px={8}>
              <TouchableBox
                size={44}
                center
                onPress={() => setSidebarHidden(false)}
                accessibilityRole="button"
                accessibilityLabel={t('workspace.showSidebar')}
              >
                <FeatherIcon name="sidebar" size={19} color="grey" />
              </TouchableBox>
              <Text fontSize={13} color="grey">
                Bible Strong
              </Text>
            </Box>
          )}
          <Box flex={1} overflow="hidden">
            {!isWide && <TabGroupPager />}
            {isWide && tabsCount === 0 && (
              <Box flex={1} center bg="reverse" gap={16}>
                <FeatherIcon name="layers" size={32} color="grey" />
                <Text color="grey">{t('tabs.noTabs')}</Text>
                <TouchableBox
                  px={20}
                  minHeight={44}
                  center
                  bg="primary"
                  borderRadius={10}
                  onPress={() => openInNewTab(undefined, { autoRedirect: true })}
                  accessibilityRole="button"
                >
                  <Text color="white">{t('tabs.create')}</Text>
                </TouchableBox>
              </Box>
            )}
            <CachedTabScreens />
            <SharedBibleDOM />
            {!isWide && <TabPreviewCarousel />}
            {!isWide && <BottomTabBar openMenu={openMenu} openHome={openHome} />}
          </Box>
        </Box>
      </Box>
    </TabContextProvider>
  )
}

const AppSwitcherScreenWrapper = () => {
  const { width: screenWidth } = useWindowDimensions()
  const drawerWidth = Math.min(screenWidth * DRAWER_WIDTH_PERCENT, MAX_DRAWER_WIDTH)

  const tabsCount = useAtomValue(tabsCountAtom)
  const isMenuOpen = useRef(false)
  const isHomeOpen = useRef(false)
  const [hasOpenedMenu, setHasOpenedMenu] = useState(false)
  const [hasOpenedHome, setHasOpenedHome] = useState(false)

  // SharedValue pour la position: -1 (menu), 0 (centre), 1 (home)
  const position = useSharedValue(0)

  const openMenu = () => {
    setHasOpenedMenu(true)
    position.set(withSpring(-1))
    isMenuOpen.current = true
  }

  const closeMenu = () => {
    position.set(withSpring(0))
    isMenuOpen.current = false
  }

  const openHome = () => {
    setHasOpenedHome(true)
    position.set(withSpring(1))
    isHomeOpen.current = true
  }

  const closeHome = () => {
    position.set(withSpring(0))
    isHomeOpen.current = false
  }

  // Not the best, but when adding a new tab, close home drawer
  useEffect(() => {
    closeHome()
    closeMenu()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsCount])

  useEffect(() => {
    return subscribeToHardwareBackPress(() => {
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        <Box width={drawerWidth}>{hasOpenedHome && <Home closeHome={closeHome} />}</Box>

        <Box width={screenWidth}>
          <AppSwitcherScreen openHome={openHome} openMenu={openMenu} />
        </Box>

        <Box width={drawerWidth}>{hasOpenedMenu && <More closeMenu={closeMenu} />}</Box>
      </AnimatedBox>
    </Box>
  )
}

export default AppSwitcherScreenWrapper
