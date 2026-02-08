import { getDefaultStore } from 'jotai/vanilla'
import { SharedValue, withTiming } from 'react-native-reanimated'
import { runOnJS } from 'react-native-worklets'
import { tabsAtomsAtom } from '../../../state/tabs'

/**
 * Resolves an index to a stable tab.id and sets it on the SharedValue.
 * Bounds-checks to prevent crashes when switching groups.
 */
export const resolveAndSetTabId = (tabIdSharedValue: SharedValue<string | null>, index: number) => {
  const store = getDefaultStore()
  const tabsAtoms = store.get(tabsAtomsAtom)
  if (tabsAtoms.length === 0) return
  const safeIndex = Math.max(0, Math.min(index, tabsAtoms.length - 1))
  const tab = store.get(tabsAtoms[safeIndex])
  tabIdSharedValue.set(tab.id)
}

/**
 * Fades in the active tab screen and takes a snapshot once visible.
 * Runs with a 50ms delay to let the WebView mount first.
 */
export const fadeInTabScreen = (
  opacitySV: SharedValue<number>,
  indexSV: SharedValue<number>,
  tabIdSV: SharedValue<string | null>,
  snapshotFn: (index: number, tabId: string) => void
) => {
  setTimeout(() => {
    opacitySV.set(
      withTiming(1, undefined, () => {
        runOnJS(snapshotFn)(indexSV.get(), tabIdSV.get() || '')
      })
    )
  }, 50)
}

/**
 * Rubber-band clamping worklet for overscroll effects.
 * Returns the value with elastic resistance when outside [min, max].
 */
export const rubberBand = (
  value: number,
  min: number,
  max: number,
  resistance: number = 0.3,
  maxOverscroll: number = Infinity
): number => {
  'worklet'
  if (value < min) {
    const overscroll = min - value
    return min - Math.min(overscroll * resistance, maxOverscroll)
  }
  if (value > max) {
    const overscroll = value - max
    return max + Math.min(overscroll * resistance, maxOverscroll)
  }
  return value
}
