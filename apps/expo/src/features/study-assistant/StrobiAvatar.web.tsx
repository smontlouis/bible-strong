import { createAvatar } from '@bible-strong/avatar-react'
import strobiDefinition from './strobi.avatar.json'
import type { StrobiAnimation } from './StrobiAvatar'

export type { StrobiAnimation }

const Avatar = createAvatar(strobiDefinition)

/**
 * The web renderer of Strobi, with the props of the native one: `@bible-strong/avatar-react`
 * draws the same character in the DOM, greys it and settles it the same way.
 */
export default function StrobiAvatar({
  animation,
  size,
  muted = false,
  settleAfterMs = 0,
}: {
  animation: StrobiAnimation
  size: number
  muted?: boolean
  settleAfterMs?: number
}) {
  return (
    <Avatar
      state={animation}
      size={size}
      ariaLabel="Strobi"
      muted={muted}
      settleAfterMs={muted ? 1 : settleAfterMs}
      style={{ pointerEvents: 'none' }}
    />
  )
}
