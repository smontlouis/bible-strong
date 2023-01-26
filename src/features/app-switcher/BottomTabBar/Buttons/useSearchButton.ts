import { useAtomValue, useSetAtom } from 'jotai/react'
import { useSlideNewTab } from '~features/app-switcher/utils/useSlideNewTab'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'
import { useTabsQuota } from '~helpers/usePremium'
import { tabsAtom, tabsAtomsAtom } from '../../../../state/tabs'

const useSearchButtonPress = () => {
  const dispatchTabs = useSetAtom(tabsAtomsAtom)
  const tabs = useAtomValue(tabsAtom)
  const { slideToIndex } = useTabAnimations()
  const { triggerSlideNewTab } = useSlideNewTab()
  const checkTabsQuota = useTabsQuota()

  const onPress = async () => {
    const searchIndex = tabs.findIndex(tab => tab.type === 'search')
    if (searchIndex !== -1) {
      slideToIndex(searchIndex)
      return
    }
    checkTabsQuota(() => {
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
            searchMode: 'online',
          },
        },
      })
      triggerSlideNewTab(newTabId)
    })
  }

  return { onPress }
}

export default useSearchButtonPress
