// Maximum paragraph width, excluding each surface's horizontal padding.
export const READING_TEXT_MAX_WIDTH = 580
export const BIBLE_READING_HORIZONTAL_PADDING = 15
// The Bible header's selector pills start this far from the edge, a little before the text
export const BIBLE_HEADER_PILL_INSET = 10
// Space between two horizontal parallel columns
export const PARALLEL_COLUMN_GAP = 10
// Width of the horizontal parallel columns, from the first column's start to the last one's end
export const getParallelColumnsWidth = (columnCount: number, columnWidth: number) =>
  `calc(${columnCount} * (${columnWidth}vw - ${PARALLEL_COLUMN_GAP}px))`
export const PLAN_READING_HORIZONTAL_PADDING = 20
