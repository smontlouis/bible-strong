import { useRef, type Ref } from 'react'
import { Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { createAvatar, type AvatarHandle } from '@bible-strong/avatar-react-native'
import strobiDefinition from './strobi.avatar.json'
import type { StrobiMood } from './strobiMood'

/** What can be asked of Strobi through `avatarRef`: a gesture over what it plays. */
export type { AvatarHandle as StrobiHandle }

/**
 * What Strobi can be asked to play: the animations of its file of the first version, each of
 * which is a state of the shared catalogue (idle, sleeping, happy, celebrate, proud, curious…).
 */
export type StrobiAnimation = keyof typeof strobiDefinition.animations

/** States of the shared catalogue that Strobi's file does not name. */
type CatalogueState = 'blocked'

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
  pettable = false,
  onPet,
  lookAt = null,
  avatarRef,
}: {
  /** An animation of its file, or a state of the catalogue the conversation uses. */
  animation: StrobiAnimation | StrobiMood | CatalogueState
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
  /**
   * Strobi standing on its own (a page, a card, not a row that opens something): touched, it
   * spins with a light tap of the haptic engine, as in the onboarding (2026-11-15).
   */
  pettable?: boolean
  /** Also told when Strobi is touched, for a reaction of the screen's own. */
  onPet?: () => void
  /**
   * Where Strobi looks, `[x, y]` to the right and up, each from -1 to 1: its head turns there
   * smoothly, and back when null (2026-11-26).
   */
  lookAt?: readonly [number, number] | null
  /** Only the web follows the pointer; a phone has none. */
  followPointer?: boolean
  /** For a gesture laid over what it plays (`nod`, `bounce`, `spin`). */
  avatarRef?: Ref<AvatarHandle>
}) {
  const own = useRef<AvatarHandle>(null)
  const handle = (avatarRef ?? own) as typeof own
  const avatar = (
    <Avatar
      ref={handle}
      state={animation}
      size={size}
      accessibilityLabel="Strobi"
      muted={muted}
      paused={muted}
      settleAfterMs={settleAfterMs}
      lookAt={lookAt}
    />
  )
  if (!pettable) return avatar
  return (
    <Pressable
      accessible={false}
      hitSlop={8}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        handle.current?.poke('spin')
        onPet?.()
      }}
    >
      {avatar}
    </Pressable>
  )
}
