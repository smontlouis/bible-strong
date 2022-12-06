import { useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { runOnJS, withTiming } from 'react-native-reanimated'
import { activeTabIndexAtom, appSwitcherModeAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { tabTimingConfig } from './constants'

export const useTabAnimations = () => {
  const setActiveTabIndex = useSetAtom(activeTabIndexAtom)
  const setAppSwitcherMode = useSetAtom(appSwitcherModeAtom)
  const { activeTabPreview, activeTabScreen } = useAppSwitcherContext()

  const minimizeTab = useCallback(() => {
    'worklet'
    activeTabScreen.opacity.value = withTiming(0)
    activeTabPreview.animationProgress.value = withTiming(
      0,
      tabTimingConfig,
      () => {
        activeTabPreview.zIndex.value = 2
      }
    )
    runOnJS(setAppSwitcherMode)('list')
    runOnJS(setActiveTabIndex)(undefined)
  }, [])

  const expandTab = useCallback(
    (
      { index, left, top }: { index: number; left: number; top: number } = {
        index: activeTabPreview.index.value,
        left: activeTabPreview.left.value,
        top: activeTabPreview.top.value,
      }
    ) => {
      'worklet'

      runOnJS(setAppSwitcherMode)('view')
      activeTabPreview.zIndex.value = 3
      activeTabPreview.left.value = left
      activeTabPreview.top.value = top
      activeTabPreview.index.value = index
      activeTabPreview.animationProgress.value = withTiming(
        1,
        tabTimingConfig,
        () => {
          runOnJS(setActiveTabIndex)(index)
          activeTabScreen.opacity.value = withTiming(1)
        }
      )
    },
    []
  )

  return { minimizeTab, expandTab }
}
