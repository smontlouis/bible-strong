import { getDefaultStore } from 'jotai'
import { useCallback } from 'react'
import { InteractionManager } from 'react-native'
import { tabsCountAtom } from '../../../state/tabs'
import { useTabAnimations } from './useTabAnimations'

export const useSlideNewTab = () => {
  const { slideToIndex } = useTabAnimations()

  const triggerSlideNewTab = useCallback(
    (tabIndex: string) => {
      InteractionManager.runAfterInteractions(() => {
        const tabsCount = getDefaultStore().get(tabsCountAtom)
        slideToIndex(tabsCount - 1)
      })
    },
    [slideToIndex]
  )

  return { triggerSlideNewTab }
}
