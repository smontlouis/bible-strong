import { useAtom } from 'jotai'
import React, { useEffect, useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import { ScrollView, TapGestureHandler } from 'react-native-gesture-handler'
import { NavigationStackScreenProps } from 'react-navigation-stack'

import { getBottomSpace } from 'react-native-iphone-x-helper'
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { usePrevious } from '~helpers/usePrevious'
import {
  activeTabIndexAtom,
  activeTabPropertiesAtom,
  TabProperties,
  tabsAtomsAtom,
} from '../../state/tabs'
import TabPreview, { AnimatedBox } from './TabPreview'
import TabScreen from './TabScreen'

interface AppSwitcherProps {}

export const TAB_PREVIEW_SCALE = 0.6

const AppSwitcherScreen = ({
  navigation,
}: NavigationStackScreenProps<AppSwitcherProps>) => {
  const [tabsAtoms, dispatch] = useAtom(tabsAtomsAtom)
  const { width } = useWindowDimensions()

  const [activeTabIndex, setActiveTabIndex] = useAtom(activeTabIndexAtom)
  const [, setActiveTabProperties] = useAtom(activeTabPropertiesAtom)

  const scrollViewRef = useAnimatedRef<ScrollView>(null)
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
  }, [activeTabIndex, width])

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

  const scrollViexBoxStyle = useAnimatedStyle(() => {
    return { paddingRight: scrollViewPadding.value }
  })

  // When a tab is added, open it
  useEffect(() => {
    if (
      prevTabsAtomLength < tabsAtomLength &&
      typeof prevTabsAtomLength !== 'undefined'
    ) {
      tapGestureRefs[tabsAtomLength - 1].current?.open()
    }
  }, [tabsAtomLength, prevTabsAtomLength, width, tapGestureRefs])

  return (
    <Box flex={1} bg="lightGrey" center>
      <Box
        position="absolute"
        bottom={40 + getBottomSpace()}
        left={0}
        right={0}
        center
      >
        <LinkBox
          height={40}
          width={200}
          bg="lightPrimary"
          center
          borderRadius={10}
          onPress={() => {
            dispatch({
              type: 'insert',
              value: {
                id: `new-${Date.now()}`,
                title: 'Nouvelle page',
                isRemovable: true,
                type: 'new',
                data: {},
              },
            })
          }}
        >
          <FeatherIcon name="plus" size={20} color="default" />
        </LinkBox>
      </Box>
      <Animated.ScrollView
        ref={scrollViewRef}
        simultaneousHandlers={tapGestureRefs}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate={0}
        snapToInterval={width * TAB_PREVIEW_SCALE + 20}
        onScroll={scrollHandler}
        style={{ flexGrow: 0, overflow: 'visible' }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingLeft: PADDING_HORIZONTAL,
          paddingRight: PADDING_HORIZONTAL,
        }}
      >
        <AnimatedBox overflow="visible" row style={scrollViexBoxStyle}>
          {tabsAtoms.map((tabAtom, i) => (
            <TabPreview
              key={`${tabAtom}`}
              index={i}
              tabAtom={tabAtom}
              marginRight={i !== tabsAtoms.length - 1 ? 20 : 0}
              tapGestureRef={tapGestureRefs[i]}
              simultaneousHandlers={scrollViewRef}
              onPress={onItemPress}
              onDelete={onDeleteItem}
            />
          ))}
        </AnimatedBox>
      </Animated.ScrollView>
      {activeAtom && <TabScreen tabAtom={activeAtom} navigation={navigation} />}
    </Box>
  )
}

export default AppSwitcherScreen
