import { createAvatar } from '@bible-strong/avatar-react-native'
import strobiDefinition from './strobi.avatar.json'
import type { StrobiMood } from './strobiMood'

/**
 * What Strobi can be asked to play: the animations of its file of the first version, each of
 * which is a state of the shared catalogue (idle, sleeping, happy, celebrate, proud, curious…).
 */
export type StrobiAnimation = keyof typeof strobiDefinition.animations

// The file is of the first format: the package keeps its character and plays the catalogue.
const Avatar = createAvatar(strobiDefinition)

/**
 * React Native renderer of Strobi. `@bible-strong/avatar-react-native` runs the avatar's engine
 * on the UI thread (Bundle Mode forwards `@bible-strong/avatar-core` to it, see
 * babel.config.js); the frames stop while the app is not active.
 */
export default function StrobiAvatar({
  animation,
  size,
  muted = false,
  settleAfterMs = 0,
}: {
  /** An animation of its file, or a state of the catalogue the conversation uses. */
  animation: StrobiAnimation | StrobiMood
  size: number
  /**
   * Greyed out, as a floating button left idle: it stops where it is and computes nothing, in
   * whatever pose it reached (asleep, for the floating button). Settling would not hold a pose
   * with the eyes closed.
   */
  muted?: boolean
  /**
   * Holds the pose this long after the last change, eyes open, and stops computing frames: for
   * an avatar set in a row or a card, which need not move for as long as it is on screen. A new
   * `animation` plays again. 0 keeps it moving.
   */
  settleAfterMs?: number
}) {
  return (
    <Avatar
      state={animation}
      size={size}
      accessibilityLabel="Strobi"
      muted={muted}
      paused={muted}
      settleAfterMs={settleAfterMs}
    />
  )
}
