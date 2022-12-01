import { useAtom } from 'jotai'
import { runOnJS, withTiming } from 'react-native-reanimated'
import {
  activeTabIndexAtom,
  activeTabPropertiesAtom,
  tabActiveTabSnapshotAtom,
  tabsAtomsAtom,
} from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { tabTimingConfig } from '../TabScreen/TabScreen'

const useSearchButtonPress = () => {
  const [, dispatch] = useAtom(tabsAtomsAtom)
  const [activeTabIndex, setActiveTabIndex] = useAtom(activeTabIndexAtom)

  const [activeTabProperties, setActiveTabProperties] = useAtom(
    activeTabPropertiesAtom
  )
  const { animationProgress } = activeTabProperties || {}
  const [, tabActiveTabSnapshot] = useAtom(tabActiveTabSnapshotAtom)
  const { isBottomTabBarVisible } = useAppSwitcherContext()

  const run = (cb: () => void) => {
    setActiveTabIndex(undefined)
    setActiveTabProperties(undefined)
    cb()
  }
  const onCurrentTabClose = async (cb: () => void) => {
    if (!animationProgress?.value) return

    await tabActiveTabSnapshot(activeTabIndex)
    isBottomTabBarVisible.value = withTiming(0)
    animationProgress.value = withTiming(0, tabTimingConfig, () => {
      runOnJS(run)(cb)
    })
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
