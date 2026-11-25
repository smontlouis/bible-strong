import { useEffect, useState, type ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { Easing, Keyframe } from 'react-native-reanimated'
import { AnimatedBox } from './Box'

const ARRIVE_MS = 340
const LEAVE_MS = 260

type SwapProps = {
  /** What is shown: a new id swaps the content. */
  id: string
  /** The place of the content in its sequence, so that a later one comes from below. */
  order: number
  /** How far the content travels as it comes and goes; 0 only fades. */
  distance: number
  /** The arriving content's box. */
  style?: StyleProp<ViewStyle>
  /** The leaving content's box, laid over the arriving one: where it stays anchored. */
  anchor: ViewStyle
  children: ReactNode
}

type Shown = {
  id: string
  order: number
  children: ReactNode
  direction: 1 | -1
  previous: { id: string; children: ReactNode } | null
}

/**
 * Content that gives way to the next: the old one leaves, faded and moved, while the new one
 * arrives from the other side, like a counter turning. Forward (a higher order) comes up from
 * below, backward comes down from above. Nothing moves at the first render.
 */
const Swap = ({ id, order, distance, style, anchor, children }: SwapProps) => {
  const [shown, setShown] = useState<Shown>({
    id,
    order,
    children,
    direction: 1,
    previous: null,
  })
  let current = shown
  if (shown.id !== id) {
    current = {
      id,
      order,
      children,
      direction: order >= shown.order ? 1 : -1,
      previous: { id: shown.id, children: shown.children },
    }
    setShown(current)
  }

  // Once it has left, the old content goes from the tree.
  useEffect(() => {
    if (!current.previous) return
    const timer = setTimeout(() => setShown(state => ({ ...state, previous: null })), LEAVE_MS + 80)
    return () => clearTimeout(timer)
  }, [current.previous])

  const travel = distance * current.direction
  const arrive = new Keyframe({
    0: { opacity: 0, transform: [{ translateY: travel }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
  }).duration(ARRIVE_MS)
  const leave = new Keyframe({
    0: { opacity: 1, transform: [{ translateY: 0 }] },
    100: { opacity: 0, transform: [{ translateY: -travel }], easing: Easing.out(Easing.quad) },
  }).duration(LEAVE_MS)

  return (
    <>
      <AnimatedBox
        key={`in-${current.id}`}
        style={style}
        entering={current.previous ? arrive : undefined}
      >
        {children}
      </AnimatedBox>
      {current.previous && (
        <AnimatedBox
          key={`out-${current.previous.id}`}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[{ position: 'absolute', opacity: 0 }, anchor]}
          entering={leave}
        >
          {current.previous.children}
        </AnimatedBox>
      )}
    </>
  )
}

export default Swap
