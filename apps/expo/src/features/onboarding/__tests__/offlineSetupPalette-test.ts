import Color from 'color'

import blackColors from '~themes/blackColors'
import colors from '~themes/colors'
import darkColors from '~themes/darkColors'
import mauveColors from '~themes/mauveColors'
import natureColors from '~themes/natureColors'
import nightColors from '~themes/nightColors'
import sepiaColors from '~themes/sepiaColors'
import sunsetColors from '~themes/sunsetColors'
import type { Theme } from '~themes/index'
import {
  getOfflineSetupFolderPalette,
  getOfflineSetupOverviewPalette,
} from '../offlineSetupPalette'
import { OFFLINE_SETUP_FOLDER_PRESENTATIONS } from '../offlineSetupPresentation'

const THEMES = {
  default: { colors },
  sepia: { colors: sepiaColors },
  nature: { colors: natureColors },
  sunset: { colors: sunsetColors },
  black: { colors: blackColors },
  dark: { colors: darkColors },
  mauve: { colors: mauveColors },
  night: { colors: nightColors },
} as unknown as Record<string, Theme>

const THEME_NAMES = Object.keys(THEMES)
const getColorScheme = (themeName: string) =>
  ['default', 'sepia', 'nature', 'sunset'].includes(themeName) ? 'light' : 'dark'

describe('offline setup palettes', () => {
  it.each(THEME_NAMES)('creates a dark primary-tinted overview sheet for %s', themeName => {
    const theme = THEMES[themeName]
    const colorScheme = getColorScheme(themeName)
    const palette = getOfflineSetupOverviewPalette(theme, colorScheme)

    expect(Color(palette.sheetSurface).isDark()).toBe(true)
    expect(Color(palette.onSheet).hex()).toBe('#FFFFFF')
    expect(Color(palette.sheetSurface).hex()).not.toBe(Color(theme.colors.primary).hex())
    expect(Color(palette.onSheet).contrast(Color(palette.sheetSurface))).toBeGreaterThanOrEqual(4.5)
    expect(
      Color(palette.onSheetMuted).contrast(Color(palette.sheetSurface))
    ).toBeGreaterThanOrEqual(4.5)
    expect(Color(palette.onAccent).hex()).toBe('#FFFFFF')
    expect(Color(palette.onAccent).contrast(Color(palette.accent))).toBeGreaterThanOrEqual(3)
  })

  it.each(THEME_NAMES)('creates readable folder palettes for the %s theme', themeName => {
    const theme = THEMES[themeName]
    const colorScheme = getColorScheme(themeName)

    for (const visual of OFFLINE_SETUP_FOLDER_PRESENTATIONS) {
      const palette = getOfflineSetupFolderPalette(visual, theme, colorScheme)

      expect(Color(palette.title).contrast(Color(palette.canvas))).toBeGreaterThanOrEqual(4.5)
      expect(Color(palette.description).contrast(Color(palette.canvas))).toBeGreaterThanOrEqual(4.5)
      expect(Color(palette.title).contrast(Color(palette.itemSurface))).toBeGreaterThanOrEqual(4.5)
      expect(
        Color(palette.description).contrast(Color(palette.itemSurface))
      ).toBeGreaterThanOrEqual(4.5)
      expect(Color(palette.onSheet).contrast(Color(palette.sheetSurface))).toBeGreaterThanOrEqual(
        4.5
      )
      expect(
        Color(palette.onSheetMuted).contrast(Color(palette.sheetSurface))
      ).toBeGreaterThanOrEqual(4.5)
      expect(Color(palette.onAccent).hex()).toBe('#FFFFFF')
      expect(Color(palette.onAccent).contrast(Color(palette.accent))).toBeGreaterThanOrEqual(3)
      expect(
        Color(palette.itemAccentText).contrast(Color(palette.itemAccentSoft))
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps each folder accent distinct', () => {
    const accents = OFFLINE_SETUP_FOLDER_PRESENTATIONS.map(visual =>
      Color(getOfflineSetupFolderPalette(visual, THEMES.default, 'light').accent).hex()
    )

    expect(new Set(accents).size).toBe(OFFLINE_SETUP_FOLDER_PRESENTATIONS.length)
  })

  it('adapts a folder palette to light and dark contexts', () => {
    const visual = OFFLINE_SETUP_FOLDER_PRESENTATIONS[0]
    const light = getOfflineSetupFolderPalette(visual, THEMES.default, 'light')
    const dark = getOfflineSetupFolderPalette(visual, THEMES.dark, 'dark')

    expect(Color(light.canvas).hex()).not.toBe(Color(dark.canvas).hex())
    expect(Color(light.itemSurface).hex()).not.toBe(Color(dark.itemSurface).hex())
  })
})
