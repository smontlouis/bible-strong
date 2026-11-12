import { useLayoutEffect, useRef, useState } from 'react'
import type { View } from 'react-native'
import type { WidePlansLayout } from './useWidePlansLayout'

/** Page width from which the followed plans sit beside the catalogue. */
const WIDE_PAGE = 1000

/** Measures the page, before the first paint, so it never flashes as a list. */
export const useWidePlansLayout = (): WidePlansLayout => {
  const ref = useRef<View>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  const measure = (width: number, height: number) =>
    setFrame(current =>
      current.width === width && current.height === height ? current : { width, height }
    )
  useLayoutEffect(() => {
    const rect = (ref.current as unknown as HTMLElement | null)?.getBoundingClientRect?.()
    if (rect) measure(Math.round(rect.width), Math.round(rect.height))
  }, [])
  return {
    wide: frame.width >= WIDE_PAGE,
    height: frame.height,
    ref,
    onLayout: ({ nativeEvent }) =>
      measure(Math.round(nativeEvent.layout.width), Math.round(nativeEvent.layout.height)),
  }
}
