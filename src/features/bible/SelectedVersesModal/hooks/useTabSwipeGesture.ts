import { useWindowDimensions } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { TABS, TAB_CONTAINER_MARGIN, TAB_CONTAINER_PADDING } from '../constants'

interface UseTabSwipeGestureParams {
  activeTabIndex: number
  setActiveTabIndex: (index: number) => void
}

const useTabSwipeGesture = ({ activeTabIndex, setActiveTabIndex }: UseTabSwipeGestureParams) => {
  const { width: screenWidth } = useWindowDimensions()
  const translateX = useSharedValue(-activeTabIndex * screenWidth)
  const startX = useSharedValue(0)

  // Tab indicator dimensions
  const containerWidth = screenWidth - TAB_CONTAINER_MARGIN
  const tabWidth = (containerWidth - TAB_CONTAINER_PADDING * 2) / TABS.length

  const goToTab = (index: number) => {
    setActiveTabIndex(index)
    translateX.set(withSpring(-index * screenWidth))
  }

  const updateActiveTab = (index: number) => {
    setActiveTabIndex(index)
  }

  // Scale: finger drag on tabWidth → content moves screenWidth (so indicator follows finger 1:1)
  const dragScale = screenWidth / tabWidth
  const minTranslateX = -(TABS.length - 1) * screenWidth
  const maxTranslateX = 0
  const overscrollResistance = 4 // Higher = more resistance

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.set(translateX.get())
    })
    .onUpdate(event => {
      // Inverted & scaled: indicator follows finger 1:1
      let newTranslateX = startX.get() - event.translationX * dragScale

      // Apply resistance when overscrolling
      if (newTranslateX > maxTranslateX) {
        const overscroll = newTranslateX - maxTranslateX
        newTranslateX = maxTranslateX + overscroll / overscrollResistance
      } else if (newTranslateX < minTranslateX) {
        const overscroll = minTranslateX - newTranslateX
        newTranslateX = minTranslateX - overscroll / overscrollResistance
      }

      translateX.set(newTranslateX)
    })
    .onEnd(event => {
      const currentPosition = translateX.get()
      const velocity = -event.velocityX * dragScale // Inverted & scaled velocity

      // Calculate which tab to snap to based on position and velocity
      let targetIndex = Math.round(-currentPosition / screenWidth)

      // Add velocity influence for more natural feel
      if (Math.abs(velocity) > 800) {
        if (velocity > 0) {
          targetIndex = Math.max(0, targetIndex - 1)
        } else {
          targetIndex = Math.min(TABS.length - 1, targetIndex + 1)
        }
      }

      // Clamp to valid range
      targetIndex = Math.max(0, Math.min(TABS.length - 1, targetIndex))

      translateX.set(withSpring(-targetIndex * screenWidth))
      runOnJS(updateActiveTab)(targetIndex)
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
  }))

  // Animated style for the sliding indicator
  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const progress = -translateX.get() / screenWidth
    const indicatorLeft = progress * tabWidth + TAB_CONTAINER_PADDING
    return {
      left: indicatorLeft,
    }
  })

  return {
    panGesture,
    animatedStyle,
    indicatorAnimatedStyle,
    goToTab,
    tabWidth,
    screenWidth,
  }
}

export default useTabSwipeGesture
