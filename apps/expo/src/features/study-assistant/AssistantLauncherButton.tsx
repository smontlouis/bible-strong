import { useEffect, useEffectEvent, useRef, useState } from 'react'
import * as Haptics from 'expo-haptics'
import { StyleSheet, View, type LayoutRectangle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { runOnJS } from 'react-native-worklets'
import { FeatherIcon } from '~common/ui/Icon'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'
import { useBibleAudioMiniPlayerHeight } from '~features/bible-audio/ui/useBibleAudioMiniPlayerHeight'
import { storage } from '~helpers/storage'
import StrobiAvatar, { type StrobiAnimation } from './StrobiAvatar'

// A full 52 pt disc of Strobi's blue at half opacity, with a soft shadow below it: Strobi
// moves in front of it, and its edge stays a clean circle whatever Strobi does.
const BUTTON_SIZE = 52
// Strobi's body fills about 81% of its drawing: this box gives it 44 pt, 4 pt inside the disc.
const AVATAR_SIZE = 54
const DISC_COLOR = 'rgba(91, 127, 229, 0.5)'
const IDLE_DISC_COLOR = 'rgba(122, 122, 122, 0.5)'
// Left alone this long, Strobi falls asleep, still in colour.
const ASLEEP_AFTER_MS = 5000
// Once it has dozed off, the button fades and greys out, Strobi held in its sleeping pose,
// until it is touched again.
const IDLE_AFTER_MS = ASLEEP_AFTER_MS + 3000
// While the assistant is open, the button slips 60 pt out toward its edge and fades, quickly,
// then comes back with a small bounce: the springs of Expo's button window.
const HIDE_OFFSET = 60
const HIDE_SPRING = { duration: 300, dampingRatio: 0.8 }
const SHOW_SPRING = { duration: 500, dampingRatio: 0.6 }
// Shown again from Strobi's page, it grows back with a bounce; put away, it shrinks and fades.
const APPEAR_SPRING = { duration: 550, dampingRatio: 0.5 }
const PUT_AWAY_MS = 200
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

// While it is dragged, a cross waits at the bottom centre, just above the tab bar: dropped on
// it, Strobi's bubble is put away.
const TARGET_SIZE = 56
const TARGET_CENTER_ABOVE_BOTTOM = TAB_ICON_SIZE + 52
// Closer than this, the bubble is drawn onto the cross, which grows: let go, and it goes.
const MAGNET_RADIUS = 80
const MAGNET_SPRING = { mass: 1, stiffness: 400, damping: 28 }
const TARGET_SPRING = { duration: 250, dampingRatio: 0.6 }
const TARGET_COLOR = 'rgba(0, 0, 0, 0.55)'

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
  /** Out of the way while the assistant's sheet is up. */
  hidden: boolean
  /** Put away by the reader (the cross, Strobi's page): it shrinks away, and grows back. */
  putAway: boolean
  accessibilityLabel: string
  onPress: () => void
  onDragStart: () => void
  onDragEnd: () => void
  /**
   * Dropped on the cross, or asked by VoiceOver: asks whether to put the bubble away, and
   * resolves to whether it was. Put away, the button stays invisible; kept, it goes back to rest.
   */
  onDismiss: () => Promise<boolean>
  dismissLabel: string
  /** Strobi fell asleep, left alone, or was touched again. */
  onAsleepChange: (asleep: boolean) => void
}

/**
 * Strobi's floating button. Like Expo's developer tools button, it can be thrown anywhere on
 * the screen: it keeps some momentum, snaps to the nearer side with a small bounce and stays
 * where it was left. Dragged onto the cross that shows at the bottom centre, it is put away.
 */
