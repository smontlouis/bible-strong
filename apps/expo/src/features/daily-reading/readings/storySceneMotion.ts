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
 * reading cards, the eye focuses on the text: both layers come closer and blur alike, the text
 * comes a little closer too; on the closing blessing it steps back and the scene is sharp again. The foreground keeps its foot
 * on the bottom of the screen (2026-11-26): it grows from there, so its rocks and grass stay whole
 * at rest and only rise and widen as the eye comes closer.
 */

export type Tilt = { x: number; y: number }

export type SceneDepth = {
  /** How far a full tilt moves the layer, in points, and which way. */
  shift: number
  direction: 1 | -1
  /** Larger than the stage at rest, so that its edges never show once moved. */
  scale: number
  /** The extra closeness once the eye is in the scene. */
  focusScale: number
  /**
   * Where the layer grows from: its middle, or its bottom edge, which then stays on the bottom of
   * the stage. A layer held at the bottom moves up and down by half its shift only, and sits that
   * much lower, so that the tilt never lifts its foot off the screen.
   */
  anchor: 'center' | 'bottom'
  /** Its blur at rest, and once the eye is in the scene. */
  blur: number
  focusBlur: number
}

export const BACKGROUND_DEPTH: SceneDepth = {
  shift: 8,
  direction: -1,
  scale: 1.04,
  focusScale: 1.08,
  anchor: 'center',
  blur: 0,
  focusBlur: 2.5,
}

export const FOREGROUND_DEPTH: SceneDepth = {
  shift: 14,
  direction: 1,
  scale: 1.07,
  focusScale: 1.18,
  anchor: 'bottom',
  blur: 0.6,
  focusBlur: 2,
}

/** The text moves a little with the tilt, between the two layers. */
export const TEXT_SHIFT = 3
/**
 * The text is where the eye focuses on the reading cards (2026-11-26): it comes a little closer
 * while the layers in front of it and behind it blur alike. Kept small: iOS scales the drawn text,
 * which softens it from about 1.05.
 */
export const TEXT_FOCUS_SCALE = 1.03

/**
 * How the texts and buttons of the stories come and go (2026-11-26), read by StoryMotion. The card
 * that leaves fades out and lifts a little; once it is gone, the next card's texts rise one after
 * the other, then its buttons. The two cards follow each other, they never cross. Durations and
 * pauses in milliseconds, distances in points.
 */
export const TEXT_MOTION = {
  /** How long a text takes to rise into place, and from how low it starts. */
  riseDuration: 600,
  riseDistance: 14,
  /** How long the card that leaves takes to fade out, and how far it lifts as it goes. */
  leaveDuration: 420,
  leaveDistance: 8,
  /** How long a new card waits for the old one to fade before its first text rises. */
  arriveDelay: 360,
  /** The pause between the texts of a card: the reference after the verse, the text after its title. */
  step: 160,
  /** The pause between the paragraphs of a page. */
  paragraphStep: 130,
  /** The pause between the questions of « Aller plus loin ». */
  questionStep: 180,
  /** The Strong word's badge pops in, after this pause and in this time. */
  popDelay: 300,
  popDuration: 260,
  /** The buttons at the bottom (« Changer de verset », « Terminer ») come after this pause, in this time. */
  buttonsDelay: 360,
  buttonsDuration: 400,
}

export const FOCUS_DURATION = 1500
export const FOCUS_EASING = Easing.inOut(Easing.cubic)
/** The same curve for the web's CSS transitions. */
export const FOCUS_CSS_EASING = cubicBezier(0.65, 0, 0.35, 1)

const TILT_SPRING = { damping: 20, stiffness: 90, mass: 0.8 }

/** How far a full tilt moves a layer up and down. */
export const verticalShiftOf = (depth: SceneDepth) => {
  'worklet'
  return depth.anchor === 'bottom' ? depth.shift / 2 : depth.shift
}

/** How the layer comes closer: from where it grows, how low it sits, and its scale. */
export const focusTransformOf = (depth: SceneDepth, amount: number, still: boolean) => {
  'worklet'
  return {
    transformOrigin: depth.anchor === 'bottom' ? 'bottom' : 'center',
    transform: still
      ? [{ translateY: 0 }, { scale: 1 }]
      : [
          { translateY: depth.anchor === 'bottom' ? verticalShiftOf(depth) : 0 },
          { scale: depth.scale * (1 + (depth.focusScale - 1) * amount) },
        ],
  }
}

/** The tilt's part of a layer's movement, sprung so that it stays smooth; none when still. */
export const useTiltStyle = (
  tilt: SharedValue<Tilt>,
  shift: number,
  direction: 1 | -1,
  still: boolean,
  verticalShift = shift
) =>
  useAnimatedStyle(() => {
    if (still) return { transform: [{ translateX: 0 }, { translateY: 0 }] }
    const { x, y } = tilt.get()
    return {
      transform: [
        { translateX: withSpring(direction * x * shift, TILT_SPRING) },
        { translateY: withSpring(-direction * y * verticalShift, TILT_SPRING) },
      ],
    }
  })
