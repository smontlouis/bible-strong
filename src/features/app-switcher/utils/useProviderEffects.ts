import { getDefaultStore } from 'jotai/vanilla'
import { useAtomValue } from 'jotai/react'
import { useEffect } from 'react'
import { SharedValue } from 'react-native-reanimated'
import { resetTabAnimationTriggerAtom } from '~state/app'
import { activeTabIndexAtom, tabsAtomsAtom, tabsCountAtom } from '~state/tabs'

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
  // Sync tabsCount Jotai atom -> SharedValue (worklets can't read Jotai)
  const tabsCount = useAtomValue(tabsCountAtom)
  useEffect(() => {
    tabsCountShared.set(tabsCount)
  }, [tabsCount])

  // Listen to reset trigger (login/logout) and reset to first tab expanded
  const resetTrigger = useAtomValue(resetTabAnimationTriggerAtom)
  useEffect(() => {
    if (resetTrigger > 0) {
      console.log('[AppSwitcherProvider] RESET TRIGGER', resetTrigger)
      const store = getDefaultStore()
      const tabsAtoms = store.get(tabsAtomsAtom)

      // Reset to first tab expanded
      activeTabPreview.index.set(0)
      activeTabPreview.animationProgress.set(1)
      activeTabPreview.zIndex.set(3)
      activeTabPreview.opacity.set(0)
      activeTabPreview.top.set(0)
      activeTabPreview.left.set(0)

      // Update activeTabIndex Jotai atom (critical for tab content to show!)
      store.set(activeTabIndexAtom, 0)

      // Set the first tab as active (using stable tab.id)
      if (tabsAtoms.length > 0) {
        const tab = store.get(tabsAtoms[0])
        activeTabScreen.tabId.set(tab.id)
        activeTabScreen.opacity.set(1)
      } else {
        activeTabScreen.tabId.set(null)
        activeTabScreen.opacity.set(0)
      }

      // Reset group pager to first group
      activeGroupIndex.set(0)
      pagerTranslateX.set(0)
      pagerScrollX.set(0)
    }
  }, [resetTrigger])
}
