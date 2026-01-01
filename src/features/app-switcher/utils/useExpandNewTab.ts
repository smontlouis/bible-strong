import { useAtomValue } from 'jotai/react'
import { useEffect, useState } from 'react'
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
  const { measureTabPreview } = useMeasureTabPreview()
  const { flashListRefs } = useAppSwitcherContext()

  const [tabId, setTabId] = useState<string | null>(null)

  useEffect(() => {
    const isNewTab = tabsCount > prevTabsCount && typeof prevTabsCount !== 'undefined'
    ;(async () => {
      if (isNewTab && tabId) {
        const index = tabsCount - 1

        // Scroll to end to ensure new tab is rendered (fixes virtualization issue)
        const flashListRef = flashListRefs.getActiveRef()
        flashListRef.current?.scrollToOffset({ offset: 99999, animated: false })

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
