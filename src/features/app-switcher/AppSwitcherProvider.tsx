import React, { createContext, useContext, useRef } from 'react'
import { ScrollView, useWindowDimensions, View } from 'react-native'
import { SharedValue, useAnimatedRef, useSharedValue, withSpring } from 'react-native-reanimated'
import { useOnceAtoms } from './utils/useOnceAtoms'
import useTabConstants from './utils/useTabConstants'

type AppSwitcherContextValues = {
  isBottomTabBarVisible: SharedValue<number>
  activeTabPreview: {
    index: SharedValue<number>
    top: SharedValue<number>
    left: SharedValue<number>
    opacity: SharedValue<number>
    animationProgress: SharedValue<number>
    zIndex: SharedValue<number>
  }
  activeTabScreen: {
    opacity: SharedValue<number>
    atomId: SharedValue<string | null>
  }
  scrollView: {
    ref: React.RefObject<ScrollView | null>
    y: SharedValue<number>
    padding: SharedValue<number>
  }
  tabPreviews: {
    refs: React.RefObject<View>[]
  }
  tabPreviewCarousel: {
    translateY: SharedValue<number>
    opacity: SharedValue<number>
  }
  // Tab groups pagination
  activeGroupIndex: SharedValue<number>
  groupPager: {
    ref: React.RefObject<ScrollView | null>
    translateX: SharedValue<number>
    scrollX: SharedValue<number>
    navigateToPage: (pageIndex: number, groupsLength: number) => void
  }
  // Create group page
  createGroupPage: {
    isFullyVisible: SharedValue<boolean>
  }
  // Flag to track initial app mount (for scroll behavior)
  isInitialMount: React.MutableRefObject<boolean>
}

const AppSwitcherContext = createContext<AppSwitcherContextValues | undefined>(undefined)

interface AppSwitcherProviderProps {
  children: React.ReactNode
}

export const AppSwitcherProvider = ({ children }: AppSwitcherProviderProps) => {
  const scrollViewRef = useAnimatedRef<ScrollView>()
  const groupPagerRef = useAnimatedRef<ScrollView>()
  const { initialAtomId, initialTabIndex } = useOnceAtoms()
  const { HEIGHT } = useTabConstants()
  const { width } = useWindowDimensions()

  const tabPreviewRefs = useRef(new Array(100)).current

  const isBottomTabBarVisible = useSharedValue(1)

  const scrollView = {
    ref: scrollViewRef,
    y: useSharedValue(0),
    padding: useSharedValue(0),
  }

  const tabPreviews = {
    refs: tabPreviewRefs,
  }

  const activeTabPreview = {
    index: useSharedValue(initialTabIndex === -1 ? 0 : initialTabIndex),
    top: useSharedValue(0),
    left: useSharedValue(0),
    opacity: useSharedValue(0),
    animationProgress: useSharedValue(initialTabIndex === -1 ? 0 : 1),
    zIndex: useSharedValue(2),
  }

  const activeTabScreen = {
    opacity: useSharedValue(initialAtomId ? 1 : 0),
    atomId: useSharedValue(initialAtomId) as SharedValue<string | null>,
  }

  const tabPreviewCarousel = {
    // No need to mount/unmount the carousel, just visually hide it
    translateY: useSharedValue(HEIGHT),
    opacity: useSharedValue(0),
  }

  // Tab groups pagination
  const activeGroupIndex = useSharedValue(0)
  const pagerTranslateX = useSharedValue(0)
  const pagerScrollX = useSharedValue(0)
  const createGroupPageIsFullyVisible = useSharedValue(false)

  const navigateToPage = (pageIndex: number, groupsLength: number) => {
    const targetX = -pageIndex * width
    pagerTranslateX.value = withSpring(targetX)
    pagerScrollX.value = withSpring(-targetX)
    activeGroupIndex.value = pageIndex

    // Update createGroupPage.isFullyVisible
    const createPagePosition = groupsLength * width
    createGroupPageIsFullyVisible.value = -targetX >= createPagePosition - 10
  }

  const groupPager = {
    ref: groupPagerRef,
    translateX: pagerTranslateX,
    scrollX: pagerScrollX,
    navigateToPage,
  }

  // Create group page
  const createGroupPage = {
    isFullyVisible: createGroupPageIsFullyVisible,
  }

  // Flag to track initial app mount (for scroll behavior)
  const isInitialMount = useRef(true)

  const contextValue: AppSwitcherContextValues = {
    isBottomTabBarVisible,
    activeTabPreview,
    activeTabScreen,
    scrollView,
    tabPreviews,
    tabPreviewCarousel,
    activeGroupIndex,
    groupPager,
    createGroupPage,
    isInitialMount,
  }

  return (
    <AppSwitcherContext.Provider value={contextValue}>
      {children}
    </AppSwitcherContext.Provider>
  )
}

export const useAppSwitcherContext = () => {
  const context = useContext(AppSwitcherContext)

  if (!context) {
    throw new Error('useAppSwitcherContext must be used within an AppSwitcherProvider')
  }

  return context
}
