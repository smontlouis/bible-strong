import { useEffect, useRef, useState } from 'react'
import type { StrobiAnimation } from './StrobiAvatar'

type Reaction = { animation: StrobiAnimation; ms: number }

/**
 * Strobi's mood on a screen: a resting animation, and short reactions to what the reader does,
 * after which it comes back to rest. `opening` is the reaction it plays as the screen appears.
 */
export function useStrobiReaction(resting: StrobiAnimation, opening?: Reaction) {
  const [reaction, setReaction] = useState<StrobiAnimation | null>(opening?.animation ?? null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const react = (animation: StrobiAnimation, ms = 1600) => {
    clear()
    setReaction(animation)
    timer.current = setTimeout(() => setReaction(null), ms)
  }

  useEffect(() => {
    if (opening) timer.current = setTimeout(() => setReaction(null), opening.ms)
    return clear
    // The opening reaction plays once, as the screen appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return [reaction ?? resting, react] as const
}
