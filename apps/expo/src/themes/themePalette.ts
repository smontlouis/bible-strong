import type { CurrentTheme } from '~common/types'
import blackColors from './blackColors'
import defaultColors from './colors'
import darkColors from './darkColors'
import type { Theme } from './index'
import mauveColors from './mauveColors'
import natureColors from './natureColors'
import nightColors from './nightColors'
import sepiaColors from './sepiaColors'
import sunsetColors from './sunsetColors'

// Kept free of React Native, so that the store, its migrations and the reader can all read it.
const palettes: Record<CurrentTheme, Theme['colors']> = {
  default: defaultColors,
  sepia: sepiaColors,
  nature: natureColors,
  sunset: sunsetColors,
  black: blackColors,
  dark: darkColors,
  mauve: mauveColors,
  night: nightColors,
}

const themes = Object.keys(palettes) as CurrentTheme[]

export const DEFAULT_COLOR_KEYS = ['color1', 'color2', 'color3', 'color4', 'color5'] as const
export type DefaultColorKey = (typeof DEFAULT_COLOR_KEYS)[number]

/**
 * A palette lives in code only, so a change of a theme reaches every reader at once. What the
 * store keeps, per theme, are the default highlight colours the reader has repainted.
 */
export type HighlightColorOverrides = Partial<Record<DefaultColorKey, string>>
export type StoredThemeColors = Partial<Record<CurrentTheme, HighlightColorOverrides>>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Older stores, and accounts synced from them, hold whole palettes: keep the highlights only. */
export const pickHighlightColors = (colors: unknown): HighlightColorOverrides => {
  if (!isRecord(colors)) return {}
  const overrides: HighlightColorOverrides = {}
  for (const key of DEFAULT_COLOR_KEYS) {
    const value = colors[key]
    if (typeof value === 'string' && value) overrides[key] = value
  }
  return overrides
}

export const pickStoredThemeColors = (colors: unknown): StoredThemeColors => {
  if (!isRecord(colors)) return {}
  const stored: StoredThemeColors = {}
  for (const theme of themes) {
    const overrides = pickHighlightColors(colors[theme])
    if (Object.keys(overrides).length) stored[theme] = overrides
  }
  return stored
}

export const getThemePalette = (
  theme: CurrentTheme,
  stored?: StoredThemeColors
): Theme['colors'] => ({
  ...(palettes[theme] ?? palettes.default),
  ...pickHighlightColors(stored?.[theme]),
})

export const getThemePalettes = (stored?: StoredThemeColors) =>
  Object.fromEntries(themes.map(theme => [theme, getThemePalette(theme, stored)])) as Record<
    CurrentTheme,
    Theme['colors']
  >