export default function AssistantLauncherButton({
  animation,
  hidden,
  putAway,
  accessibilityLabel,
  onPress,
  onDragStart,
  onDragEnd,
  onDismiss,
  dismissLabel,
  onAsleepChange,
}: Props) {
  const insets = useSafeAreaInsets()
  // The small audio player raises the tab bar: the bubble and its cross stay above it.
  const miniPlayerHeight = useBibleAudioMiniPlayerHeight()
  const [layout, setLayout] = useState<LayoutRectangle | null>(null)
  const [asleep, setAsleep] = useState(false)
  const [idle, setIdle] = useState(false)
  // Each release restarts the wait before the button goes idle.
  const [releasedAt, setReleasedAt] = useState(0)
  const [touching, setTouching] = useState(false)
  // Held over the cross, Strobi looks blocked: about to be put away.
  const [onCross, setOnCross] = useState(false)
  const idleProgress = useSharedValue(0)

  useEffect(() => {
    if (touching) return
    // It falls asleep first, then the button greys out: the reader sees it doze off.
    const asleepTimer = setTimeout(() => setAsleep(true), ASLEEP_AFTER_MS)
    const idleTimer = setTimeout(() => setIdle(true), IDLE_AFTER_MS)
    return () => {
      clearTimeout(asleepTimer)
      clearTimeout(idleTimer)
    }
  }, [touching, releasedAt])

  const reportAsleep = useEffectEvent((value: boolean) => onAsleepChange(value))
  useEffect(() => {
    reportAsleep(asleep)
  }, [asleep])
  useEffect(() => {
    idleProgress.set(withTiming(idle ? 1 : 0, { duration: 300 }))
  }, [idle, idleProgress])

  const wake = () => {
    setTouching(true)
    setAsleep(false)
    setIdle(false)
  }
  const release = () => {
    setTouching(false)
    setReleasedAt(Date.now())
  }

  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const scale = useSharedValue(1)
  // Shrinks the bubble into the cross when it is dropped there.
  const dismissScale = useSharedValue(1)
  const targetShown = useSharedValue(0)
  const targetScale = useSharedValue(1)
  const overTarget = useSharedValue(false)
  const hideOffset = useSharedValue(0)
  // A page that opens without it (Premium, reached by a link) starts it hidden.
  const visibility = useSharedValue(hidden ? 0 : 1)
  const shownOnce = useRef(false)
  const presence = useSharedValue(putAway ? 0 : 1)
  const putAwayOnce = useRef(false)

  // Reads the latest layout without sliding again when it changes.
  const slide = useEffectEvent((hidden: boolean) => {
    // Out toward the side it rests on, back from there.
    const direction = x.get() + BUTTON_SIZE / 2 > (layout?.width ?? 0) / 2 ? 1 : -1
    if (hidden) {
      hideOffset.set(withSpring(direction * HIDE_OFFSET, HIDE_SPRING))
      visibility.set(withSpring(0, HIDE_SPRING))
      return
    }
    hideOffset.set(direction * HIDE_OFFSET)
    hideOffset.set(withSpring(0, SHOW_SPRING))
    visibility.set(withSpring(1, SHOW_SPRING))
    // Back on screen, it is awake and waits again before falling asleep.
    setAsleep(false)
    setIdle(false)
    setReleasedAt(Date.now())
  })
  useEffect(() => {
    // The first render places it as it is; only later changes slide it.
    if (!shownOnce.current) {
      shownOnce.current = true
      return
    }
    slide(hidden)
  }, [hidden])
  // Reads the latest layout; the effect below runs only when the reader puts it away or back.
  const appear = useEffectEvent((away: boolean) => {
    if (away) {
      presence.set(withTiming(0, { duration: PUT_AWAY_MS }))
      return
    }
    // Back at rest at full size, out of the cross it may have been dropped on, awake.
    const point = restingPoint()
    x.set(point.x)
    y.set(point.y)
    dismissScale.set(1)
    presence.set(0)
    presence.set(withSpring(1, APPEAR_SPRING))
    setAsleep(false)
    setIdle(false)
    setReleasedAt(Date.now())
  })
  useEffect(() => {
    if (!putAwayOnce.current) {
      putAwayOnce.current = true
      return
    }
    appear(putAway)
  }, [putAway])
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  // Where a snap is heading, until the avatar first reaches it: the moment it lands.
  const landingX = useSharedValue<number | null>(null)

  const minX = insets.left + EDGE_MARGIN
  const maxX = (layout?.width ?? 0) - insets.right - EDGE_MARGIN - BUTTON_SIZE
  const minY = insets.top + EDGE_MARGIN
  const maxY = (layout?.height ?? 0) - insets.bottom - EDGE_MARGIN - BUTTON_SIZE

  const targetX = (layout?.width ?? 0) / 2
  const targetY =
    (layout?.height ?? 0) - insets.bottom - TARGET_CENTER_ABOVE_BOTTOM - miniPlayerHeight

  // Where it rests: where it was left, or, until it is moved, bottom right above the tab bar.
  const restingPoint = () => {
    const travel = Math.max(maxY - minY, 1)
    const stored = readPosition() ?? {
      side: 'right',
      y:
        ((layout?.height ?? 0) -
          insets.bottom -
          TAB_ICON_SIZE -
          miniPlayerHeight -
          62 -
          BUTTON_SIZE -
          minY) /
        travel,
    }
    return {
      x: stored.side === 'left' ? minX : maxX,
      y: minY + Math.min(Math.max(stored.y, 0), 1) * travel,
    }
  }

  // Placed without animation on the first layout and whenever the screen changes size.
  useEffect(() => {
    if (!layout) return
    const point = restingPoint()
    x.set(point.x)
    y.set(point.y)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, minX, maxX, minY, maxY, insets.bottom, miniPlayerHeight, x, y])

  // A firm knock when it is drawn onto the cross, a light tick when it leaves it.
  const feelTarget = (near: boolean) => {
    setOnCross(near)
    if (near) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    else Haptics.selectionAsync()
  }

  const requestDismiss = async () => {
    onDragEnd()
    const dismissed = await onDismiss()
    overTarget.set(false)
    targetScale.set(1)
    if (dismissed) return
    setOnCross(false)
    // Kept: back where it rested, growing out of the cross.
    const point = restingPoint()
    dismissScale.set(withSpring(1, SHOW_SPRING))
    landingX.set(point.x)
    x.set(withSpring(point.x, SNAP_SPRING))
    y.set(withSpring(point.y, SNAP_SPRING))
  }

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
    .onEnd(() => {
      'worklet'
      runOnJS(onPress)()
    })

  // The pan sees the whole touch, tap or drag: the button stays pressed until the finger lifts.
  const pan = Gesture.Pan()
    .minDistance(DRAG_THRESHOLD)
    .onBegin(() => {
      'worklet'
      scale.set(withTiming(0.9, { duration: 100 }))
      runOnJS(wake)()
    })
    .onFinalize(() => {
      'worklet'
      scale.set(withTiming(1, { duration: 100 }))
      // Dropped on the cross, it leaves with the bubble (`onEnd`).
      if (!overTarget.get()) targetShown.set(withTiming(0, { duration: 150 }))
      runOnJS(release)()
    })
    .onStart(() => {
      'worklet'
      landingX.set(null)
      startX.set(x.get())
      startY.set(y.get())
      targetShown.set(withTiming(1, { duration: 200 }))
      runOnJS(onDragStart)()
    })
    .onUpdate(event => {
      'worklet'
      const fingerX = startX.get() + event.translationX
      const fingerY = startY.get() + event.translationY
      const dx = fingerX + BUTTON_SIZE / 2 - targetX
      const dy = fingerY + BUTTON_SIZE / 2 - targetY
      const near = dx * dx + dy * dy < MAGNET_RADIUS * MAGNET_RADIUS
      if (near !== overTarget.get()) {
        overTarget.set(near)
        targetScale.set(withSpring(near ? 1.2 : 1, TARGET_SPRING))
        runOnJS(feelTarget)(near)
      }
      if (near) {
        x.set(withSpring(targetX - BUTTON_SIZE / 2, MAGNET_SPRING))
        y.set(withSpring(targetY - BUTTON_SIZE / 2, MAGNET_SPRING))
        return
      }
      x.set(withSpring(fingerX, FOLLOW_SPRING))
      y.set(withSpring(fingerY, FOLLOW_SPRING))
    })
    .onEnd(event => {
      'worklet'
      if (overTarget.get()) {
        // Into the cross, then the cross goes; the question comes as it leaves.
        x.set(withSpring(targetX - BUTTON_SIZE / 2, MAGNET_SPRING))
        y.set(withSpring(targetY - BUTTON_SIZE / 2, MAGNET_SPRING))
        dismissScale.set(withTiming(0, { duration: 220 }))
        targetShown.set(withDelay(150, withTiming(0, { duration: 200 })))
        runOnJS(requestDismiss)()
        return
      }
      const momentumX = event.velocityX * PROJECTION * MOMENTUM_FACTOR
      const momentumY = event.velocityY * PROJECTION * MOMENTUM_FACTOR
      const centerX = startX.get() + event.translationX + BUTTON_SIZE / 2 + momentumX
      const side: Side = centerX < (layout?.width ?? 0) / 2 ? 'left' : 'right'
      const restX = side === 'left' ? minX : maxX
      const restY = Math.min(
        Math.max(startY.get() + event.translationY + momentumY, minY),
        Math.max(minY, maxY)
      )
      landingX.set(restX)
      x.set(withSpring(restX, { ...SNAP_SPRING, velocity: event.velocityX }))
      y.set(withSpring(restY, { ...SNAP_SPRING, velocity: event.velocityY }))
      runOnJS(settle)(side, (restY - minY) / Math.max(maxY - minY, 1))
    })

  const style = useAnimatedStyle(() => ({
    opacity:
      Math.min(Math.max(visibility.get(), 0), 1) *
      Math.min(Math.max(presence.get(), 0), 1) *
      (1 - idleProgress.get() * 0.5),
    transform: [
      { translateX: x.get() + hideOffset.get() },
      { translateY: y.get() },
      // The spring overshoots 1 on the way back: the bounce.
      { scale: scale.get() * dismissScale.get() * (0.3 + 0.7 * presence.get()) },
    ],
  }))
  const targetStyle = useAnimatedStyle(() => ({
    opacity: targetShown.get(),
    transform: [
      { translateY: (1 - targetShown.get()) * 24 },
      { scale: (0.8 + 0.2 * targetShown.get()) * targetScale.get() },
    ],
  }))
  const discStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(idleProgress.get(), [0, 1], [DISC_COLOR, IDLE_DISC_COLOR]),
  }))

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={event => setLayout(event.nativeEvent.layout)}
    >
      {layout && (
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[
            styles.target,
            { left: targetX - TARGET_SIZE / 2, top: targetY - TARGET_SIZE / 2 },
            targetStyle,
          ]}
        >
          <FeatherIcon name="x" size={26} color="#ffffff" />
        </Animated.View>
      )}
      {layout && (
        <GestureDetector gesture={Gesture.Race(pan, tap)}>
          <Animated.View
            pointerEvents={hidden || putAway ? 'none' : 'auto'}
            accessibilityElementsHidden={hidden || putAway}
            importantForAccessibility={hidden || putAway ? 'no-hide-descendants' : 'auto'}
            accessible
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityActions={[{ name: 'activate' }, { name: 'hide', label: dismissLabel }]}
            onAccessibilityAction={event => {
              if (event.nativeEvent.actionName === 'activate') onPress()
              if (event.nativeEvent.actionName === 'hide') void onDismiss()
            }}
            style={[styles.button, style]}
          >
            <Animated.View style={[styles.disc, discStyle]} />
            <StrobiAvatar
              animation={onCross ? 'blocked' : animation}
              size={AVATAR_SIZE}
              muted={idle}
            />
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
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Casts Expo's shadow: black at 40%, 8 pt of blur, 4 pt down.
  // surface-allow: the launcher keeps the shadow of Expo's button, which gives the avatar its lift.
  disc: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.4)',
  },
  // A dark disc that reads over any page, light or dark.
  target: {
    position: 'absolute',
    width: TARGET_SIZE,
    height: TARGET_SIZE,
    borderRadius: TARGET_SIZE / 2,
    backgroundColor: TARGET_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
