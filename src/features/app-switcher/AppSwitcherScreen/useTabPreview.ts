import { useAtomValue, useSetAtom } from 'jotai/react'
import { getDefaultStore, PrimitiveAtom } from 'jotai/vanilla'
import { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'
import {
  activeGroupIdAtom,
  cachedTabIdsAtom,
  getGroupTabsAtomsAtom,
  TabItem,
  tabsCountAtom,
} from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import useMeasureTabPreview from '../utils/useMesureTabPreview'
import { useTabAnimations } from '../utils/useTabAnimations'
import useTabConstants from '../utils/useTabConstants'

const useTabPreview = ({
  index,
  tabAtom,
  groupId,
}: {
  index: number
  tabAtom: PrimitiveAtom<TabItem>
  groupId: string
}) => {
  const { activeTabPreview, tabPreviews, scrollView, flashListRefs } = useAppSwitcherContext()
  const { measureTabPreview } = useMeasureTabPreview()
  // Utiliser l'atom per-group au lieu de l'atom global
  const groupTabsAtomsAtom = useMemo(() => getGroupTabsAtomsAtom(groupId), [groupId])
  const dispatchTabs = useSetAtom(groupTabsAtomsAtom)
  const { expandTab } = useTabAnimations()

  // Determine if this group is active - isolated subscription per TabPreview
  const activeGroupId = useAtomValue(activeGroupIdAtom)
  const isActiveGroup = groupId === activeGroupId

  const ref = useAnimatedRef<View>()

  // Register ref using the provider's function to satisfy React Compiler
  // (modification happens in the hook where the value was constructed)
  useEffect(() => {
    if (isActiveGroup) {
      tabPreviews.registerRef(index, ref)
    }
  }, [isActiveGroup, index, tabPreviews, ref])

  const { TAB_PREVIEW_WIDTH, TAB_PREVIEW_HEIGHT, TAB_BORDER_RADIUS, WIDTH, HEIGHT, GAP } =
    useTabConstants()

  const onOpen = async () => {
    const { pageX, pageY } = await measureTabPreview(index)
    expandTab({
      index,
      left: pageX,
      top: pageY,
    })
  }

  const onDelete = () => {
    // Get tab ID before deletion to clean up cache
    const store = getDefaultStore()
    const tab = store.get(tabAtom)
    const tabId = tab.id

    // Remove from cache
    const cachedIds = store.get(cachedTabIdsAtom)
    store.set(
      cachedTabIdsAtom,
      cachedIds.filter(id => id !== tabId)
    )

    scrollView.padding.set(TAB_PREVIEW_HEIGHT + GAP + 20)
    dispatchTabs({
      type: 'remove',
      atom: tabAtom,
    })
    scrollView.padding.set(withTiming(0))
  }

  const onClose = () => {
    flashListRefs.getActiveRef()?.current?.prepareForLayoutAnimationRender()

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
      zIndex: 1,
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
          Extrapolation.CLAMP
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
    // Seulement interpoler pour le tab actif
    if (activeTabPreview.index.get() !== index) {
      return { opacity: 1 }
    }
    return {
      opacity: interpolate(
        activeTabPreview.animationProgress.get(),
        [0, 1],
        [1, 0],
        Extrapolation.CLAMP
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
