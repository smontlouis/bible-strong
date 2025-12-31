import React, { createContext, useCallback, useContext, useRef } from 'react'
import { ScrollView, useWindowDimensions, View } from 'react-native'
import {
  AnimatedRef,
  SharedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useOnceAtoms } from './utils/useOnceAtoms'
import useTabConstants from './utils/useTabConstants'
import { FlashListRef } from '@shopify/flash-list'
import { TabItem, activeGroupIdAtom, tabGroupsAtom, cachedTabIdsAtom } from '~state/tabs'
import { PrimitiveAtom, getDefaultStore } from 'jotai'

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
  flashListRefs: {
    registerRef: (groupId: string, ref: AnimatedRef<FlashListRef<PrimitiveAtom<TabItem>>>) => void
    getActiveRef: () => AnimatedRef<FlashListRef<PrimitiveAtom<TabItem>>> | undefined
  }
  scrollView: {
    y: SharedValue<number>
    padding: SharedValue<number>
  }
  tabPreviews: {
    refs: React.RefObject<React.RefObject<View>[]>
    registerRef: (index: number, ref: AnimatedRef<View>) => void
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
}

const AppSwitcherContext = createContext<AppSwitcherContextValues | undefined>(undefined)

interface AppSwitcherProviderProps {
  children: React.ReactNode
}

export const AppSwitcherProvider = ({ children }: AppSwitcherProviderProps) => {
  const groupPagerRef = useRef<ScrollView>(null)
  const { initialAtomId, initialTabIndex } = useOnceAtoms()
  const { HEIGHT } = useTabConstants()
  const { width } = useWindowDimensions()

  const tabPreviewRefs = useRef(new Array(100))

  const isBottomTabBarVisible = useSharedValue(1)

  const scrollView = {
    y: useSharedValue(0),
    padding: useSharedValue(0),
  }

  const registerTabPreviewRef = useCallback(
    (index: number, ref: AnimatedRef<View>) => {
      tabPreviewRefs.current[index] = ref
    },
    [tabPreviewRefs]
  )

  const tabPreviews = {
    refs: tabPreviewRefs,
    registerRef: registerTabPreviewRef,
  }

  // FlashList refs per group - allows scrolling in the active group's list
  const flashListRefsMap = useRef(
    new Map<string, AnimatedRef<FlashListRef<PrimitiveAtom<TabItem>>>>()
  )

  const registerFlashListRef = useCallback(
    (groupId: string, ref: AnimatedRef<FlashListRef<PrimitiveAtom<TabItem>>>) => {
      flashListRefsMap.current.set(groupId, ref)
    },
    []
  )

  const getActiveFlashListRef = useCallback(() => {
    const activeGroupId = getDefaultStore().get(activeGroupIdAtom)
    return flashListRefsMap.current.get(activeGroupId)
  }, [])

  const flashListRefs = {
    registerRef: registerFlashListRef,
    getActiveRef: getActiveFlashListRef,
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
    const store = getDefaultStore()
    const groups = store.get(tabGroupsAtom)

    // Animation du pager
    const targetX = -pageIndex * width
    pagerTranslateX.set(withSpring(targetX))
    pagerScrollX.set(withSpring(-targetX))
    activeGroupIndex.set(pageIndex)

    // Update createGroupPage.isFullyVisible
    const createPagePosition = groupsLength * width
    createGroupPageIsFullyVisible.set(-targetX >= createPagePosition - 10)

    // Set activeGroupId (si c'est une page de groupe, pas la page de création)
    if (pageIndex < groups.length) {
      const newGroupId = groups[pageIndex].id
      const currentActiveId = store.get(activeGroupIdAtom)
      if (newGroupId !== currentActiveId) {
        store.set(cachedTabIdsAtom, [])
        store.set(activeGroupIdAtom, newGroupId)

        // Reset activeTabPreview.index to 0 when switching groups
        activeTabPreview.index.set(0)
      }
    }
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

  const contextValue: AppSwitcherContextValues = {
    isBottomTabBarVisible,
    activeTabPreview,
    activeTabScreen,
    flashListRefs,
    scrollView,
    tabPreviews,
    tabPreviewCarousel,
    activeGroupIndex,
    groupPager,
    createGroupPage,
  }

  return <AppSwitcherContext.Provider value={contextValue}>{children}</AppSwitcherContext.Provider>
}

export const useAppSwitcherContext = () => {
  const context = useContext(AppSwitcherContext)

  if (!context) {
    throw new Error('useAppSwitcherContext must be used within an AppSwitcherProvider')
  }

  return context
}
