import { getDefaultStore } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import { useEffect, useRef } from 'react'
import { useWindowDimensions } from 'react-native'
import { SharedValue } from 'react-native-reanimated'
import { resetTabAnimationTriggerAtom } from '~state/app'
import {
  activeGroupIdAtom,
  activeTabIdAtom,
  activeTabIndexAtom,
  appSwitcherModeAtom,
  tabGroupsAtom,
  tabsAtomsAtom,
  tabsCountAtom,
} from '~state/tabs'

import { useResponsiveWorkspace } from './useResponsiveWorkspace'

/**
 * Side-effects that keep SharedValues in sync with Jotai atoms.
 * Extracted from AppSwitcherProvider to reduce its size.
 */
export const useProviderEffects = ({
  activeTabPreview,
  activeTabScreen,
  activeGroupIndex,
  pagerTranslateX,
  pagerScrollX,
  tabsCountShared,
  tabPreviewCarousel,
  createGroupPageIsFullyVisible,
}: {
  activeTabPreview: {
    index: SharedValue<number>
    animationProgress: SharedValue<number>
    zIndex: SharedValue<number>
    opacity: SharedValue<number>
    top: SharedValue<number>
    left: SharedValue<number>
  }
  activeTabScreen: {
    opacity: SharedValue<number>
    tabId: SharedValue<string | null>
  }
  activeGroupIndex: SharedValue<number>
  pagerTranslateX: SharedValue<number>
  pagerScrollX: SharedValue<number>
  tabsCountShared: SharedValue<number>
  tabPreviewCarousel: { opacity: SharedValue<number>; translateY: SharedValue<number> }
  createGroupPageIsFullyVisible: SharedValue<boolean>
}) => {
  const { width, height } = useWindowDimensions()

  // Sync tabsCount Jotai atom -> SharedValue (worklets can't read Jotai)
  const tabsCount = useAtomValue(tabsCountAtom)
  useEffect(() => {
    tabsCountShared.set(tabsCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsCount])

  const appSwitcherMode = useAtomValue(appSwitcherModeAtom)
  const groups = useAtomValue(tabGroupsAtom)
  const activeGroupId = useAtomValue(activeGroupIdAtom)
  const activeTabId = useAtomValue(activeTabIdAtom)
  const activeIndex = useAtomValue(activeTabIndexAtom)
  const isWide = useResponsiveWorkspace()
  const wasWide = useRef(isWide)

  // Desktop reads the selected atom directly. Keep the mobile animation state
  // ready when resizing or rotating back, including after group/tab deletion.
  useEffect(() => {
    const shouldSync = isWide || wasWide.current
    wasWide.current = isWide
    if (!shouldSync) return
    getDefaultStore().set(appSwitcherModeAtom, activeTabId ? 'view' : 'list')
    activeTabScreen.tabId.set(activeTabId || null)
    activeTabScreen.opacity.set(activeTabId ? 1 : 0)
    activeTabPreview.index.set(activeIndex)
    activeTabPreview.animationProgress.set(activeTabId ? 1 : 0)
    activeTabPreview.zIndex.set(1)
    activeTabPreview.opacity.set(0)
    tabPreviewCarousel.opacity.set(0)
    tabPreviewCarousel.translateY.set(height)
    createGroupPageIsFullyVisible.set(false)
    const groupIndex = Math.max(
      0,
      groups.findIndex(group => group.id === activeGroupId)
    )
    activeGroupIndex.set(groupIndex)
    pagerTranslateX.set(-groupIndex * width)
    pagerScrollX.set(groupIndex * width)
    // SharedValue containers are recreated by the provider, but their members are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWide, activeTabId, activeIndex, activeGroupId, groups.length, width, height])

  useEffect(() => {
    if (appSwitcherMode !== 'list') return

    const activeGroupIndexValue = groups.findIndex(group => group.id === activeGroupId)
    if (activeGroupIndexValue === -1) return

    const targetX = -activeGroupIndexValue * width
    activeGroupIndex.set(activeGroupIndexValue)
    pagerTranslateX.set(targetX)
    pagerScrollX.set(-targetX)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appSwitcherMode, groups, activeGroupId, width])

  // Listen to reset trigger (login/logout) and reset to first tab expanded
  const resetTrigger = useAtomValue(resetTabAnimationTriggerAtom)
  useEffect(() => {
    if (resetTrigger > 0) {
      console.log('[AppSwitcherProvider] RESET TRIGGER', resetTrigger)
      const store = getDefaultStore()
      const tabsAtoms = store.get(tabsAtomsAtom)
      const activeTabIndex = store.get(activeTabIndexAtom)
      const activeIndex =
        tabsAtoms.length > 0 ? Math.min(Math.max(activeTabIndex, 0), tabsAtoms.length - 1) : 0

      // Reset visual state around the device-local active tab.
      activeTabPreview.index.set(activeIndex)
      activeTabPreview.animationProgress.set(1)
      activeTabPreview.zIndex.set(3)
      activeTabPreview.opacity.set(0)
      activeTabPreview.top.set(0)
      activeTabPreview.left.set(0)

      // Clamp activeTabIndex Jotai atom when remote tab deletions made it invalid.
      store.set(activeTabIndexAtom, activeIndex)

      // Set the active tab screen using stable tab.id.
      if (tabsAtoms.length > 0) {
        const tab = store.get(tabsAtoms[activeIndex])
        activeTabScreen.tabId.set(tab.id)
        activeTabScreen.opacity.set(1)
      } else {
        activeTabScreen.tabId.set(null)
        activeTabScreen.opacity.set(0)
      }

      // Align group pager to the device-local active group.
      const groups = store.get(tabGroupsAtom)
      const activeGroupId = store.get(activeGroupIdAtom)
      const activeGroupIndexValue = Math.max(
        0,
        groups.findIndex(group => group.id === activeGroupId)
      )
      const targetX = -activeGroupIndexValue * width
      activeGroupIndex.set(activeGroupIndexValue)
      pagerTranslateX.set(targetX)
      pagerScrollX.set(-targetX)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetTrigger])
}
