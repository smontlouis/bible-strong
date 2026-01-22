import { shallowEqual, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import type { RootState } from '~redux/modules/reducer'
import type { CustomColor } from '~redux/modules/user'
import { useHighlightColors } from './useHighlightColors'
import { EMPTY_OBJECT } from './emptyReferences'

/**
 * Hook to get the display name and hex color for a given color ID
 * Works with both default colors (color1-5) and custom colors
 */
export function useColorInfo(colorId?: string): { name: string; hex: string } | undefined {
  const { t } = useTranslation()
  const { colors: themeColors, customHighlightColors } = useHighlightColors()

  const defaultColorNames = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorNames ?? EMPTY_OBJECT,
    shallowEqual
  )

  if (!colorId) return undefined

  // Default color (color1, color2, etc.)
  if (colorId.startsWith('color')) {
    const colorNumber = colorId.slice(-1)
    const nameValue = defaultColorNames[colorId as keyof typeof defaultColorNames]
    // Defensive check: ensure name is a string (protect against corrupted data like {_type: 'delete'})
    const name = typeof nameValue === 'string' ? nameValue : `${t('Couleur')} ${colorNumber}`
    const hex = themeColors[colorId as keyof typeof themeColors]
    return { name, hex }
  }

  // Custom color
  const customColor = customHighlightColors.find((c: CustomColor) => c.id === colorId)
  if (customColor) {
    // Defensive check: ensure name is a string (protect against corrupted data)
    const name: string =
      typeof customColor.name === 'string' ? customColor.name : t('Couleur personnalisée')
    const hex: string = customColor.hex
    return { name, hex }
  }

  return undefined
}

export interface ColorInfo {
  id: string
  name: string
  hex: string
  hasCustomName: boolean
}

/**
 * Hook to get all available colors (default + custom)
 * Returns hasCustomName to indicate if the color has a user-defined name
 */
export function useAllColors(): ColorInfo[] {
  const { t } = useTranslation()
  const { colors: themeColors, customHighlightColors } = useHighlightColors()

  const defaultColorNames = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorNames ?? EMPTY_OBJECT,
    shallowEqual
  )

  const colors: ColorInfo[] = []

  // Add default colors
  for (let i = 1; i <= 5; i++) {
    const colorKey = `color${i}` as keyof typeof themeColors
    const nameValue = defaultColorNames[colorKey as keyof typeof defaultColorNames]
    const hasCustomName = typeof nameValue === 'string' && nameValue.length > 0
    colors.push({
      id: `color${i}`,
      // Defensive check: ensure name is a string (protect against corrupted data like {_type: 'delete'})
      name: hasCustomName ? nameValue : `${t('Couleur')} ${i}`,
      hex: themeColors[colorKey] as string,
      hasCustomName,
    })
  }

  // Add custom colors
  customHighlightColors.forEach((color: CustomColor, index: number) => {
    // Defensive check: ensure name is a string (protect against corrupted data)
    const hasCustomName = typeof color.name === 'string' && color.name.length > 0
    colors.push({
      id: color.id,
      name: hasCustomName ? (color.name as string) : `${t('Couleur personnalisée')} ${index + 1}`,
      hex: color.hex,
      hasCustomName,
    })
  })

  return colors
}
