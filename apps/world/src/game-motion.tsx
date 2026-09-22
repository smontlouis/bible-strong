import {
  AnimatePresence,
  MotionConfig,
  motion,
  useIsPresent,
  type HTMLMotionProps,
} from 'motion/react'
import type { ReactNode } from 'react'

/* Motion presets for the games: enter, exit and layout moves of blocks that appear
   and disappear. Particles, shakes and curtains stay in game-juice.css. */

export { AnimatePresence, motion }

export const springy = { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 } as const
export const quick = { duration: 0.16, ease: [0.4, 0, 1, 1] } as const

/** Pop in, fade out. */
export const pop = {
  initial: { opacity: 0, scale: 0.9, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: springy },
  exit: { opacity: 0, scale: 0.96, y: -6, transition: quick },
} as const

/** Grow from zero height, collapse on exit (blocks in a column). */
export const collapse = {
  initial: { opacity: 0, height: 0, scale: 0.96 },
  animate: { opacity: 1, height: 'auto', scale: 1, transition: springy },
  exit: { opacity: 0, height: 0, scale: 0.96, transition: quick },
} as const

/** New content slides in from the right while the old one leaves to the left. */
export const swap = {
  initial: { opacity: 0, x: 44 },
  animate: { opacity: 1, x: 0, transition: springy },
  exit: { opacity: 0, x: -36, transition: quick },
} as const

/** Stagger children that use `item`. */
export const stagger = {
  initial: 'hidden',
  animate: 'show',
  variants: { show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } },
} as const
export function staggerAfter(delay: number, gap = 0.09) {
  return {
    initial: 'hidden',
    animate: 'show',
    variants: { show: { transition: { staggerChildren: gap, delayChildren: delay } } },
  } as const
}
export const item = {
  variants: {
    hidden: { opacity: 0, y: 14, scale: 0.94 },
    show: { opacity: 1, y: 0, scale: 1, transition: springy },
  },
} as const

export function GameMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

type DivProps = HTMLMotionProps<'div'>
type PProps = HTMLMotionProps<'p'>

/** A block that is animating out is inert: its buttons must not send a second command. */
function useLeaving() {
  const present = useIsPresent()
  return present ? {} : { inert: true, style: { pointerEvents: 'none' as const } }
}
/** Block that pops in and fades out; wrap it in an AnimatePresence to get the exit. */
export function Appear({ layout = true, style, ...props }: DivProps) {
  const leaving = useLeaving()
  return (
    <motion.div layout={layout} {...pop} {...props} {...leaving} style={{ ...style, ...leaving.style }} />
  )
}
export function AppearP({ layout = true, style, ...props }: PProps) {
  const leaving = useLeaving()
  return (
    <motion.p layout={layout} {...pop} {...props} {...leaving} style={{ ...style, ...leaving.style }} />
  )
}
/** Block that grows and collapses; keeps overflow hidden while moving. */
export function Collapse({ style, ...props }: DivProps) {
  const leaving = useLeaving()
  return (
    <motion.div
      {...collapse}
      {...props}
      {...leaving}
      style={{ overflow: 'hidden', ...style, ...leaving.style }}
    />
  )
}
