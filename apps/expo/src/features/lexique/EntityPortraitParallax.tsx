import { useEffect } from 'react'
import Animated, {
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'

/**
 * The portrait card of a profile in depth, as on the cards of the public atlas: the painted
 * backdrop far behind moves against the tilt of the phone, the cut-out character in front moves
 * with it. Only the gravity sensor runs, on the UI thread, while the card is on screen.
 */

type Tilt = { x: number; y: number }

/** The share of gravity, away from where the phone was held, that moves the layers all the way. */
const FULL_TILT = 0.35
const BACKDROP_SHIFT = 10
const SUBJECT_SHIFT = 6
/** Each layer is larger than the card so that its edges never show once moved. */
const BACKDROP_SCALE = 1.12
const SUBJECT_SCALE = 1.05
const SPRING = { damping: 20, stiffness: 120, mass: 0.6 }
/** About 30 readings a second: smooth once sprung, half the cost of the screen's rate. */
const SENSOR_INTERVAL = 33

const clampUnit = (value: number) => {
  'worklet'
  return Math.max(-1, Math.min(1, value))
}

/**
 * Reads the tilt while mounted, from where the phone was held when it mounted; let go, the layers
 * come back to rest. Mount it only while the card is shown and moves.
 */
export const EntityPortraitTiltSensor = ({ tilt }: { tilt: SharedValue<Tilt> }) => {
  const { sensor } = useAnimatedSensor(SensorType.GRAVITY, { interval: SENSOR_INTERVAL })
  const rest = useSharedValue<Tilt | null>(null)

  useAnimatedReaction(
    () => sensor.get(),
    gravity => {
      // The first readings can be empty while the sensor starts.
      if (gravity.x === 0 && gravity.y === 0 && gravity.z === 0) return
      const start = rest.get()
      if (!start) {
        rest.set({ x: gravity.x, y: gravity.y })
        return
      }
      tilt.set({
        x: clampUnit((gravity.x - start.x) / (9.81 * FULL_TILT)),
        y: clampUnit((gravity.y - start.y) / (9.81 * FULL_TILT)),
      })
    }
  )

  useEffect(() => () => tilt.set({ x: 0, y: 0 }), [tilt])

  return null
}

export const useEntityPortraitTilt = () => useSharedValue<Tilt>({ x: 0, y: 0 })

type PointerEvent = {
  nativeEvent: { clientX: number; clientY: number }
  currentTarget: unknown
}

/**
 * On the Web and in the desktop app, where no sensor runs, the pointer over the picture stands for
 * the tilt: at its centre the layers rest, toward an edge they move as a phone leaning that way
 * would move them, the character following the pointer. Let go, they come back to rest.
 */
export const useEntityPortraitPointer = (tilt: SharedValue<Tilt>) => ({
  onPointerMove: (event: PointerEvent) => {
    const target = event.currentTarget as { getBoundingClientRect?: () => DOMRect }
    const box = target.getBoundingClientRect?.()
    if (!box?.width || !box.height) return
    const px = (event.nativeEvent.clientX - box.left) / box.width
    const py = (event.nativeEvent.clientY - box.top) / box.height
    tilt.set({ x: clampUnit((px - 0.5) * 2), y: clampUnit(-(py - 0.5) * 2) })
  },
  onPointerLeave: () => tilt.set({ x: 0, y: 0 }),
})

export const useEntityPortraitLayerStyles = (tilt: SharedValue<Tilt>) => {
  const backdrop = useAnimatedStyle(() => {
    const { x, y } = tilt.get()
    return {
      transform: [
        { translateX: withSpring(-x * BACKDROP_SHIFT, SPRING) },
        { translateY: withSpring(y * BACKDROP_SHIFT, SPRING) },
        { scale: BACKDROP_SCALE },
      ],
    }
  })
  const subject = useAnimatedStyle(() => {
    const { x, y } = tilt.get()
    return {
      transform: [
        { translateX: withSpring(x * SUBJECT_SHIFT, SPRING) },
        { translateY: withSpring(-y * SUBJECT_SHIFT, SPRING) },
        { scale: SUBJECT_SCALE },
      ],
    }
  })
  return { backdrop, subject }
}

export const ParallaxLayer = Animated.View
