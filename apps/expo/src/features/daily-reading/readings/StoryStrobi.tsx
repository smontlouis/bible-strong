import { use, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import Animated, { css } from 'react-native-reanimated'
import StrobiAvatar, { type StrobiHandle } from '~features/study-assistant/StrobiAvatar'
import { StoryArrival } from './storyArrival'

/** It floats, gently: a little higher, then back. Declared once, so it never restarts. */
const FLOAT = css.keyframes({
  '0%': { transform: [{ translateY: 0 }] },
  '50%': { transform: [{ translateY: -4 }] },
  '100%': { transform: [{ translateY: 0 }] },
})

/** How long Strobi stays curious once it has come, before it rests. */
const CURIOUS_MS = 1800

const web = Platform.OS === 'web'

/**
 * Strobi beside the questions of « Aller plus loin » (2026-11-26), so that the reader sees who
 * a question talks to: it comes curious, then floats gently with its eyes on the questions; on
 * the web it follows the pointer over them. When a question is chosen it turns to it, nods and
 * lights up, and the conversation opens. A reader who asked for less motion sees it still.
 */
const StoryStrobi = ({
  size,
  asking,
  still,
}: {
  size: number
  /** The question being opened, from the first (0), or none. */
  asking: number | null
  still: boolean
}) => {
  const handle = useRef<StrobiHandle>(null)
  const [rested, setRested] = useState(false)
  const wait = use(StoryArrival)
  useEffect(() => {
    const timer = setTimeout(() => setRested(true), wait + CURIOUS_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (asking != null) handle.current?.poke('nod')
  }, [asking])
  const mood = asking != null ? 'excited' : rested ? 'idle' : 'curious'
  // The questions are below it and to its left, plainly; each one a little lower than the one
  // before. A soft turn did not read as looking at them on a phone.
  const lookAt =
    asking != null
      ? ([-1, Math.max(-1, -0.6 - asking * 0.2)] as const)
      : web
        ? null
        : ([-1, -0.85] as const)
  return (
    <Animated.View
      style={
        still
          ? undefined
          : {
              animationName: FLOAT,
              animationDuration: 3000,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            }
      }
    >
      <StrobiAvatar
        animation={mood}
        size={size}
        lookAt={lookAt}
        followPointer={web && asking == null}
        avatarRef={handle}
      />
    </Animated.View>
  )
}

export default StoryStrobi
