import { useAtomValue } from 'jotai/react'
import { useState, useEffect } from 'react'
import { runOnUI, scrollTo } from 'react-native-reanimated'
import { usePrevious } from '~helpers/usePrevious'
import wait from '~helpers/wait'
import { tabsCountAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import useMeasureTabPreview from './useMesureTabPreview'
import { useTabAnimations } from './useTabAnimations'

export const useExpandNewTab = () => {
  const tabsCount = useAtomValue(tabsCountAtom)
  const prevTabsCount = usePrevious(tabsCount)
  const { expandTab } = useTabAnimations()
  const measureTabPreview = useMeasureTabPreview()
  const { flashListRefs } = useAppSwitcherContext()

  const [tabId, setTabId] = useState<string | null>(null)

  useEffect(() => {
    const isNewTab = tabsCount > prevTabsCount && typeof prevTabsCount !== 'undefined'
    ;(async () => {
      if (isNewTab && tabId) {
        const index = tabsCount - 1

        // Scroll to end to ensure new tab is rendered (fixes virtualization issue)
        const activeFlashListRef = flashListRefs.getActiveRef()
        if (activeFlashListRef) {
          runOnUI(scrollTo)(activeFlashListRef, 0, 99999, false)
        }

        // Wait for scroll + render
        await wait(300)

        const { pageX, pageY } = await measureTabPreview(index)
        expandTab({
          index,
          left: pageX,
          top: pageY,
        })
        setTabId(null)
      }
    })()
  }, [tabId, tabsCount, prevTabsCount])

  return { triggerExpandNewTab: setTabId }
}
