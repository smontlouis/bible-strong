import { Easing, FadeIn, FadeOut, Keyframe } from 'react-native-reanimated'

/**
 * Short motions of the controls (design system: about 180 ms, ease-out). Reanimated leaves them
 * out when the system asks for less motion.
 */

/** An icon that takes the place of another: it grows in from a little smaller. */
export const popIn = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.6 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(200)

/** A label that takes the place of another. */
export const fadeIn = FadeIn.duration(220)

/** A background that changes colour, on an animated view. */
export const colorTransition = {
  transitionProperty: 'backgroundColor',
  transitionDuration: 220,
  transitionTimingFunction: 'ease-out',
} as const

/** A label that leaves, before the next one fades in. */
export const fadeOut = FadeOut.duration(160)

/** A label that fades in where another has just left. */
export const fadeInAfter = FadeIn.duration(220).delay(120)
