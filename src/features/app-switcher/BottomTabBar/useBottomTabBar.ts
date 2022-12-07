import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  SharedValue,
  WithTimingConfig,
} from 'react-native-reanimated'
import { usePrevious } from '~helpers/usePrevious'
import { appSwitcherModeAtom, tabsCountAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { TAB_ICON_SIZE } from '../utils/constants'
import useMeasureTabPreview from '../utils/useMesureTabPreview'
import { useTabAnimations } from '../utils/useTabAnimations'

type Animation = {
  animatedValue: SharedValue<number>
  fromValue: number
  toValue: number
  options?: WithTimingConfig | undefined
  onFinishValue?: number
}

const fromTo = (animations: Animation[]) => {
  'worklet'

  animations.forEach(animation => {
    const { animatedValue } = animation
    animatedValue.value = animation.fromValue
    animatedValue.value = withTiming(
      animation.toValue,
      animation.options,
      () => {
        if (animation.onFinishValue !== undefined) {
          animatedValue.value = animation.onFinishValue
        }
      }
    )
  })
}

const useBottomTabBar = () => {
  const appSwitcherMode = useAtomValue(appSwitcherModeAtom)
  const prevAppSwitcherMode = usePrevious(appSwitcherMode)

  const tabsCount = useAtomValue(tabsCountAtom)
  const { expandTab } = useTabAnimations()
  const { activeTabPreview } = useAppSwitcherContext()
  const measureTabPreview = useMeasureTabPreview()

  const HIDDEN_HEIGHT = TAB_ICON_SIZE + getBottomSpace()
  const bottomBarViewY = useSharedValue(0)
  const bottomBarViewOpacity = useSharedValue(1)

  const bottomBarListY = useSharedValue(HIDDEN_HEIGHT)
  const bottomBarListOpacity = useSharedValue(0)

  const onPress = async () => {
    const index = activeTabPreview.index.value
    const { pageX, pageY } = await measureTabPreview(index)
    expandTab({
      index,
      left: pageX,
      top: pageY,
    })
  }

  useEffect(() => {
    // From view to list
    if (appSwitcherMode === 'list' && prevAppSwitcherMode === 'view') {
      const animations = [
        {
          animatedValue: bottomBarListY,
          fromValue: 30,
          toValue: 0,
        },
        {
          animatedValue: bottomBarListOpacity,
          fromValue: 0,
          toValue: 1,
        },
        {
          animatedValue: bottomBarViewY,
          fromValue: 0,
          toValue: -30,
          onFinishValue: HIDDEN_HEIGHT,
        },
        {
          animatedValue: bottomBarViewOpacity,
          fromValue: 1,
          toValue: 0,
        },
      ]

      fromTo(animations)
    }

    // From list to view
    if (appSwitcherMode === 'view' && prevAppSwitcherMode === 'list') {
      const animations = [
        {
          animatedValue: bottomBarListY,
          fromValue: 0,
          toValue: -30,
          onFinishValue: HIDDEN_HEIGHT,
        },
        {
          animatedValue: bottomBarListOpacity,
          fromValue: 1,
          toValue: 0,
        },
        {
          animatedValue: bottomBarViewY,
          fromValue: 30,
          toValue: 0,
        },
        {
          animatedValue: bottomBarViewOpacity,
          fromValue: 0,
          toValue: 1,
        },
      ]
      fromTo(animations)
    }
  }, [appSwitcherMode, prevAppSwitcherMode])

  const listStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: bottomBarListY.value,
        },
      ],
      opacity: bottomBarListOpacity.value,
    }
  })

  const viewStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: bottomBarViewY.value,
        },
      ],
      opacity: bottomBarViewOpacity.value,
    }
  })

  return {
    onPress,
    listStyles,
    viewStyles,
    tabsCount,
  }
}

export default useBottomTabBar
