import { createAvatar } from '@bible-strong/avatar-react-native'
import strobiDefinition from './strobi.avatar.json'

/** Every animation of the definition: idle, sleeping, happy, celebrate, proud, curious… */
export type StrobiAnimation = keyof typeof strobiDefinition.animations

const Avatar = createAvatar(strobiDefinition)

/**
 * React Native renderer of Strobi. `@bible-strong/avatar-react-native` samples each frame on the
 * UI thread (Bundle Mode forwards `@bible-strong/avatar-core` to it, see babel.config.js); the
 * sampling pauses while the app is not active.
 */
export default function StrobiAvatar({
  animation,
  size,
  muted = false,
  settleAfterMs = 0,
}: {
  animation: StrobiAnimation
  size: number
  /** Greyed out, as a floating button left idle: it stops sampling once its pose is reached. */
  muted?: boolean
  /**
   * Holds the pose this long after an animation starts, eyes open, and stops sampling: for an
   * avatar set in a row or a card, which need not move for as long as it is on screen. A new
   * `animation` plays again. 0 keeps it moving.
   */
  settleAfterMs?: number
}) {
  return (
    <Avatar
      animation={animation}
      size={size}
      accessibilityLabel="Strobi"
      muted={muted}
      settleAfterMs={muted ? 1 : settleAfterMs}
    />
  )
}
