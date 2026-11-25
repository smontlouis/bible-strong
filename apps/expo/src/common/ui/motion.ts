import { Easing, FadeIn, FadeOut, Keyframe, withTiming } from 'react-native-reanimated'

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

// FadingBox's slide of 5 points, with no wait for the leaving one.
const turnIn = (from: number) => () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateY: from }] },
    animations: {
      opacity: withTiming(1, { duration: 200 }),
      transform: [{ translateY: withTiming(0, { duration: 200 }) }],
    },
  }
}

/** A number that turns up into place, as the one before leaves. */
export const turnUpIn = turnIn(5)

/** A number that turns down into place. */
export const turnDownIn = turnIn(-5)
