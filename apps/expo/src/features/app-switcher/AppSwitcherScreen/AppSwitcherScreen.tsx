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
      <Box className="overflow-hidden border-continuous flex-row flex-[1] bg-light-grey">
        {isWide && !sidebarHidden && (
          <WorkspaceSidebar
            onCollapse={() => setSidebarHidden(true)}
            openHome={openHome}
            openMenu={openMenu}
          />
        )}
        <Box className="border-continuous overflow-visible flex-[1] min-w-[0px]">
          {isWide && sidebarHidden && (
            <Box className="overflow-hidden border-continuous flex-row bg-reverse items-center px-[8px]">
              <TouchableBox
                className="overflow-hidden border-continuous items-center justify-center"
                onPress={() => setSidebarHidden(false)}
                accessibilityRole="button"
                accessibilityLabel={t('workspace.showSidebar')}
                style={{ width: 44, height: 44 }}
              >
                <FeatherIcon name="sidebar" size={19} color="grey" />
              </TouchableBox>
              <Text className="text-[13px] text-grey">Bible Strong</Text>
            </Box>
          )}
          <Box className="border-continuous overflow-visible flex-[1]">
            {!isWide && <TabGroupPager />}
            {isWide && tabsCount === 0 && (
              <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center bg-reverse gap-[16px]">
                <FeatherIcon name="layers" size={32} color="grey" />
                <Text className="text-grey">{t('tabs.noTabs')}</Text>
                <TouchableBox
                  className="overflow-hidden border-continuous px-[20px] min-h-[44px] items-center justify-center bg-primary rounded-[10px]"
                  onPress={() => openInNewTab(undefined, { autoRedirect: true })}
                  accessibilityRole="button"
                >
                  <Text className="text-[white]">{t('tabs.create')}</Text>
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
    <Box className="border-continuous overflow-visible flex-[1] bg-light-grey">
      <AnimatedBox
        className="overflow-hidden border-continuous flex-row flex-[1]"
        style={[{ width: drawerWidth * 2 + screenWidth, marginLeft: -drawerWidth }, containerStyle]}
      >
        <Box className="overflow-hidden border-continuous" style={{ width: drawerWidth }}>
          {hasOpenedHome && <Home closeHome={closeHome} />}
        </Box>

        <Box className="overflow-hidden border-continuous" style={{ width: screenWidth }}>
          <AppSwitcherScreen openHome={openHome} openMenu={openMenu} />
        </Box>

        <Box className="overflow-hidden border-continuous" style={{ width: drawerWidth }}>
          {hasOpenedMenu && <More closeMenu={closeMenu} />}
        </Box>
      </AnimatedBox>
    </Box>
  )
}

export default AppSwitcherScreenWrapper
