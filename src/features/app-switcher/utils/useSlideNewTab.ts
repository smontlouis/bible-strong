import { useAtomValue } from 'jotai'
import { useState, useEffect } from 'react'
import { usePrevious } from '~helpers/usePrevious'
import wait from '~helpers/wait'
import { tabsCountAtom } from '../../../state/tabs'
import { useTabAnimations } from './useTabAnimations'

export const useSlideNewTab = () => {
  const tabsCount = useAtomValue(tabsCountAtom)
  const prevTabsCount = usePrevious(tabsCount)
  const { slideToIndex } = useTabAnimations()

  const [tabId, setTabId] = useState<string | null>(null)

  useEffect(() => {
    const isNewTab =
      tabsCount > prevTabsCount && typeof prevTabsCount !== 'undefined'
    ;(async () => {
      if (isNewTab && tabId) {
        await wait(0)
        const index = tabsCount - 1
        slideToIndex(index)
        setTabId(null)
      }
    })()
  }, [tabId, tabsCount, prevTabsCount])

  return { triggerSlideNewTab: setTabId }
}
