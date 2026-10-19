import { useEffect, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { StyleSheet, View, type LayoutRectangle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { runOnJS } from 'react-native-worklets'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import { storage } from '~helpers/storage'
import StrobiAvatar, { type StrobiAnimation } from './StrobiAvatar'

// The avatar's body fills about 50 pt of its box: the size of Expo's developer tools button.
const AVATAR_SIZE = 62
// The body leaves this much of its box empty on each side; edges are measured from the body.
const BODY_INSET = 6
const EDGE_MARGIN = 10
// Below this distance the touch is a tap, as in Expo's button.
const DRAG_THRESHOLD = 10
// Share of the throw's projected travel that carries the avatar on, as in Expo's button.
const MOMENTUM_FACTOR = 0.35
// Travel of a throw at UIKit's normal deceleration rate, per point/second of velocity.
const PROJECTION = 0.998 / (1 - 0.998) / 1000
// SwiftUI springs of Expo's button, response 0.25 s / damping 0.85 while the finger leads,
// response 0.6 s / damping 0.7 for the snap that overshoots the edge and settles back.
const FOLLOW_SPRING = { mass: 1, stiffness: 632, damping: 42.7 }
const SNAP_SPRING = { mass: 1, stiffness: 110, damping: 14.7 }

const POSITION_KEY = 'assistant.launcher.position'

type Side = 'left' | 'right'
// The side it rests on and its height as a share of the travel, so that it survives a rotation.
type StoredPosition = { side: Side; y: number }

const readPosition = (): StoredPosition | null => {
  try {
    const value = JSON.parse(storage.getString(POSITION_KEY) ?? 'null')
    return value && (value.side === 'left' || value.side === 'right') && typeof value.y === 'number'
      ? value
      : null
  } catch {
    return null
  }
}

const savePosition = (side: Side, y: number) => {
  storage.set(POSITION_KEY, JSON.stringify({ side, y }))
}

type Props = {
  animation: StrobiAnimation
  accessibilityLabel: string
  onPress: () => void
  onDragStart: () => void
  onDragEnd: () => void
}

/**
 * Strobi's floating button. Like Expo's developer tools button, it can be thrown anywhere on
 * the screen: it keeps some momentum, snaps to the nearer side with a small bounce and stays
 * where it was left.
 */
export default function AssistantLauncherButton({
  animation,
  accessibilityLabel,
  onPress,
  onDragStart,
  onDragEnd,
}: Props) {
  const insets = useSafeAreaInsets()
  const [layout, setLayout] = useState<LayoutRectangle | null>(null)

  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const scale = useSharedValue(1)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  // Where a snap is heading, until the avatar first reaches it: the moment it lands.
  const landingX = useSharedValue<number | null>(null)

  const minX = insets.left + EDGE_MARGIN - BODY_INSET
  const maxX = (layout?.width ?? 0) - insets.right - EDGE_MARGIN + BODY_INSET - AVATAR_SIZE
  const minY = insets.top + EDGE_MARGIN - BODY_INSET
  const maxY = (layout?.height ?? 0) - insets.bottom - EDGE_MARGIN + BODY_INSET - AVATAR_SIZE

  // Placed without animation on the first layout and whenever the screen changes size.
  useEffect(() => {
    if (!layout) return
    const travel = Math.max(maxY - minY, 1)
    // Until it is moved, where it always was: bottom right, above the tab bar.
    const stored = readPosition() ?? {
      side: 'right',
      y: (layout.height - insets.bottom - TAB_ICON_SIZE - 62 - AVATAR_SIZE - minY) / travel,
    }
    x.set(stored.side === 'left' ? minX : maxX)
    y.set(minY + Math.min(Math.max(stored.y, 0), 1) * travel)
  }, [layout, minX, maxX, minY, maxY, insets.bottom, x, y])

  const land = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  useAnimatedReaction(
    () => x.get(),
    (current, previous) => {
      const target = landingX.get()
      if (target === null || previous === null) return
      if ((previous - target) * (current - target) <= 0) {
        landingX.set(null)
        runOnJS(land)()
      }
    }
  )

  const settle = (side: Side, height: number) => {
    savePosition(side, height)
    onDragEnd()
  }

  const tap = Gesture.Tap()
    .maxDistance(DRAG_THRESHOLD)
    .onBegin(() => {
      'worklet'
      scale.set(withTiming(0.9, { duration: 100 }))
    })
    .onEnd(() => {
      'worklet'
      runOnJS(onPress)()
    })
    .onFinalize(() => {
      'worklet'
      scale.set(withTiming(1, { duration: 100 }))
    })

  const pan = Gesture.Pan()
    .minDistance(DRAG_THRESHOLD)
    .onStart(() => {
      'worklet'
      landingX.set(null)
      startX.set(x.get())
      startY.set(y.get())
      runOnJS(onDragStart)()
    })
    .onUpdate(event => {
      'worklet'
      x.set(withSpring(startX.get() + event.translationX, FOLLOW_SPRING))
      y.set(withSpring(startY.get() + event.translationY, FOLLOW_SPRING))
    })
    .onEnd(event => {
      'worklet'
      const momentumX = event.velocityX * PROJECTION * MOMENTUM_FACTOR
      const momentumY = event.velocityY * PROJECTION * MOMENTUM_FACTOR
      const centerX = startX.get() + event.translationX + AVATAR_SIZE / 2 + momentumX
      const side: Side = centerX < (layout?.width ?? 0) / 2 ? 'left' : 'right'
      const targetX = side === 'left' ? minX : maxX
      const targetY = Math.min(
        Math.max(startY.get() + event.translationY + momentumY, minY),
        Math.max(minY, maxY)
      )
      landingX.set(targetX)
      x.set(withSpring(targetX, { ...SNAP_SPRING, velocity: event.velocityX }))
      y.set(withSpring(targetY, { ...SNAP_SPRING, velocity: event.velocityY }))
      runOnJS(settle)(side, (targetY - minY) / Math.max(maxY - minY, 1))
    })

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }))

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={event => setLayout(event.nativeEvent.layout)}
    >
      {layout && (
        <GestureDetector gesture={Gesture.Race(pan, tap)}>
          <Animated.View
            accessible
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={event => {
              if (event.nativeEvent.actionName === 'activate') onPress()
            }}
            style={[styles.button, style]}
          >
            <StrobiAvatar animation={animation} size={AVATAR_SIZE} />
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
