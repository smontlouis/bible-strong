import { FlashListRef } from '@shopify/flash-list'
import { PrimitiveAtom, getDefaultStore } from 'jotai'
import { useAtomValue } from 'jotai/react'
import React, { createContext, useCallback, useContext, useRef } from 'react'
import { ScrollView, View, useWindowDimensions } from 'react-native'
import { AnimatedRef, SharedValue, useSharedValue, withSpring } from 'react-native-reanimated'
import { TabItem, activeGroupIdAtom, tabGroupsAtom, tabsCountAtom } from '~state/tabs'
import { useOnceAtoms } from './utils/useOnceAtoms'
import { useProviderEffects } from './utils/useProviderEffects'
import useTabConstants from './utils/useTabConstants'

type AppSwitcherContextValues = {
  // === Tab Expand/Collapse ===
  // Mutated by: useTabAnimations, useTabBarSwipeGesture, useTabPreview
  activeTabPreview: {
    index: SharedValue<number>
    top: SharedValue<number>
    left: SharedValue<number>
    opacity: SharedValue<number>
    animationProgress: SharedValue<number>
    zIndex: SharedValue<number>
  }

  // === Active Tab Screen ===
  // Mutated by: useTabAnimations, useTabBarSwipeGesture (via tabHelpers)
  activeTabScreen: {
    opacity: SharedValue<number>
    tabId: SharedValue<string | null>
  }

  // === Preview Carousel (overlay during swipe) ===
  // Mutated by: useTabAnimations, useTabBarSwipeGesture
  tabPreviewCarousel: {
    translateY: SharedValue<number>
    opacity: SharedValue<number>
  }

  // === Group Pagination ===
  // Mutated by: TabGroupPager, navigateToPage, useProviderEffects (reset)
  activeGroupIndex: SharedValue<number>
  groupPager: {
    ref: React.RefObject<ScrollView | null>
    translateX: SharedValue<number>
    scrollX: SharedValue<number>
    navigateToPage: (pageIndex: number, groupsLength: number) => void
  }
  createGroupPage: {
    isFullyVisible: SharedValue<boolean>
  }

  // === Refs & Registries (non-animated) ===
  flashListRefs: {
    registerRef: (
      groupId: string,
      ref: React.RefObject<FlashListRef<PrimitiveAtom<TabItem>> | null>
    ) => void
    getActiveRef: () => React.RefObject<FlashListRef<PrimitiveAtom<TabItem>> | null>
  }
  scrollView: {
    y: SharedValue<number>
    padding: SharedValue<number>
  }
  tabPreviews: {
    refs: React.RefObject<React.RefObject<View>[]>
    registerRef: (index: number, ref: AnimatedRef<View>) => void
    visibleIndices: React.RefObject<Set<number>>
    setVisibleIndices: (indices: number[]) => void
  }

  // === Tabs count for UI thread access (worklets can't read Jotai) ===
  tabsCountShared: SharedValue<number>
}

const AppSwitcherContext = createContext<AppSwitcherContextValues | undefined>(undefined)

interface AppSwitcherProviderProps {
  children: React.ReactNode
}

export const AppSwitcherProvider = ({ children }: AppSwitcherProviderProps) => {
  const groupPagerRef = useRef<ScrollView>(null)
  const { initialTabId, initialTabIndex } = useOnceAtoms()
  const { HEIGHT } = useTabConstants()
  const { width } = useWindowDimensions()

  const tabPreviewRefs = useRef(new Array(100))
  const visibleIndicesRef = useRef(new Set<number>())

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

  const setVisibleIndices = useCallback((indices: number[]) => {
    visibleIndicesRef.current = new Set(indices)
  }, [])

  const tabPreviews = {
    refs: tabPreviewRefs,
    registerRef: registerTabPreviewRef,
    visibleIndices: visibleIndicesRef,
    setVisibleIndices,
  }

  // FlashList refs per group - allows scrolling in the active group's list
  const flashListRefsMap = useRef(
    new Map<string, React.RefObject<FlashListRef<PrimitiveAtom<TabItem>> | null>>()
  )

  const registerFlashListRef = useCallback(
    (groupId: string, ref: React.RefObject<FlashListRef<PrimitiveAtom<TabItem>> | null>) => {
      flashListRefsMap.current.set(groupId, ref)
    },
    []
  )

  const getFlashListRef = useCallback(() => {
    const activeGroupId = getDefaultStore().get(activeGroupIdAtom)
    return flashListRefsMap.current.get(activeGroupId)!
  }, [])

  const flashListRefs = {
    registerRef: registerFlashListRef,
    getActiveRef: getFlashListRef,
  }

  const activeTabPreview = {
    index: useSharedValue(initialTabIndex),
    top: useSharedValue(0),
    left: useSharedValue(0),
    opacity: useSharedValue(0),
    animationProgress: useSharedValue(1),
    zIndex: useSharedValue(3),
  }

  // Uses stable tab.id instead of atom.toString()
  const activeTabScreen = {
    opacity: useSharedValue(initialTabId ? 1 : 0),
    tabId: useSharedValue(initialTabId ?? null) as SharedValue<string | null>,
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

  // Tabs count shared value for UI thread access
  const tabsCount = useAtomValue(tabsCountAtom)
  const tabsCountShared = useSharedValue(tabsCount)

  // Side-effects: sync tabsCount, handle login/logout reset
  useProviderEffects({
    activeTabPreview,
    activeTabScreen,
    activeGroupIndex,
    pagerTranslateX,
    pagerScrollX,
    tabsCountShared,
  })

  const navigateToPage = (pageIndex: number, groupsLength: number) => {
    const store = getDefaultStore()
    const groups = store.get(tabGroupsAtom)

    // Capturer le groupId précédent AVANT les changements
    const prevGroupId = store.get(activeGroupIdAtom)
    const prevFlashListRef = flashListRefsMap.current.get(prevGroupId)

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
      if (newGroupId !== prevGroupId) {
        store.set(activeGroupIdAtom, newGroupId)

        // Reset activeTabPreview.index to 0 when switching groups
        activeTabPreview.index.set(0)

        // Scroll la FlashList précédente vers le top
        prevFlashListRef?.current?.scrollToOffset({ offset: 0, animated: true })
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
    activeTabPreview,
    activeTabScreen,
    flashListRefs,
    scrollView,
    tabPreviews,
    tabPreviewCarousel,
    activeGroupIndex,
    groupPager,
    createGroupPage,
    tabsCountShared,
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
