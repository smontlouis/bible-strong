import { useAtom, useAtomValue } from 'jotai/react'
import React, { useCallback, useEffect, useRef } from 'react'

import { BackHandler } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import ReanimatedDrawerLayout, {
  DrawerLayoutMethods,
  DrawerPosition,
  DrawerType,
} from 'react-native-gesture-handler/ReanimatedDrawerLayout'

import { StackScreenProps } from '@react-navigation/stack'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box, { AnimatedBox } from '~common/ui/Box'
import BottomTabBar from '~features/app-switcher/BottomTabBar/BottomTabBar'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import { Home } from '~features/home/HomeScreen'
import { More } from '~features/settings/MoreScreen'
import { wp } from '~helpers/utils'
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
  const moreDrawerRef = useRef<DrawerLayoutMethods>(null)
  const homeDrawerRef = useRef<DrawerLayoutMethods>(null)
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
    closeMenu()
  }, [tabsCount, closeHome, closeMenu])

  const renderHomeScreen = useCallback(
    () => <Home closeHome={closeHome} navigation={props.navigation} />,
    [closeHome, props.navigation]
  )

  const renderMoreScreen = useCallback(() => <More closeMenu={closeMenu} />, [closeMenu])

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

  return (
    <ReanimatedDrawerLayout
      ref={homeDrawerRef}
      drawerWidth={wp(95, 450)}
      drawerPosition={DrawerPosition.LEFT}
      drawerType={DrawerType.SLIDE}
      overlayColor="rgba(0,0,0,0)"
      renderNavigationView={renderHomeScreen}
    >
      <ReanimatedDrawerLayout
        ref={moreDrawerRef}
        drawerWidth={wp(95, 450)}
        drawerPosition={DrawerPosition.RIGHT}
        drawerType={DrawerType.SLIDE}
        overlayColor="rgba(0,0,0,0)"
        renderNavigationView={renderMoreScreen}
      >
        <AppSwitcherScreen openHome={openHome} openMenu={openMenu} {...props} />
      </ReanimatedDrawerLayout>
    </ReanimatedDrawerLayout>
  )
}

export default AppSwitcherScreenWrapper
