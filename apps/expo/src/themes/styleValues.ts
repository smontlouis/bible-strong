import { Platform } from 'react-native'
import { webFontFamily } from '~helpers/webFontFamily'
export { resolveThemeColor, colorWithOpacity } from './colorValues'

export const resolveFontFamily = (font?: string): string | undefined =>
  font === undefined ? undefined : Platform.OS === 'web' ? webFontFamily(font) : font
