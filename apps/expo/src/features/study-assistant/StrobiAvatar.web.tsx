import { useRef, type Ref } from 'react'
import { createAvatar, type AvatarHandle } from '@bible-strong/avatar-react'
import strobiDefinition from './strobi.avatar.json'
import type { StrobiAnimation } from './StrobiAvatar'

/** What can be asked of Strobi through `avatarRef`: a gesture over what it plays. */
export type { AvatarHandle as StrobiHandle }

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
  lookAt = null,
  followPointer = false,
  avatarRef,
}: {
  animation: StrobiAnimation
  size: number
  muted?: boolean
  settleAfterMs?: number
  /** Touched, Strobi spins, as in the onboarding (the browser has no haptics). */
  pettable?: boolean
  onPet?: () => void
  /** Where Strobi looks; it comes before the pointer. */
  lookAt?: readonly [number, number] | null
  /** Strobi follows the pointer with its head while it looks nowhere else. */
  followPointer?: boolean
  avatarRef?: Ref<AvatarHandle>
}) {
  const own = useRef<AvatarHandle>(null)
  const handle = (avatarRef ?? own) as typeof own
  const avatar = (
    <Avatar
      ref={handle}
      state={animation}
      size={size}
      ariaLabel="Strobi"
      muted={muted}
      settleAfterMs={muted ? 1 : settleAfterMs}
      lookAt={lookAt}
      followPointer={followPointer}
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
