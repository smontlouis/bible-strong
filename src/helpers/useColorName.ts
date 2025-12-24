import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import type { RootState } from '~redux/modules/reducer'
import type { CustomColor } from '~redux/modules/user'
import { makeColorsSelector } from '~redux/selectors/user'
import useCurrentThemeSelector from './useCurrentThemeSelector'

// Define empty defaults outside component to maintain reference stability
// This prevents Redux selector warnings about returning different references
const EMPTY_COLOR_NAMES = {} as Record<string, string>
const EMPTY_CUSTOM_COLORS = [] as CustomColor[]

/**
 * Hook to get the display name and hex color for a given color ID
 * Works with both default colors (color1-5) and custom colors
 */
export function useColorInfo(colorId?: string): { name: string; hex: string } | undefined {
  const { t } = useTranslation()
  const { theme: currentTheme } = useCurrentThemeSelector()
  const selectColors = useMemo(() => makeColorsSelector(), [])
  const themeColors = useSelector((state: RootState) => selectColors(state, currentTheme))

  const defaultColorNames = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorNames ?? EMPTY_COLOR_NAMES
  )
  const customHighlightColors = useSelector(
    (state: RootState) => state.user.bible.settings.customHighlightColors ?? EMPTY_CUSTOM_COLORS
  )

  if (!colorId) return undefined

  // Default color (color1, color2, etc.)
  if (colorId.startsWith('color')) {
    const colorNumber = colorId.slice(-1)
    const name =
      defaultColorNames[colorId as keyof typeof defaultColorNames] ||
      `${t('Couleur')} ${colorNumber}`
    const hex = themeColors[colorId as keyof typeof themeColors]
    return { name, hex }
  }

  // Custom color
  const customColor = customHighlightColors.find((c: CustomColor) => c.id === colorId)
  if (customColor) {
    const name: string = customColor.name || t('Couleur personnalisée')
    const hex: string = customColor.hex
    return { name, hex }
  }

  return undefined
}

/**
 * Hook to get all available colors (default + custom)
 */
export function useAllColors(): { id: string; name: string; hex: string }[] {
  const { t } = useTranslation()
  const { theme: currentTheme } = useCurrentThemeSelector()
  const selectColors = useMemo(() => makeColorsSelector(), [])
  const themeColors = useSelector((state: RootState) => selectColors(state, currentTheme))

  const defaultColorNames = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorNames ?? EMPTY_COLOR_NAMES
  )
  const customHighlightColors = useSelector(
    (state: RootState) => state.user.bible.settings.customHighlightColors ?? EMPTY_CUSTOM_COLORS
  )

  return useMemo(() => {
    const colors: { id: string; name: string; hex: string }[] = []

    // Add default colors
    for (let i = 1; i <= 5; i++) {
      const colorKey = `color${i}` as keyof typeof themeColors
      colors.push({
        id: `color${i}`,
        name:
          defaultColorNames[colorKey as keyof typeof defaultColorNames] || `${t('Couleur')} ${i}`,
        hex: themeColors[colorKey] as string,
      })
    }

    // Add custom colors
    customHighlightColors.forEach((color: CustomColor, index: number) => {
      colors.push({
        id: color.id,
        name: color.name || `${t('Couleur personnalisée')} ${index + 1}`,
        hex: color.hex,
      })
    })

    return colors
  }, [themeColors, defaultColorNames, customHighlightColors, t])
}
