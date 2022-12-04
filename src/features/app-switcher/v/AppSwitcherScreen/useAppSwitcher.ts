import { useAtom } from 'jotai'
import React, { useCallback, useMemo } from 'react'
import { ScrollView, useWindowDimensions } from 'react-native'
import { TapGestureHandler } from 'react-native-gesture-handler'
import {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { activeTabIndexAtom, tabsAtomsAtom } from '../../../../state/tabs'
import { TAB_PREVIEW_SCALE } from './AppSwitcherScreen'

const useAppSwitcher = () => {
  const [tabsAtoms, dispatch] = useAtom(tabsAtomsAtom)
  const { width } = useWindowDimensions()

  const [activeTabIndex] = useAtom(activeTabIndexAtom)

  const scrollViewRef = useAnimatedRef<ScrollView>()
  const tabsAtomLength = tabsAtoms.length
  const scrollViewPadding = useSharedValue(0)

  const tapGestureRefs = useMemo(
    () => tabsAtoms.map(() => React.createRef<TapGestureHandler>()),
    [tabsAtoms]
  )

  const activeAtom = useMemo(
    () =>
      typeof activeTabIndex !== 'undefined'
        ? tabsAtoms[activeTabIndex]
        : undefined,
    [activeTabIndex, tabsAtoms]
  )

  const onDeleteItem = useCallback(
    (index: number) => {
      scrollViewPadding.value += width * TAB_PREVIEW_SCALE + 20
      dispatch({
        type: 'remove',
        atom: tabsAtoms[index],
      })
    },
    [dispatch, tabsAtoms, width, scrollViewPadding]
  )

  const PADDING_HORIZONTAL = 20

  const scrollHandler = useAnimatedScrollHandler(event => {
    const maxOffsetX = event.contentSize.width - event.layoutMeasurement.width
    const scrolledLeft = Math.max(0, maxOffsetX - event.contentOffset.x)
    const widthFromTabsAtom =
      (width * TAB_PREVIEW_SCALE + 20) * (tabsAtomLength - 1)

    if (
      widthFromTabsAtom !== maxOffsetX &&
      scrolledLeft >= width * TAB_PREVIEW_SCALE + 20
    ) {
      scrollViewPadding.value = 0
    }
  })

  const scrollViewBoxStyle = useAnimatedStyle(() => {
    return { paddingRight: scrollViewPadding.value }
  })

  return {
    scrollViewRef,
    tapGestureRefs,
    onDeleteItem,
    scrollHandler,
    PADDING_HORIZONTAL,
    scrollViewBoxStyle,
    activeAtom,
  }
}

export default useAppSwitcher
