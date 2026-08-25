import Color from 'color'

type ThemeColors = Record<string, string>

export const BOX_BACKGROUND_OPACITIES = {
  '005': 0.05,
  '010': 0.1,
  '020': 0.2,
  '030': 0.3,
  '050': 0.5,
} as const

export type BoxBackgroundOpacity = keyof typeof BOX_BACKGROUND_OPACITIES

type ResolveBoxBackgroundColorOptions = {
  backgroundColor?: string
  bg?: string
  bgOpacity?: BoxBackgroundOpacity
  background?: boolean
  colors: ThemeColors
}

export const resolveBoxBackgroundColor = ({
  backgroundColor,
  bg,
  bgOpacity,
  background,
  colors,
}: ResolveBoxBackgroundColorOptions): string | undefined => {
  const colorValue = background ? 'reverse' : (backgroundColor ?? bg)
  if (!colorValue) return undefined

  const resolvedColor = colors[colorValue] ?? colorValue
  if (bgOpacity === undefined || resolvedColor === 'transparent') {
    return resolvedColor
  }

  const alpha = BOX_BACKGROUND_OPACITIES[bgOpacity]

  try {
    return Color(resolvedColor).alpha(alpha).rgb().string()
  } catch {
    return resolvedColor
  }
}
