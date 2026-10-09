import tokens from '../../../../design-system/project/tokens.json'

type ColorValue = string | Record<string, string>
const COLOR_TOKENS = new Map<string, ColorValue>(
  tokens.color.tokens.map(token => [token.name, token.value as ColorValue])
)

/**
 * The light value of a colour of the design system, its aliases followed. A share image has
 * one version, in the light theme, and its renderer reads no CSS variable: every value is
 * resolved here, from the file the design system publishes.
 */
export const shareCardColor = (name: string): string => {
  let current = name
  for (let hop = 0; hop < 8; hop += 1) {
    const value = COLOR_TOKENS.get(current)
    if (value === undefined) break
    const light = typeof value === 'string' ? value : value.light
    const alias = /^\{(.+)\}$/u.exec(light)
    if (!alias) return light
    current = alias[1]
  }
  throw new Error(`SHARE_CARD_COLOR_UNKNOWN: ${name}`)
}

export const SHARE_CARD_COLORS = {
  canvas: shareCardColor('canvas'),
  surface: shareCardColor('surface'),
  ink: shareCardColor('ink'),
  muted: shareCardColor('muted'),
  brand: shareCardColor('brand'),
  accent: shareCardColor('accent'),
  accentSoft: shareCardColor('accent-soft'),
  accentInk: shareCardColor('accent-ink'),
} as const
