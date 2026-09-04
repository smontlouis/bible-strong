import { useSetAtom } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { useSlideNewTab } from '~features/app-switcher/utils/useSlideNewTab'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'
import { tabsAtom, tabsAtomsAtom } from '../../../../state/tabs'

const useSearchButtonPress = () => {
  const dispatchTabs = useSetAtom(tabsAtomsAtom)
  const { slideToIndex } = useTabAnimations()
  const { triggerSlideNewTab } = useSlideNewTab()

  const onPress = async () => {
    const tabs = getDefaultStore().get(tabsAtom)
    const searchIndex = tabs.findIndex(tab => tab.type === 'search')
    if (searchIndex !== -1) {
      slideToIndex(searchIndex)
      return
    }
    const newTabId = `search-${Date.now()}`

    dispatchTabs({
      type: 'insert',
      value: {
        id: newTabId,
        title: 'New Search',
        isRemovable: true,
        type: 'search',
        data: {
          searchValue: '',
        },
      },
    })
    triggerSlideNewTab(newTabId)
  }

  return { onPress }
}

export default useSearchButtonPress
