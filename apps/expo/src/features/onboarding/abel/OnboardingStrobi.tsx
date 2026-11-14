import { createAvatar, type AvatarHandle } from '@bible-strong/avatar-react-native'
import type { Ref } from 'react'
import strobiFile from '~features/study-assistant/strobi.avatar.json'

const Avatar = createAvatar(strobiFile)

export type OnboardingStrobiProps = {
  ref?: Ref<AvatarHandle>
  /** A state of the avatar catalogue: what Strobi does in this scene. */
  state?: string
  /** A clip of the catalogue played alone, round and round, when there is no state. */
  clip?: string
  /** Where Strobi looks, right and up, each from -1 to 1. */
  lookAt?: readonly [number, number] | null
  size: number
}

/** Strobi as the onboarding's guide: the same character as the assistant's. */
export default function OnboardingStrobi({
  ref,
  state,
  clip,
  lookAt,
  size,
}: OnboardingStrobiProps) {
  return (
    <Avatar
      ref={ref}
      state={state}
      clip={clip}
      lookAt={lookAt}
      size={size}
      accessibilityLabel="Strobi"
    />
  )
}
