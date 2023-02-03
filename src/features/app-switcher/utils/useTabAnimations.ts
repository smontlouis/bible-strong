import { useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback } from 'react'
import { runOnJS, withDelay, withTiming } from 'react-native-reanimated'
import {
  activeTabIndexAtom,
  appSwitcherModeAtom,
  tabsAtomsAtom,
} from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { tabTimingConfig } from './constants'
import useTabConstants from './useTabConstants'

export const useTabAnimations = () => {
  const setActiveTabIndex = useSetAtom(activeTabIndexAtom)
  const setAppSwitcherMode = useSetAtom(appSwitcherModeAtom)
  const tabsAtom = useAtomValue(tabsAtomsAtom)
  const { HEIGHT } = useTabConstants()

  const {
    activeTabPreview,
    activeTabScreen,
    tabPreviewCarousel,
  } = useAppSwitcherContext()

  const setAtomId = useCallback(
    (index: number) => {
      const atomId = tabsAtom[index].toString()
      activeTabScreen.atomId.value = atomId
    },
    [tabsAtom, activeTabScreen.atomId]
  )

  const setActiveTabOpacity = useCallback(() => {
    setTimeout(() => {
      activeTabScreen.opacity.value = withTiming(1)
    }, 50)
  }, [activeTabScreen.opacity])

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
    activeTabScreen.atomId.value = null
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
          runOnJS(setAtomId)(index)
          runOnJS(setActiveTabOpacity)()
          // activeTabScreen.opacity.value = withTiming(1, undefined, () => {
          //   // !TODO - Fix scroll to top
          //   // if (Math.round(top) !== STATUS_BAR_HEIGHT + SCREEN_MARGIN) {
          //   //   const scrollToTop =
          //   //     Math.round(top) - STATUS_BAR_HEIGHT - SCREEN_MARGIN
          //   //   scrollTo(scrollView.ref, 0, scrollToTop, false)
          //   // }
          // })
        }
      )
    },
    [setAtomId]
  )

  const slideToIndex = (index: number) => {
    if (activeTabPreview.index.value === index) {
      return
    }

    tabPreviewCarousel.opacity.value = 1
    tabPreviewCarousel.translateY.value = 0
    activeTabScreen.atomId.value = null
    runOnJS(setActiveTabIndex)(index)

    activeTabPreview.index.value = withTiming(
      index,
      { duration: 400 },
      finished => {
        if (!finished) return

        runOnJS(setAtomId)(index)
        tabPreviewCarousel.opacity.value = withDelay(
          200,
          withTiming(0, undefined, finish => {
            if (!finish) {
              tabPreviewCarousel.opacity.value = 1
              return
            }
            tabPreviewCarousel.translateY.value = HEIGHT
            activeTabPreview.zIndex.value = 3
          })
        )
      }
    )
  }

  return { minimizeTab, expandTab, slideToIndex }
}
