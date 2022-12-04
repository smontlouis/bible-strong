import { useAtom } from 'jotai'
import React, { useMemo, useEffect } from 'react'
import { useWindowDimensions, ScrollView } from 'react-native'
import { TapGestureHandler } from 'react-native-gesture-handler'
import {
  useAnimatedRef,
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
} from 'react-native-reanimated'
import { usePrevious } from '~helpers/usePrevious'
import {
  tabsAtomsAtom,
  activeTabIndexAtom,
  activeTabPropertiesAtom,
  TabProperties,
} from '../../../state/tabs'
import { TAB_PREVIEW_SCALE } from './AppSwitcherScreen'

const useAppSwitcher = () => {
  const [tabsAtoms, dispatch] = useAtom(tabsAtomsAtom)
  const { width } = useWindowDimensions()

  const [activeTabIndex, setActiveTabIndex] = useAtom(activeTabIndexAtom)
  const [, setActiveTabProperties] = useAtom(activeTabPropertiesAtom)

  const scrollViewRef = useAnimatedRef<ScrollView>()
  const tabsAtomLength = tabsAtoms.length
  const prevTabsAtomLength = usePrevious(tabsAtomLength)
  const scrollViewPadding = useSharedValue(0)

  const tapGestureRefs = useMemo(
    () => tabsAtoms.map(() => React.createRef<TapGestureHandler>()),
    [tabsAtoms]
  )

  const activeAtom =
    typeof activeTabIndex !== 'undefined'
      ? tabsAtoms[activeTabIndex]
      : undefined

  // Scroll to active tab
  useEffect(() => {
    if (!activeTabIndex) return

    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: (width * TAB_PREVIEW_SCALE + 20) * (activeTabIndex || 0),
        animated: false,
      })
    }, 0)
  }, [activeTabIndex, width, scrollViewRef])

  const onItemPress = ({
    x,
    y,
    animationProgress,
    index,
  }: TabProperties & { index: number }) => {
    setActiveTabProperties({
      x,
      y,
      animationProgress,
    })
    setActiveTabIndex(index)
  }

  const onDeleteItem = (index: number) => {
    scrollViewPadding.value += width * TAB_PREVIEW_SCALE + 20
    dispatch({
      type: 'remove',
      atom: tabsAtoms[index],
    })
  }

  const PADDING_HORIZONTAL = width / 2 - (width * TAB_PREVIEW_SCALE) / 2
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

  // When a tab is added, open it
  useEffect(() => {
    if (
      prevTabsAtomLength < tabsAtomLength &&
      typeof prevTabsAtomLength !== 'undefined'
    ) {
      // @ts-ignore
      tapGestureRefs[tabsAtomLength - 1].current?.open()
    }
  }, [tabsAtomLength, prevTabsAtomLength, width, tapGestureRefs])

  return {
    scrollViewRef,
    tapGestureRefs,
    onItemPress,
    onDeleteItem,
    scrollHandler,
    PADDING_HORIZONTAL,
    scrollViewBoxStyle,
    activeAtom,
  }
}

export default useAppSwitcher
