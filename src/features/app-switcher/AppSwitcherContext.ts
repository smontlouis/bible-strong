import type { FlashListRef } from '@shopify/flash-list'
import type { PrimitiveAtom } from 'jotai'
import { createContext, useContext, type RefObject } from 'react'
import type { ScrollView, View } from 'react-native'
import type { AnimatedRef, SharedValue } from 'react-native-reanimated'
import type { TabItem } from '~state/tabs'

export type AppSwitcherContextValue = {
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
    tabId: SharedValue<string | null>
  }
  tabPreviewCarousel: {
    translateY: SharedValue<number>
    opacity: SharedValue<number>
  }
  activeGroupIndex: SharedValue<number>
  groupPager: {
    ref: RefObject<ScrollView | null>
    translateX: SharedValue<number>
    scrollX: SharedValue<number>
    navigateToPage: (pageIndex: number, groupsLength: number) => void
  }
  createGroupPage: {
    isFullyVisible: SharedValue<boolean>
  }
  flashListRefs: {
    registerRef: (
      groupId: string,
      ref: RefObject<FlashListRef<PrimitiveAtom<TabItem>> | null>
    ) => void
    getActiveRef: () => RefObject<FlashListRef<PrimitiveAtom<TabItem>> | null>
  }
  scrollView: {
    y: SharedValue<number>
    padding: SharedValue<number>
  }
  tabPreviews: {
    refs: RefObject<RefObject<View>[]>
    registerRef: (index: number, ref: AnimatedRef<View>) => void
    visibleIndices: RefObject<Set<number>>
    setVisibleIndices: (indices: number[]) => void
  }
  tabsCountShared: SharedValue<number>
}

export const AppSwitcherContext = createContext<AppSwitcherContextValue | undefined>(undefined)

export const useAppSwitcherContext = () => {
  const context = useContext(AppSwitcherContext)

  if (!context) {
    throw new Error('useAppSwitcherContext must be used within an AppSwitcherProvider')
  }

  return context
}
