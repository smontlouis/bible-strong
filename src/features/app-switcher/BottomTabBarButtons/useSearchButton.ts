import { useAtom } from 'jotai'
import { runOnJS, withTiming } from 'react-native-reanimated'
import {
  activeTabIndexAtom,
  tabActiveTabSnapshotAtom,
  tabsAtomsAtom,
} from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { tabTimingConfig } from '../utils/constants'

const useSearchButtonPress = () => {
  const [, dispatch] = useAtom(tabsAtomsAtom)
  const [activeTabIndex, setActiveTabIndex] = useAtom(activeTabIndexAtom)

  const { activeTabPreview } = useAppSwitcherContext()
  const [, tabActiveTabSnapshot] = useAtom(tabActiveTabSnapshotAtom)
  const { isBottomTabBarVisible } = useAppSwitcherContext()

  const run = (cb: () => void) => {
    setActiveTabIndex(undefined)
    cb()
  }
  const onCurrentTabClose = async (cb: () => void) => {
    await tabActiveTabSnapshot(activeTabIndex)
    isBottomTabBarVisible.value = withTiming(0)
  }

  const onPress = () => {
    onCurrentTabClose(() =>
      dispatch({
        type: 'insert',
        value: {
          id: `search-${Date.now()}`,
          title: 'Recherche',
          isRemovable: true,
          type: 'search',
          data: {
            searchValue: '',
          },
        },
      })
    )
  }

  return { onPress }
}

export default useSearchButtonPress
