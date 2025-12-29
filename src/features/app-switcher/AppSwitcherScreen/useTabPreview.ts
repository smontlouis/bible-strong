import { useSetAtom } from 'jotai/react'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { useEffect } from 'react'
import {
  Extrapolate,
  interpolate,
  runOnUI,
  scrollTo,
  useAnimatedRef,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import wait from '~helpers/wait'
import { TabItem, tabsAtomsAtom, tabsCountAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import useMeasureTabPreview from '../utils/useMesureTabPreview'
import { useTabAnimations } from '../utils/useTabAnimations'
import useTabConstants from '../utils/useTabConstants'

const useTabPreview = ({ index, tabAtom }: { index: number; tabAtom: PrimitiveAtom<TabItem> }) => {
  const { activeTabPreview, tabPreviews, scrollView, isInitialMount } = useAppSwitcherContext()
  const measureTabPreview = useMeasureTabPreview()
  const dispatchTabs = useSetAtom(tabsAtomsAtom)
  const { expandTab } = useTabAnimations()

  // @ts-ignore: FIXME(TS) correct type for createAnimatedComponent
  tabPreviews.refs[index] = useAnimatedRef<AnimatedBox>()
  const ref = tabPreviews.refs[index]

  const {
    TAB_PREVIEW_WIDTH,
    TAB_PREVIEW_HEIGHT,
    TAB_BORDER_RADIUS,
    WIDTH,
    HEIGHT,
    STATUS_BAR_HEIGHT,
    SCREEN_MARGIN,
    GAP,
  } = useTabConstants()

  // On mount, measure the initial tab preview
  // Only scroll on initial app mount, not when switching groups
  useEffect(() => {
    if (index === activeTabPreview.index.get() && isInitialMount.current) {
      ;(async () => {
        await wait(300)
        const { pageX, pageY } = await measureTabPreview(index)
        activeTabPreview.top.set(pageY)
        activeTabPreview.left.set(pageX)
        activeTabPreview.zIndex.set(3)

        const scrollToTop = pageY - STATUS_BAR_HEIGHT - SCREEN_MARGIN
        // @ts-ignore
        runOnUI(scrollTo)(scrollView.ref, 0, scrollToTop, false)

        // Mark initial mount as complete to prevent scroll on group switches
        isInitialMount.current = false
      })()
    }
  }, [])

  const onOpen = async () => {
    const { pageX, pageY } = await measureTabPreview(index)
    expandTab({
      index,
      left: pageX,
      top: pageY,
    })
  }

  const onDelete = () => {
    scrollView.padding.set(TAB_PREVIEW_HEIGHT + GAP + 20)
    dispatchTabs({
      type: 'remove',
      atom: tabAtom,
    })
    scrollView.padding.set(withTiming(0))
  }

  const onClose = () => {
    activeTabPreview.zIndex.set(1)
    onDelete()
    const tabsCount = getDefaultStore().get(tabsCountAtom)

    // If deleting last tab in list, choose the previous one
    if (tabsCount === activeTabPreview.index.get()) {
      activeTabPreview.index.set(activeTabPreview.index.get() - 1)
    }
  }

  const boxStyles = useAnimatedStyle(() => {
    if (activeTabPreview.index.get() === index) {
      return {
        position: 'relative',
        zIndex: activeTabPreview.zIndex.get(),
      }
    }
    return {
      position: 'relative',
      zIndex: 2,
    }
  })

  const previewImageStyles = useAnimatedStyle(() => {
    if (activeTabPreview.index.get() === index) {
      return {
        width: interpolate(
          activeTabPreview.animationProgress.get(),
          [0, 1],
          [TAB_PREVIEW_WIDTH, WIDTH]
        ),
        height: interpolate(
          activeTabPreview.animationProgress.get(),
          [0, 1],
          [TAB_PREVIEW_HEIGHT, HEIGHT]
        ),
        top: interpolate(
          activeTabPreview.animationProgress.get(),
          [0, 1],
          [0, -activeTabPreview.top.get()]
        ),
        left: interpolate(
          activeTabPreview.animationProgress.get(),
          [0, 1],
          [0, -activeTabPreview.left.get()]
        ),
        borderRadius: TAB_BORDER_RADIUS,
      }
    }

    return {
      width: TAB_PREVIEW_WIDTH,
      height: TAB_PREVIEW_HEIGHT,
      top: 0,
      left: 0,
      borderRadius: TAB_BORDER_RADIUS,
    }
  })

  const textStyles = useAnimatedStyle(() => {
    if (activeTabPreview.index.get() === index) {
      return {
        // top: interpolate(
        //   activeTabPreview.animationProgress.get(),
        //   [0, 1],
        //   [0, -activeTabPreview.top.get()]
        // ),
        // left: interpolate(
        //   activeTabPreview.animationProgress.get(),
        //   [0, 1],
        //   [0, -activeTabPreview.left.get()]
        // ),
        opacity: interpolate(
          activeTabPreview.animationProgress.get(),
          [0, 1],
          [1, 0],
          Extrapolate.CLAMP
        ),
      }
    }

    return {
      opacity: 1,
      top: 0,
      left: 0,
    }
  })

  const xStyles = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        activeTabPreview.animationProgress.get(),
        [0, 1],
        [1, 0],
        Extrapolate.CLAMP
      ),
    }
  })

  return {
    ref,
    boxStyles,
    previewImageStyles,
    textStyles,
    xStyles,
    onOpen,
    onClose,
  }
}

export default useTabPreview
