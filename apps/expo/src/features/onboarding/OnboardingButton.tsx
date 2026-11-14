import type { ComponentProps } from 'react'
import Animated from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-worklets'

type Props = Omit<ComponentProps<typeof Animated.View>, 'hitSlop'> & {
  enabled?: boolean
  hitSlop?: number
  onPress?: () => void
  onPressIn?: () => void
  onPressOut?: () => void
}

/**
 * A button of the onboarding's frame (back, next, start). It answers through the same gesture
 * system as the scenes: a React Native `Pressable` beside them missed a touch that came just after
 * one of theirs.
 */
export default function OnboardingButton({
  enabled = true,
  hitSlop,
  onPress,
  onPressIn,
  onPressOut,
  children,
  ...viewProps
}: Props) {
  const active = enabled && Boolean(onPress)
  let tap = Gesture.Tap()
    .enabled(active)
    .maxDistance(10)
    .onBegin(() => {
      if (onPressIn) runOnJS(onPressIn)()
    })
    .onEnd((_event, success) => {
      if (success && onPress) runOnJS(onPress)()
    })
    .onFinalize(() => {
      if (onPressOut) runOnJS(onPressOut)()
    })
  if (hitSlop) tap = tap.hitSlop(hitSlop)
  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        accessible={active || viewProps.accessible}
        onAccessibilityTap={active ? onPress : undefined}
        {...viewProps}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  )
}
