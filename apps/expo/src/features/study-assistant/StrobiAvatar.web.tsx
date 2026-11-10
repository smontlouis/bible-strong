import { useEffect, useRef } from 'react'
import { createAvatar, type AvatarController } from '@bible-strong/avatar-react'
import '@bible-strong/avatar-react/styles.css'
import strobiDefinition from './strobi.avatar.json'
import type { StrobiAnimation } from './StrobiAvatar'

export type { StrobiAnimation }

const Avatar = createAvatar(strobiDefinition)

/**
 * The web renderer of Strobi, with the props of the native one: the web package draws the same
 * definition in the DOM. A settling avatar pauses on its current frame.
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
  const avatar = useRef<AvatarController>(null)
  useEffect(() => {
    if (!settleAfterMs) return
    const timer = setTimeout(() => avatar.current?.pause(), settleAfterMs)
    return () => clearTimeout(timer)
  }, [animation, settleAfterMs])
  return (
    <Avatar
      ref={avatar}
      animation={animation}
      size={size}
      style={{
        pointerEvents: 'none',
        filter: muted ? 'grayscale(1)' : undefined,
        transition: 'filter 300ms ease-out',
      }}
    />
  )
}
