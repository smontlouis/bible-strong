import { useAtom } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { useEffect } from 'react'
import {
  SharedValue,
  WithTimingConfig,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
    animatedValue.set(animation.fromValue)
    animatedValue.set(withTiming(animation.toValue, animation.options, () => {
      if (animation.onFinishValue !== undefined) {
        animatedValue.set(animation.onFinishValue)
      }
    }))
  })
}

const useBottomTabBar = () => {
  const [appSwitcherMode, setAppSwitcherMode] = useAtom(appSwitcherModeAtom)
  const prevAppSwitcherMode = usePrevious(appSwitcherMode)

  const { expandTab } = useTabAnimations()
  const { activeTabPreview } = useAppSwitcherContext()
  const measureTabPreview = useMeasureTabPreview()

  const HIDDEN_HEIGHT = TAB_ICON_SIZE + useSafeAreaInsets().bottom
  const bottomBarViewY = useSharedValue(0)
  const bottomBarViewOpacity = useSharedValue(1)

  const bottomBarListY = useSharedValue(HIDDEN_HEIGHT)
  const bottomBarListOpacity = useSharedValue(0)

  const onPress = async () => {
    const index = activeTabPreview.index.get()
    const { pageX, pageY } = await measureTabPreview(index)
    expandTab({
      index,
      left: pageX,
      top: pageY,
    })
  }

  useEffect(() => {
    const tabsCount = getDefaultStore().get(tabsCountAtom)
    if (tabsCount === 0) {
      setAppSwitcherMode('list')
    }
  }, [])

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
          translateY: bottomBarListY.get(),
        },
      ],
      opacity: bottomBarListOpacity.get(),
    }
  })

  const viewStyles = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: bottomBarViewY.get(),
        },
      ],
      opacity: bottomBarViewOpacity.get(),
    }
  })

  return {
    onPress,
    listStyles,
    viewStyles,
  }
}

export default useBottomTabBar
