import { useAtom } from 'jotai'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import {
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated'
import { activeTabPropertiesAtom } from '../../../state/tabs'
import { useAppSwitcherContext } from '../AppSwitcherProvider'

const useBottomBarStyles = () => {
  const [activeTabProperties] = useAtom(activeTabPropertiesAtom)
  const { isBottomTabBarVisible } = useAppSwitcherContext()
  const TAB_BAR_HEIGHT = 60 + getBottomSpace()

  const style = useAnimatedStyle(() => {
    if (!activeTabProperties?.animationProgress) return {}
    return {
      transform: [
        {
          translateY: interpolate(
            isBottomTabBarVisible.value,
            [0, 1],
            [TAB_BAR_HEIGHT, 0],
            Extrapolate.CLAMP
          ),
        },
      ],
    }
  })

  return { style }
}

export default useBottomBarStyles
