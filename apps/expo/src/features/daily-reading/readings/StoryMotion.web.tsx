import { AnimatePresence, motion, useReducedMotion, type MotionStyle } from 'motion/react'
import type { ReactNode, Ref } from 'react'
import { StyleSheet } from 'react-native'
import type { StoryMotionProps } from './StoryMotion'
import { TEXT_MOTION } from './storySceneMotion'

/**
 * The stories' comings and goings on the web and in the desktop app, with motion (see
 * StoryMotion.tsx). Reanimated's `entering` froze the texts there (2026-11-26).
 */

/**
 * Keeps a view taken away until it has faded, out of the layout meanwhile, so that what stays
 * or arrives does not move.
 */
export const StoryPresence = ({ children }: { children?: ReactNode }) => (
  <AnimatePresence mode="popLayout">{children}</AnimatePresence>
)

const EASE_OUT = [0.33, 1, 0.68, 1] as const

/** How React Native Web lays out a View, for the block that stands in for one. */
const VIEW_BOX = {
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  boxSizing: 'border-box',
  minWidth: 0,
  minHeight: 0,
  flexShrink: 0,
} as const

const durationOf = (enter: StoryMotionProps['enter']) =>
  enter === 'pop'
    ? TEXT_MOTION.popDuration
    : enter === 'fade'
      ? TEXT_MOTION.buttonsDuration
      : TEXT_MOTION.riseDuration

const seconds = (milliseconds: number) => milliseconds / 1000

const StoryMotion = ({
  children,
  style,
  enter = 'rise',
  delay = 0,
  duration = durationOf(enter),
  leave = false,
  pointerEvents,
  ref,
}: StoryMotionProps & { ref?: Ref<HTMLDivElement> }) => {
  // A reader who asked for less motion still sees the fades, without the movements.
  const still = useReducedMotion() ?? false
  const hidden =
    enter === 'rise' && !still
      ? { opacity: 0, y: TEXT_MOTION.riseDistance }
      : enter === 'pop' && !still
        ? { opacity: 0, scale: 0.6 }
        : { opacity: 0 }
  return (
    <motion.div
      ref={ref}
      style={{
        ...VIEW_BOX,
        ...(StyleSheet.flatten(style) as MotionStyle),
        // `box-none`: the block lets a click through, what it holds still takes one.
        ...(pointerEvents === 'box-none' ? { pointerEvents: 'none' } : null),
      }}
      initial={enter === 'none' ? false : hidden}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: seconds(duration),
        delay: seconds(TEXT_MOTION.arriveDelay + delay),
        ease: EASE_OUT,
      }}
      exit={
        leave
          ? {
              opacity: 0,
              y: still ? 0 : -TEXT_MOTION.leaveDistance,
              transition: { duration: seconds(TEXT_MOTION.leaveDuration), ease: EASE_OUT },
            }
          : undefined
      }
    >
      {pointerEvents === 'box-none' ? (
        <div style={{ display: 'contents', pointerEvents: 'auto' }}>{children}</div>
      ) : (
        children
      )}
    </motion.div>
  )
}

export default StoryMotion
