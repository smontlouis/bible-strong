import { Platform } from 'react-native'
import { webFontFamily } from '~helpers/webFontFamily'
export { resolveThemeColor, colorWithOpacity } from './colorValues'

export const resolveFontFamily = (font?: string): string | undefined =>
  font === undefined ? undefined : Platform.OS === 'web' ? webFontFamily(font) : font

/**
 * The title face of the app is the interface face, Pulp Display, at bold weight. A title in
 * Literata takes its own style instead of overriding this one: the app ships a single upright
 * regular Literata face, which iOS draws as is whatever weight or style is asked.
 */
export const titleFontStyle = (theme: { fontFamily: { title: string } }) => ({
  fontFamily: resolveFontFamily(theme.fontFamily.title),
  fontWeight: '700' as const,
})
