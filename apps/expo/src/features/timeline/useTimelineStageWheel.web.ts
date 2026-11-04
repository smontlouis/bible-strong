import { useEffect, useEffectEvent, type RefObject } from 'react'
import type { View } from 'react-native'

const LINE_HEIGHT = 32

/**
 * A wheel travels through time, as on the public site: turned or swept sideways, it moves the
 * view along the axis. Pinching zooms the page.
 */
export const useTimelineStageWheel = (
  target: RefObject<View | null>,
  onTravel: (distance: number) => void
) => {
  const travel = useEffectEvent(onTravel)
  useEffect(() => {
    const element = target.current as unknown as HTMLElement | null
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX
      if (!delta) return
      event.preventDefault()
      travel(event.deltaMode === 1 ? delta * LINE_HEIGHT : delta)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [target])
}
