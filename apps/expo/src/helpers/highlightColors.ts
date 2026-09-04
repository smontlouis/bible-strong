import { CustomColor } from '~redux/modules/user'

export const TRANSPARENT_COLOR = 'rgba(0, 0, 0, 0.1)'

type ThemeColors = {
  color1?: string
  color2?: string
  color3?: string
  color4?: string
  color5?: string
  [key: string]: string | undefined
}

/**
 * Resolves a color ID to its hex value.
 * - For default colors (color1-color5): returns the theme-specific color
 * - For custom colors: returns the stored hex value
 * - Returns transparent if the color was deleted or not found
 */
export function resolveHighlightColor(
  colorId: string | undefined,
  themeColors: ThemeColors,
  customColors: CustomColor[]
): string {
  if (!colorId) return TRANSPARENT_COLOR

  // Default colors (color1-color5)
  if (colorId.startsWith('color')) {
    return themeColors[colorId] || TRANSPARENT_COLOR
  }

  // Custom colors
  const customColor = customColors.find(c => c.id === colorId)
  return customColor?.hex || TRANSPARENT_COLOR
}

/**
 * Checks if a highlight color still exists
 */
export function isColorValid(colorId: string, customColors: CustomColor[]): boolean {
  // Default colors are always valid
  if (colorId.startsWith('color')) {
    return true
  }

  // Check if custom color exists
  return customColors.some(c => c.id === colorId)
}
