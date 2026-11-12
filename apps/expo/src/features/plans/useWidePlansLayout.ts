import type { RefObject } from 'react'
import type { LayoutChangeEvent, View } from 'react-native'

export type WidePlansLayout = {
  /** Whether the page has room for the followed plans beside the catalogue. */
  wide: boolean
  /** Height of the page, which decides whether the side column may stay in place. */
  height: number
  ref?: RefObject<View | null>
  onLayout?: (event: LayoutChangeEvent) => void
}

/** The native apps keep the list: only a large Web window lays the plans out in two columns. */
export const useWidePlansLayout = (): WidePlansLayout => ({ wide: false, height: 0 })
