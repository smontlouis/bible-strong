import { useAtomValue, useSetAtom } from 'jotai/react'
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

const useTabPreview = ({
  index,
  tabAtom,
}: {
  index: number
  tabAtom: PrimitiveAtom<TabItem>
}) => {
  const { activeTabPreview, tabPreviews, scrollView } = useAppSwitcherContext()
  const measureTabPreview = useMeasureTabPreview()
  const dispatchTabs = useSetAtom(tabsAtomsAtom)

  // @ts-ignore: FIXME(TS) correct type for createAnimatedComponent
  tabPreviews.refs[index] = useAnimatedRef<AnimatedBox>()
  const ref = tabPreviews.refs[index]

  const { expandTab } = useTabAnimations()

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
  useEffect(() => {
    if (index === activeTabPreview.index.value) {
      ;(async () => {
        await wait(300)
        const { pageX, pageY } = await measureTabPreview(index)
        activeTabPreview.top.value = pageY
        activeTabPreview.left.value = pageX
        activeTabPreview.zIndex.value = 3

        const scrollToTop = pageY - STATUS_BAR_HEIGHT - SCREEN_MARGIN
        runOnUI(scrollTo)(scrollView.ref, 0, scrollToTop, false)
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
    scrollView.padding.value = TAB_PREVIEW_HEIGHT + GAP + 20
    dispatchTabs({
      type: 'remove',
      atom: tabAtom,
    })
    scrollView.padding.value = withTiming(0)
  }

  const onClose = () => {
    activeTabPreview.zIndex.value = 1
    onDelete()
    const tabsCount = getDefaultStore().get(tabsCountAtom)
    // If deleting last tab, choose the previous one
    if (tabsCount - 1 === activeTabPreview.index.value) {
      activeTabPreview.index.value -= 1
    }
  }

  const boxStyles = useAnimatedStyle(() => {
    if (activeTabPreview.index.value === index) {
      return {
        position: 'relative',
        zIndex: activeTabPreview.zIndex.value,
      }
    }
    return {
      position: 'relative',
      zIndex: 2,
    }
  })

  const previewImageStyles = useAnimatedStyle(() => {
    if (activeTabPreview.index.value === index) {
      return {
        width: interpolate(
          activeTabPreview.animationProgress.value,
          [0, 1],
          [TAB_PREVIEW_WIDTH, WIDTH]
        ),
        height: interpolate(
          activeTabPreview.animationProgress.value,
          [0, 1],
          [TAB_PREVIEW_HEIGHT, HEIGHT]
        ),
        top: interpolate(
          activeTabPreview.animationProgress.value,
          [0, 1],
          [0, -activeTabPreview.top.value]
        ),
        left: interpolate(
          activeTabPreview.animationProgress.value,
          [0, 1],
          [0, -activeTabPreview.left.value]
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
    if (activeTabPreview.index.value === index) {
      return {
        top: interpolate(
          activeTabPreview.animationProgress.value,
          [0, 1],
          [0, -activeTabPreview.top.value]
        ),
        left: interpolate(
          activeTabPreview.animationProgress.value,
          [0, 1],
          [0, -activeTabPreview.left.value]
        ),
        opacity: interpolate(
          activeTabPreview.animationProgress.value,
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
        activeTabPreview.animationProgress.value,
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
