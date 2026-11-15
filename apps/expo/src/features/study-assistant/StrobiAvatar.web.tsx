import { useRef } from 'react'
import { createAvatar, type AvatarHandle } from '@bible-strong/avatar-react'
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
  pettable = false,
  onPet,
}: {
  animation: StrobiAnimation
  size: number
  muted?: boolean
  settleAfterMs?: number
  /** Touched, Strobi spins, as in the onboarding (the browser has no haptics). */
  pettable?: boolean
  onPet?: () => void
}) {
  const handle = useRef<AvatarHandle>(null)
  const avatar = (
    <Avatar
      ref={handle}
      state={animation}
      size={size}
      ariaLabel="Strobi"
      muted={muted}
      settleAfterMs={muted ? 1 : settleAfterMs}
      style={{ pointerEvents: 'none' }}
    />
  )
  if (!pettable) return avatar
  return (
    <div
      role="presentation"
      style={{ display: 'inline-flex', cursor: 'pointer' }}
      onClick={() => {
        handle.current?.poke('spin')
        onPet?.()
      }}
    >
      {avatar}
    </div>
  )
}
