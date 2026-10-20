import type { ViewStyle } from 'react-native'

/**
 * Corner radii of the app's surfaces. The rules that pick one are in
 * design-system/project/README.md, chapter "The app".
 */
export const radii = {
  /** A highlight or a small mark set in text. */
  mark: 4,
  /** Icon tiles, thumbnails, chips inside a row. */
  tile: 8,
  /** Text fields and inner panels. */
  control: 12,
  /** Cards on the canvas. */
  card: 16,
  /** Sheets and the large cards of a hub. */
  sheet: 24,
  /** Buttons and chips. */
  pill: 999,
} as const

/** The only shadow of the app, for what floats above the page: bars, floating buttons, popovers. */
export const floatingShadow = {
  boxShadow: '0 6px 20px rgba(16, 27, 53, 0.14)',
} satisfies ViewStyle
