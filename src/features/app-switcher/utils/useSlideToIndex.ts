import { useSetAtom } from 'jotai'
import { runOnJS, withTiming } from 'react-native-reanimated'
import { activeTabIndexAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import useTabConstants from './useTabConstants'

const useSlideToIndex = () => {
  const setActiveTabIndex = useSetAtom(activeTabIndexAtom)
  const { activeTabPreview, tabPreviewCarousel } = useAppSwitcherContext()
  const { HEIGHT } = useTabConstants()

  const moveToIndex = (index: number) => {
    if (activeTabPreview.index.value === index) {
      return
    }

    tabPreviewCarousel.opacity.value = 1
    tabPreviewCarousel.translateY.value = 0

    runOnJS(setActiveTabIndex)(index)

    activeTabPreview.index.value = withTiming(index, { duration: 600 }, () => {
      tabPreviewCarousel.opacity.value = withTiming(0, undefined, () => {
        tabPreviewCarousel.translateY.value = HEIGHT
        activeTabPreview.zIndex.value = 3
      })
    })
  }

  return moveToIndex
}

export default useSlideToIndex
