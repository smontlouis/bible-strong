import { useAtomValue } from 'jotai'
import { useState, useEffect } from 'react'
import { usePrevious } from '~helpers/usePrevious'
import wait from '~helpers/wait'
import { tabsCountAtom } from '../../../state/tabs'
import useMeasureTabPreview from './useMesureTabPreview'
import { useTabAnimations } from './useTabAnimations'

export const useExpandNewTab = () => {
  const tabsCount = useAtomValue(tabsCountAtom)
  const prevTabsCount = usePrevious(tabsCount)
  const { expandTab } = useTabAnimations()
  const measureTabPreview = useMeasureTabPreview()

  const [tabId, setTabId] = useState<string | null>(null)

  useEffect(() => {
    const isNewTab =
      tabsCount > prevTabsCount && typeof prevTabsCount !== 'undefined'
    ;(async () => {
      if (isNewTab && tabId) {
        await wait(0)
        const index = tabsCount - 1
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
