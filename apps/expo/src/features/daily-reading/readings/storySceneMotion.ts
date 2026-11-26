import {
  cubicBezier,
  Easing,
  useAnimatedStyle,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated'

/**
 * How the painted scene of the stories moves (2026-11-26). It stands in depth: the far
 * background moves against the tilt of the phone (or the pointer on a wide screen), the cut-out
 * foreground moves with it, and the text floats a little between them. Leaving the verse for the
 * reading cards, the eye goes into the scene: both layers come closer and blur, the near one more;
 * on the closing blessing it steps back and the scene is sharp again.
 */

export type Tilt = { x: number; y: number }

export type SceneDepth = {
  /** How far a full tilt moves the layer, in points, and which way. */
  shift: number
  direction: 1 | -1
  /** Larger than the stage at rest, so that its edges never show once moved. */
  scale: number
  /** The extra closeness once the eye is in the scene, and how far it comes down. */
  focusScale: number
  focusLift: number
  /** Its blur at rest, and once the eye is in the scene. */
  blur: number
  focusBlur: number
}

export const BACKGROUND_DEPTH: SceneDepth = {
  shift: 8,
  direction: -1,
  scale: 1.04,
  focusScale: 1.08,
  focusLift: 0,
  blur: 0,
  focusBlur: 7,
}

export const FOREGROUND_DEPTH: SceneDepth = {
  shift: 14,
  direction: 1,
  scale: 1.07,
  focusScale: 1.18,
  focusLift: 14,
  blur: 0.6,
  focusBlur: 11,
}

/** The text moves a little with the tilt, between the two layers. */
export const TEXT_SHIFT = 3

export const FOCUS_DURATION = 750
export const FOCUS_EASING = Easing.inOut(Easing.cubic)
/** The same curve for the web's CSS transitions. */
export const FOCUS_CSS_EASING = cubicBezier(0.65, 0, 0.35, 1)

const TILT_SPRING = { damping: 20, stiffness: 90, mass: 0.8 }

/** The tilt's part of a layer's movement, sprung so that it stays smooth; none when still. */
export const useTiltStyle = (
  tilt: SharedValue<Tilt>,
  shift: number,
  direction: 1 | -1,
  still: boolean
) =>
  useAnimatedStyle(() => {
    if (still) return { transform: [{ translateX: 0 }, { translateY: 0 }] }
    const { x, y } = tilt.get()
    return {
      transform: [
        { translateX: withSpring(direction * x * shift, TILT_SPRING) },
        { translateY: withSpring(-direction * y * shift, TILT_SPRING) },
      ],
    }
  })
