import { useAtomValue, useSetAtom } from 'jotai'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'
import useTakeActiveTabSnapshot from '~features/app-switcher/utils/useTakeActiveTabSnapshot'
import {
  activeTabIndexAtom,
  tabsAtom,
  tabsAtomsAtom,
} from '../../../../state/tabs'

const useSearchButtonPress = () => {
  const dispatch = useSetAtom(tabsAtomsAtom)
  const activeTabIndex = useAtomValue(activeTabIndexAtom)
  const tabs = useAtomValue(tabsAtom)
  const { slideToIndex } = useTabAnimations()
  const takeActiveTabSnapshot = useTakeActiveTabSnapshot()

  const onPress = async () => {
    const searchIndex = tabs.findIndex(tab => tab.type === 'search')
    if (searchIndex !== -1) {
      await takeActiveTabSnapshot(activeTabIndex)
      slideToIndex(searchIndex)
      return
    }
    dispatch({
      type: 'insert',
      value: {
        id: `search-${Date.now()}`,
        title: 'New Search',
        isRemovable: true,
        type: 'search',
        data: {
          searchValue: '',
        },
      },
    })
  }

  return { onPress }
}

export default useSearchButtonPress
