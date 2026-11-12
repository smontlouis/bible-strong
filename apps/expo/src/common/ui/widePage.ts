import type { RefCallback } from 'react'
import type { View } from 'react-native'

/** Width a page laid out in two columns may take, gutters included. */
export const WIDE_PAGE_MAX_WIDTH = 1140
/** Page width from which a page may set two columns. */
export const WIDE_PAGE_MIN_WIDTH = 1000
/** Height of a page header, which the page's own measure includes. */
export const WIDE_PAGE_HEADER_HEIGHT = 54

export type WidePage = {
  /** Whether the page has room for two columns. */
  wide: boolean
  /** Height of the page, which decides whether a column may stay in place. */
  height: number
  /** Set on the page's root, which holds its header and its scroll view. */
  ref?: RefCallback<View>
}

/** Space between the two columns of a wide page. */
export const SPLIT_COLUMNS_GAP = 36
/** Width of the column that carries what goes with the text: links, sources, a verse. */
export const SPLIT_SIDE_WIDTH = 400
/** Width of a page whose text of `main` points sits beside a side column, gutters included. */
export const splitPageWidth = (main: number, side = SPLIT_SIDE_WIDTH) =>
  main + SPLIT_COLUMNS_GAP + side + 40
/** Width of a study page (a column of 600 points, as `StudySection` sets it) beside a side column. */
export const STUDY_SPLIT_PAGE_WIDTH = splitPageWidth(600)
