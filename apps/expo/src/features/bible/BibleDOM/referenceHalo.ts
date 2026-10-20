// surface-allow: the halo of a reference set in the text, the design system's shadow-reference
import { isDarkTheme } from './utils'

/**
 * The halo of a reference set in the text: `shadow-reference` in design-system/project/tokens.json,
 * the only shadow of the reading pages. Spread into the style of a chip set in a verse.
 */
export const referenceHalo = (theme: string) => ({
  boxShadow: isDarkTheme(theme)
    ? '0 0 10px 0 rgba(255, 255, 255, 0.12)'
    : '0 0 10px 0 rgba(0, 0, 0, 0.16)',
})
