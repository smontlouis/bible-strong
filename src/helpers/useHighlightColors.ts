import { shallowEqual, useSelector } from 'react-redux'

import type { RootState } from '~redux/modules/reducer'
import type { CustomColor, HighlightType } from '~redux/modules/user'
import { makeColorsSelector } from '~redux/selectors/user'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { resolveHighlightColor } from '~helpers/highlightColors'
import { DEFAULT_COLOR_KEYS, DefaultColorKey } from '~helpers/constants'
import { EMPTY_ARRAY, EMPTY_OBJECT } from '~helpers/emptyReferences'
import type { ColorItem } from '~common/ColorCircleGrid'

type DefaultColorTypes = Partial<Record<DefaultColorKey, HighlightType>>

interface HighlightColorsData {
  colors: Record<string, string>
  customHighlightColors: CustomColor[]
  defaultColorTypes: DefaultColorTypes
}

/**
 * Hook 1: Raw highlight colors data from Redux
 * Returns theme-specific colors, custom colors, and default color types
 */
export function useHighlightColors(): HighlightColorsData {
  const { theme: currentTheme } = useCurrentThemeSelector()
  const selectColors = makeColorsSelector()
  const colors = useSelector((state: RootState) => selectColors(state, currentTheme))

  const customHighlightColors = useSelector(
    (state: RootState) => state.user.bible.settings.customHighlightColors ?? EMPTY_ARRAY,
    shallowEqual
  ) as CustomColor[]

  const defaultColorTypes = useSelector(
    (state: RootState) => state.user.bible.settings.defaultColorTypes ?? EMPTY_OBJECT,
    shallowEqual
  ) as DefaultColorTypes

  return { colors, customHighlightColors, defaultColorTypes }
}

interface UseColorItemsOptions {
  includeTypes?: boolean
}

/**
 * Hook 2: Build ColorItem[] array for ColorCircleGrid component
 * Combines default colors and custom colors into a unified array
 */
export function useColorItems(options?: UseColorItemsOptions): ColorItem[] {
  const { colors, customHighlightColors, defaultColorTypes } = useHighlightColors()

  const defaultColors: ColorItem[] = DEFAULT_COLOR_KEYS.map(colorKey => ({
    key: colorKey,
    hex: colors[colorKey],
    ...(options?.includeTypes && { type: defaultColorTypes[colorKey] || 'background' }),
  }))

  const customColors: ColorItem[] = customHighlightColors.map(c => ({
    key: c.id,
    hex: c.hex,
    ...(options?.includeTypes && { type: c.type || 'background' }),
  }))

  return [...defaultColors, ...customColors]
}

/**
 * Hook 3: Resolve a color ID to its hex value
 * Handles both default colors (color1-5) and custom colors
 */
export function useResolvedColor(colorId: string | undefined): string {
  const { colors, customHighlightColors } = useHighlightColors()
  return resolveHighlightColor(colorId, colors, customHighlightColors)
}
