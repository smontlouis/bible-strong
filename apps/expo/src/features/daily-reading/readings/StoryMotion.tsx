import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, { Easing, Keyframe, ReduceMotion, useReducedMotion } from 'react-native-reanimated'
import { TEXT_MOTION } from './storySceneMotion'

/**
 * How what the stories show comes and goes (2026-11-26): a text rises into place, a badge grows,
 * a button fades in, each once the card before has gone (TEXT_MOTION); what is taken away fades
 * out and lifts a little. On iOS and Android, Reanimated's `entering` and `exiting`: an arrival
 * plays once, when the view appears, and a view taken away stays until it has faded. The web
 * does the same with motion (StoryMotion.web.tsx).
 */

export type StoryMotionProps = {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  /** How it comes: rising from a little below, growing (a badge), fading in place, or already there. */
  enter?: 'rise' | 'pop' | 'fade' | 'none'
  /** Its pause once the card before has gone. */
  delay?: number
  duration?: number
  /** It fades out and lifts a little when taken away. */
  leave?: boolean
  /** `box-none`: a tap beside what it holds reaches what lies under it. */
  pointerEvents?: 'box-none'
}

/** Holds views that come and go; on the web, keeps a view taken away until it has faded. */
export const StoryPresence = ({ children }: { children?: ReactNode }) => children

const EASE_OUT = Easing.bezier(0.33, 1, 0.68, 1)

const durationOf = (enter: StoryMotionProps['enter']) =>
  enter === 'pop'
    ? TEXT_MOTION.popDuration
    : enter === 'fade'
      ? TEXT_MOTION.buttonsDuration
      : TEXT_MOTION.riseDuration

/** A reader who asked for less motion still sees the fades, without the movements. */
const arrival = (
  enter: StoryMotionProps['enter'],
  delay: number,
  duration: number,
  still: boolean
) => {
  const frames =
    enter === 'rise' && !still
      ? {
          0: { opacity: 0, transform: [{ translateY: TEXT_MOTION.riseDistance }] },
          100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
        }
      : enter === 'pop' && !still
        ? {
            0: { opacity: 0, transform: [{ scale: 0.6 }] },
            100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
          }
        : { 0: { opacity: 0 }, 100: { opacity: 1, easing: EASE_OUT } }
  return new Keyframe(frames)
    .duration(duration)
    .delay(TEXT_MOTION.arriveDelay + delay)
    .reduceMotion(ReduceMotion.Never)
}

const departure = (still: boolean) =>
  new Keyframe(
    still
      ? { 0: { opacity: 1 }, 100: { opacity: 0, easing: EASE_OUT } }
      : {
          0: { opacity: 1, transform: [{ translateY: 0 }] },
          100: {
            opacity: 0,
            transform: [{ translateY: -TEXT_MOTION.leaveDistance }],
            easing: EASE_OUT,
          },
        }
  )
    .duration(TEXT_MOTION.leaveDuration)
    .reduceMotion(ReduceMotion.Never)

const StoryMotion = ({
  children,
  style,
  enter = 'rise',
  delay = 0,
  duration = durationOf(enter),
  leave = false,
  pointerEvents,
}: StoryMotionProps) => {
  const still = useReducedMotion()
  return (
    <Animated.View
      pointerEvents={pointerEvents}
      style={style}
      entering={enter === 'none' ? undefined : arrival(enter, delay, duration, still)}
      exiting={leave ? departure(still) : undefined}
    >
      {children}
    </Animated.View>
  )
}

export default StoryMotion
