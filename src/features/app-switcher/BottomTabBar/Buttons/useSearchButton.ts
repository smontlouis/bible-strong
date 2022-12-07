import { useAtomValue, useSetAtom } from 'jotai'
import { useTabAnimations } from '~features/app-switcher/utils/useTabAnimations'
import { tabsAtom, tabsAtomsAtom } from '../../../../state/tabs'

const useSearchButtonPress = () => {
  const dispatch = useSetAtom(tabsAtomsAtom)
  const tabs = useAtomValue(tabsAtom)
  const { slideToIndex } = useTabAnimations()

  const onPress = () => {
    const searchIndex = tabs.findIndex(tab => tab.type === 'search')
    if (searchIndex !== -1) {
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
