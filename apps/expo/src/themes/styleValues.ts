import { Platform } from 'react-native'
import { webFontFamily } from '~helpers/webFontFamily'
export { resolveThemeColor, colorWithOpacity } from './colorValues'

export const resolveFontFamily = (font?: string): string | undefined =>
  font === undefined ? undefined : Platform.OS === 'web' ? webFontFamily(font) : font

/**
 * The title face of the app is the platform's own sans at bold weight (San Francisco on iOS,
 * Roboto on Android, the system stack on the web): no font file ships for it.
 */
export const titleFontStyle = (theme: { fontFamily: { title: string } }) => ({
  fontFamily: resolveFontFamily(theme.fontFamily.title),
  fontWeight: '700' as const,
})
