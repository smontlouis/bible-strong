import Color from 'color'
import type { Theme } from './index'

/** Resolve a palette token or retain a user-supplied CSS/native color. */
export const resolveThemeColor = (
  theme: Pick<Theme, 'colors'>,
  color?: string
): string | undefined =>
  color === undefined ? undefined : (theme.colors[color as keyof Theme['colors']] ?? color)

/** Alpha replaces the source alpha, matching existing highlight and surface colors. */
export const colorWithOpacity = (color?: string, opacity?: number): string | undefined => {
  if (!color || color === 'transparent' || opacity === undefined) return color
  try {
    return Color(color).alpha(opacity).rgb().string()
  } catch {
    return color
  }
}
