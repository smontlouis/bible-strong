import { createAvatar } from '@bible-strong/avatar-react'
import strobiFile from '~features/study-assistant/strobi.avatar.json'
import type { OnboardingStrobiProps } from './OnboardingStrobi'

const Avatar = createAvatar(strobiFile)

/** Strobi as the onboarding's guide, drawn in the DOM with the same props as on native. */
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
      ariaLabel="Strobi"
      style={{ pointerEvents: 'none' }}
    />
  )
}
