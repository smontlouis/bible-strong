import { useSetAtom } from 'jotai'
import { useCallback } from 'react'
import { runOnJS, scrollTo, withTiming } from 'react-native-reanimated'
import { activeTabIndexAtom, appSwitcherModeAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { tabTimingConfig } from './constants'
import useTabConstants from './useTabConstants'

export const useTabAnimations = () => {
  const setActiveTabIndex = useSetAtom(activeTabIndexAtom)
  const setAppSwitcherMode = useSetAtom(appSwitcherModeAtom)
  const {
    activeTabPreview,
    activeTabScreen,
    scrollView,
  } = useAppSwitcherContext()

  const { SCREEN_MARGIN, STATUS_BAR_HEIGHT } = useTabConstants()

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
    ({ index, left, top }: { index: number; left: number; top: number }) => {
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
          activeTabScreen.opacity.value = withTiming(1, undefined, () => {
            // !TODO - Fix scroll to top
            if (Math.round(top) !== STATUS_BAR_HEIGHT + SCREEN_MARGIN) {
              const scrollToTop =
                Math.round(top) - STATUS_BAR_HEIGHT - SCREEN_MARGIN
              scrollTo(scrollView.ref, 0, scrollToTop, false)
            }
          })
        }
      )
    },
    []
  )

  return { minimizeTab, expandTab }
}
