import type { ParallelColumnWidth } from 'src/state/tabs'
import { scaleFontSize } from './scaleFontSize'

export const getBibleTextFontSize = (fontSizeScale: number) => scaleFontSize(19, fontSizeScale)

// Narrow parallel columns read better with smaller text: 50% columns bring 19 px down to 16 px
const PARALLEL_COLUMN_TEXT_SCALE: Record<ParallelColumnWidth, number> = {
  100: 1,
  75: 0.9,
  50: 16 / 19,
}

/**
 * The reader's font size scale inside horizontal parallel columns. Everything the columns hold,
 * text, verse numbers and chips, shrinks together and keeps the proportions of single reading.
 */
export const getParallelColumnFontSizeScale = (
  fontSizeScale: number,
  columnWidth: ParallelColumnWidth
) => ((1 + fontSizeScale * 0.1) * PARALLEL_COLUMN_TEXT_SCALE[columnWidth] - 1) * 10
