import { getDefaultStore } from 'jotai'
import { useCallback } from 'react'
import { InteractionManager } from 'react-native'
import { tabsAtom } from '../../../state/tabs'
import { useTabAnimations } from './useTabAnimations'

export const useSlideNewTab = () => {
  const { slideToIndex } = useTabAnimations()

  const triggerSlideNewTab = useCallback(
    (tabId: string) => {
      InteractionManager.runAfterInteractions(() => {
        const tabs = getDefaultStore().get(tabsAtom)
        const index = tabs.findIndex(tab => tab.id === tabId)
        if (index >= 0) slideToIndex(index)
      })
    },
    [slideToIndex]
  )

  return { triggerSlideNewTab }
}
