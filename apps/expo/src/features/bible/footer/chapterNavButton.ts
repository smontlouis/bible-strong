import { Platform, type DimensionValue } from 'react-native'
import { BIBLE_READING_HORIZONTAL_PADDING, READING_TEXT_MAX_WIDTH } from '~common/readingLayout'

const isWeb = Platform.OS === 'web'

/** Floating previous/next chapter buttons: bigger and lifted by a shadow on web. */
export const CHAPTER_NAV_BUTTON_SIZE = isWeb ? 48 : 40
export const CHAPTER_NAV_ICON_SIZE = isWeb ? 24 : 20
/** Minimum distance between a button and the edge of the Bible pane. */
export const CHAPTER_NAV_SIDE_OFFSET = isWeb ? 16 : 10
/** Web: gap kept between a button and the reading column when the pane is wide enough. */
const CHAPTER_NAV_COLUMN_GAP = 20
const READING_COLUMN_WIDTH = READING_TEXT_MAX_WIDTH + BIBLE_READING_HORIZONTAL_PADDING * 2

/**
 * Horizontal offset of a button from its side of the pane.
 * On web, a single-column Bible keeps the buttons outside the centred reading column
 * whenever the pane has room, and lets them hug the pane edge below that.
 */
export const chapterNavSideOffset = (isParallel: boolean): DimensionValue => {
  if (!isWeb || isParallel) return CHAPTER_NAV_SIDE_OFFSET
  const outsideColumn = READING_COLUMN_WIDTH / 2 + CHAPTER_NAV_COLUMN_GAP + CHAPTER_NAV_BUTTON_SIZE
  return `max(${CHAPTER_NAV_SIDE_OFFSET}px, calc(50% - ${outsideColumn}px))` as DimensionValue
}

export const chapterNavButtonStyle = {
  width: CHAPTER_NAV_BUTTON_SIZE,
  height: CHAPTER_NAV_BUTTON_SIZE,
  borderRadius: CHAPTER_NAV_BUTTON_SIZE / 2,
  boxShadow: 'rgba(0, 0, 0, 0.15) 0px 8px 16px'
} as const
