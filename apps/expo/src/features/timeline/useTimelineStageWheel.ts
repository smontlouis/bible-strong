import type { RefObject } from 'react'
import type { View } from 'react-native'

/** A wheel travels through time on the Web; a finger does it everywhere else. */
export const useTimelineStageWheel = (
  _target: RefObject<View | null>,
  _onTravel: (distance: number) => void
) => {}
