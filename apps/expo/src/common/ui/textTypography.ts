import { Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import { resolveFontFamily } from '~themes/styleValues'
import { TRANSLITERATION_FONT } from '~helpers/webFontFamily'

/**
 * A transliteration (ʾĕlōhîm) is set in Literata, which holds its half rings, breves and
 * macrons. The interface face, Pulp Display, lacks them: the system would draw those letters
 * in another face, in the middle of the word. `Text` gives it its web stack.
 */
export const transliterationTextStyle: TextStyle = { fontFamily: TRANSLITERATION_FONT }

const nativeFontStyles = new Map<string, TextStyle>()
const nativeFontStyle = (fontFamily: string): TextStyle => {
  let style = nativeFontStyles.get(fontFamily)
  if (!style) {
    style = { fontFamily }
    nativeFontStyles.set(fontFamily, style)
  }
  return style
}

/**
 * Sets a text in the interface face unless its style names a face of its own. Without an
 * interface face (a text nested in another), the text inherits its parent's face. The web
 * needs the concrete stack even inside a portalled surface.
 */
export const resolveTextTypography = (
  interfaceFont: string | undefined,
  style?: StyleProp<TextStyle>
): StyleProp<TextStyle> => {
  if (Platform.OS !== 'web') return interfaceFont ? [nativeFontStyle(interfaceFont), style] : style
  const font = StyleSheet.flatten(style)?.fontFamily ?? interfaceFont
  return font ? [style, { fontFamily: resolveFontFamily(font) }] : style
}
