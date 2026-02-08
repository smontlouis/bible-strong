import * as Haptics from 'expo-haptics'
import { useWindowDimensions } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { useSharedValue, withTiming } from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'
import { useAppSwitcherContext } from '../AppSwitcherProvider'
import { rubberBand } from '../utils/tabHelpers'
import useTabConstants from '../utils/useTabConstants'
import { useTabAnimations } from '../utils/useTabAnimations'

const DRAG_SCALE = 1.5
const VELOCITY_THRESHOLD = 800

const useTabBarSwipeGesture = () => {
  const { width: WIDTH } = useWindowDimensions()
  const { GAP } = useTabConstants()
  const { completeTabSwitch } = useTabAnimations()

  const { activeTabPreview, activeTabScreen, tabPreviewCarousel, tabsCountShared } =
    useAppSwitcherContext()

  const startIndex = useSharedValue(0)
  const isActive = useSharedValue(false)
  const lastSnappedIndex = useSharedValue(-1)

  const triggerSelectionHaptic = () => {
    Haptics.selectionAsync()
  }

  const triggerLightHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const finishSwipe = (targetIndex: number) => {
    completeTabSwitch(targetIndex, {
      setTabIdImmediately: true,
      duration: 300,
      carouselFadeDelay: 150,
    })
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet'
      startIndex.set(activeTabPreview.index.get())
      isActive.set(false)
      lastSnappedIndex.set(Math.round(activeTabPreview.index.get()))
    })
    .onUpdate(event => {
      'worklet'
      const count = tabsCountShared.get()
      if (count <= 1) return

      // First frame: show carousel, hide tab content
      if (!isActive.get()) {
        isActive.set(true)
        tabPreviewCarousel.opacity.set(1)
        tabPreviewCarousel.translateY.set(0)
        activeTabScreen.opacity.set(withTiming(0, { duration: 400 }))
        activeTabScreen.tabId.set(null)
        runOnJS(triggerLightHaptic)()
      }

      // Calculate continuous index from drag
      const rawIndex = startIndex.get() + (-event.translationX * DRAG_SCALE) / (WIDTH + GAP)

      // Apply rubber-band clamping
      const clampedIndex = rubberBand(rawIndex, 0, count - 1)
      activeTabPreview.index.set(clampedIndex)

      // Haptic feedback when crossing an integer boundary
      const currentSnapped = Math.round(clampedIndex)
      if (
        currentSnapped !== lastSnappedIndex.get() &&
        currentSnapped >= 0 &&
        currentSnapped < count
      ) {
        lastSnappedIndex.set(currentSnapped)
        runOnJS(triggerSelectionHaptic)()
      }
    })
    .onEnd(event => {
      'worklet'
      const count = tabsCountShared.get()
      if (count <= 1 || !isActive.get()) return

      const currentIndex = activeTabPreview.index.get()

      // Calculate target with velocity bias
      let targetIndex = Math.round(currentIndex)
      if (Math.abs(event.velocityX) > VELOCITY_THRESHOLD) {
        if (event.velocityX < 0) {
          // Swiping left -> go to next tab
          targetIndex = Math.ceil(currentIndex)
        } else {
          // Swiping right -> go to previous tab
          targetIndex = Math.floor(currentIndex)
        }
      }

      // Clamp to valid range
      targetIndex = Math.max(0, Math.min(count - 1, targetIndex))

      isActive.set(false)
      runOnJS(finishSwipe)(targetIndex)
    })
    .onFinalize(() => {
      'worklet'
      // Fallback if gesture is cancelled
      if (isActive.get()) {
        const targetIndex = Math.round(startIndex.get())
        isActive.set(false)
        runOnJS(finishSwipe)(targetIndex)
      }
    })

  return { panGesture }
}

export default useTabBarSwipeGesture
