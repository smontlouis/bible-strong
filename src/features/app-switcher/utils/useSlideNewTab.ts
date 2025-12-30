import { getDefaultStore } from 'jotai'
import { useCallback } from 'react'
import { tabsCountAtom } from '../../../state/tabs'
import { useTabAnimations } from './useTabAnimations'

export const useSlideNewTab = () => {
  const { slideToIndex } = useTabAnimations()

  const triggerSlideNewTab = useCallback(
    (tabIndex: string) => {
      setTimeout(() => {
        const tabsCount = getDefaultStore().get(tabsCountAtom)
        slideToIndex(tabsCount - 1)
      }, 0)
    },
    [slideToIndex]
  )

  return { triggerSlideNewTab }
}
