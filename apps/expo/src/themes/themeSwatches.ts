import type { CurrentTheme } from '~common/types'

/**
 * The circle that names a theme in a picker. A dark ground alone is near black in three of the
 * dark themes, so each of them shows its hue a few steps lighter; Noir keeps its black.
 */
export const themeSwatches: Record<CurrentTheme, string> = {
  default: 'rgb(255,255,255)',
  sepia: 'rgb(245,242,227)',
  nature: '#EAF9EC',
  sunset: '#FAE0D5',
  dark: '#26375a',
  black: '#000000',
  mauve: 'rgb(78,22,72)',
  night: '#244a35',
}
