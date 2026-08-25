import { getDefaultStore } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import { useEffect } from 'react'
import { useWindowDimensions } from 'react-native'
import { SharedValue } from 'react-native-reanimated'
import { resetTabAnimationTriggerAtom } from '~state/app'
import {
  activeGroupIdAtom,
  activeTabIndexAtom,
  appSwitcherModeAtom,
  tabGroupsAtom,
  tabsAtomsAtom,
  tabsCountAtom,
} from '~state/tabs'

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
}) => {
  const { width } = useWindowDimensions()

  // Sync tabsCount Jotai atom -> SharedValue (worklets can't read Jotai)
  const tabsCount = useAtomValue(tabsCountAtom)
  useEffect(() => {
    tabsCountShared.set(tabsCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsCount])

  const appSwitcherMode = useAtomValue(appSwitcherModeAtom)
  const groups = useAtomValue(tabGroupsAtom)
  const activeGroupId = useAtomValue(activeGroupIdAtom)
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
