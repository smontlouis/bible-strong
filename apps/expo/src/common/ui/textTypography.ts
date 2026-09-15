import { Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import { resolveFontFamily } from '~themes/styleValues'

/** Web needs a concrete interface font even inside a portalled surface. */
export const resolveTextTypography = (
  interfaceFont: string,
  style?: StyleProp<TextStyle>
): StyleProp<TextStyle> => {
  if (Platform.OS !== 'web') return style
  const explicitFont = StyleSheet.flatten(style)?.fontFamily
  return [style, { fontFamily: resolveFontFamily(explicitFont ?? interfaceFont) }]
}
