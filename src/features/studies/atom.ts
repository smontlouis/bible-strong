import { atom } from 'jotai/vanilla'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

export const openedFromTabAtom = atom(false)

// 5 default colors for the study editor color picker swatches
const DEFAULT_RECENT_COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7']

export const recentColorsAtom = atomWithAsyncStorage<string[]>(
  'studyRecentColors',
  DEFAULT_RECENT_COLORS
)
