import { useAtom } from 'jotai'
import { useCallback, useMemo } from 'react'

import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import useTabConstants from '~features/app-switcher/utils/useTabConstants'
import { activeTabIndexAtom, tabsAtomsAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'

const useAppSwitcher = () => {
  const [tabsAtoms, dispatch] = useAtom(tabsAtomsAtom)

  const [activeTabIndex] = useAtom(activeTabIndexAtom)

  const scrollViewPadding = useSharedValue(0)
  const { TAB_PREVIEW_HEIGHT, GAP } = useTabConstants()
  const { scrollView } = useAppSwitcherContext()

  // create refs for tab previews also

  const activeAtom = useMemo(
    () =>
      typeof activeTabIndex !== 'undefined'
        ? tabsAtoms[activeTabIndex]
        : undefined,
    [activeTabIndex, tabsAtoms]
  )

  const onDeleteItem = useCallback(
    (index: number) => {
      scrollViewPadding.value = TAB_PREVIEW_HEIGHT + GAP + 20
      dispatch({
        type: 'remove',
        atom: tabsAtoms[index],
      })
      scrollViewPadding.value = withTiming(0)
    },
    [dispatch, tabsAtoms, scrollViewPadding, TAB_PREVIEW_HEIGHT, GAP]
  )

  const PADDING_HORIZONTAL = 20

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      scrollView.y.value = event.contentOffset.y
    },
  })

  const scrollViewBoxStyle = useAnimatedStyle(() => {
    return { paddingBottom: scrollViewPadding.value }
  })

  return {
    onDeleteItem,
    scrollHandler,
    PADDING_HORIZONTAL,
    scrollViewBoxStyle,
    activeAtom,
  }
}

export default useAppSwitcher
