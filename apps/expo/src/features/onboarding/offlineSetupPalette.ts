import Color from 'color'

import type { Theme } from '~themes/index'
import type { OfflineSetupFolderVisual } from './offlineSetupPresentation'

export type OfflineSetupColorScheme = 'light' | 'dark'

export type OfflineSetupPalette = {
  canvas: string
  title: string
  description: string
  itemSurface: string
  itemBorder: string
  sheetSurface: string
  sheetSurfaceTransparent: string
  sheetRaised: string
  accent: string
  itemAccentText: string
  itemAccentSoft: string
  sheetAccentSoft: string
  ambientAccentSoft: string
  accentShadow: string
  accentLight: string
  onSheet: string
  onSheetMuted: string
  onAccent: string
  handle: string
  divider: string
  overlay: string
}

const WHITE = Color('#FFFFFF')
const DARK_INK = Color('#09111D')

const toRgb = (color: Color): string => color.rgb().string()
const withAlpha = (color: Color, alpha: number): string => color.alpha(alpha).rgb().string()

const readableForeground = (background: Color): Color =>
  WHITE.contrast(background) >= DARK_INK.contrast(background) ? WHITE : DARK_INK

const ensureContrast = (color: Color, background: Color, ratio = 4.5): Color => {
  if (color.contrast(background) >= ratio) return color

  const endpoint = readableForeground(background)
  for (let amount = 0.1; amount <= 1; amount += 0.1) {
    const candidate = color.mix(endpoint, amount)
    if (candidate.contrast(background) >= ratio) return candidate
  }

  return endpoint
}

const darkenForWhiteText = (color: Color, ratio = 3): Color => {
  if (WHITE.contrast(color) >= ratio) return color

  for (let amount = 0.1; amount <= 1; amount += 0.1) {
    const candidate = color.mix(DARK_INK, amount)
    if (WHITE.contrast(candidate) >= ratio) return candidate
  }

  return DARK_INK
}

const createSharedPalette = ({
  accent,
  canvas,
  colorScheme,
  itemSurface,
  sheetSurface,
  titleSeed,
}: {
  accent: Color
  canvas: Color
  colorScheme: OfflineSetupColorScheme
  itemSurface: Color
  sheetSurface: Color
  titleSeed: Color
}): OfflineSetupPalette => {
  const isDark = colorScheme === 'dark'
  const buttonAccent = darkenForWhiteText(accent)
  const onSheet = readableForeground(sheetSurface)
  const onAccent = WHITE
  const title = ensureContrast(titleSeed, canvas)
  const descriptionSeed = titleSeed.mix(Color(isDark ? '#FFFFFF' : '#283548'), 0.3)
  const description = ensureContrast(descriptionSeed, canvas)
  const sheetRaised = sheetSurface.mix(onSheet, isDark ? 0.12 : 0.1)
  const accentLight = ensureContrast(buttonAccent.mix(onSheet, 0.34), sheetSurface, 3)
  const onSheetMuted = ensureContrast(onSheet.mix(sheetSurface, 0.3), sheetSurface)
  const itemAccentSoft = itemSurface.mix(buttonAccent, isDark ? 0.24 : 0.17)

  return {
    canvas: toRgb(canvas),
    title: toRgb(title),
    description: toRgb(description),
    itemSurface: toRgb(itemSurface),
    itemBorder: toRgb(itemSurface.mix(buttonAccent, isDark ? 0.34 : 0.28)),
    sheetSurface: toRgb(sheetSurface),
    sheetSurfaceTransparent: withAlpha(sheetSurface, 0),
    sheetRaised: toRgb(sheetRaised),
    accent: toRgb(buttonAccent),
    itemAccentText: toRgb(ensureContrast(buttonAccent, itemAccentSoft, 4.6)),
    itemAccentSoft: toRgb(itemAccentSoft),
    sheetAccentSoft: withAlpha(accentLight, 0.2),
    ambientAccentSoft: withAlpha(buttonAccent, 0.08),
    accentShadow: withAlpha(buttonAccent, 0.28),
    accentLight: toRgb(accentLight),
    onSheet: toRgb(onSheet),
    onSheetMuted: toRgb(onSheetMuted),
    onAccent: toRgb(onAccent),
    handle: withAlpha(onSheet, 0.56),
    divider: withAlpha(onSheet, 0.24),
    overlay: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(9,17,29,0.68)',
  }
}

export const getOfflineSetupOverviewPalette = (
  theme: Theme,
  colorScheme: OfflineSetupColorScheme
): OfflineSetupPalette => {
  const isDark = colorScheme === 'dark'
  const primary = Color(theme.colors.primary)
  const sheetSurface = primary.mix(DARK_INK, isDark ? 0.68 : 0.62)
  const accent = isDark ? primary.mix(WHITE, 0.2) : primary
  const canvas = Color(theme.colors.lightGrey)
  const itemSurface = Color(theme.colors.reverse)

  return createSharedPalette({
    accent,
    canvas,
    colorScheme,
    itemSurface,
    sheetSurface,
    titleSeed: Color(theme.colors.default),
  })
}

export const getOfflineSetupFolderPalette = (
  visual: OfflineSetupFolderVisual,
  theme: Theme,
  colorScheme: OfflineSetupColorScheme
): OfflineSetupPalette => {
  const isDark = colorScheme === 'dark'
  const seed = Color(visual.colors.frontEnd)
  const canvasBase = Color(theme.colors.lightGrey)
  const itemBase = Color(theme.colors.reverse)
  const canvas = canvasBase.mix(seed, isDark ? 0.14 : 0.04)
  const itemSurface = itemBase.mix(seed, isDark ? 0.13 : 0.055)
  const sheetSurface = seed.mix(DARK_INK, isDark ? 0.68 : 0.62)
  const titleSeed = isDark ? seed.mix(WHITE, 0.48) : seed.mix(DARK_INK, 0.42)
  const accent = isDark ? seed.mix(WHITE, 0.2) : seed

  return createSharedPalette({
    accent,
    canvas,
    colorScheme,
    itemSurface,
    sheetSurface,
    titleSeed,
  })
}
