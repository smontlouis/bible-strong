import type { MixedStyleDeclaration } from '@native-html/render'
import type { TextStyle } from 'react-native'

import { scaleFontSize } from '~features/bible/BibleDOM/scaleFontSize'
import { scaleLineHeight } from '~features/bible/BibleDOM/scaleLineHeight'
import type { Theme } from '~themes'

export type StrongReadingTypography = {
  fontFamily?: string
  fontSizeScale: number
  lineHeight: 'small' | 'normal' | 'large'
}

export const getScaledStrongTextStyle = (
  baseFontSize: number,
  baseLineHeight: number,
  typography: StrongReadingTypography
): TextStyle => ({
  fontFamily: typography.fontFamily,
  fontSize: Number.parseFloat(scaleFontSize(baseFontSize, typography.fontSizeScale)),
  lineHeight: Number.parseFloat(
    scaleLineHeight(baseLineHeight, typography.lineHeight, typography.fontSizeScale)
  ),
})

export const getStrongEditorialHtmlStyles = (
  theme: Theme,
  typography: StrongReadingTypography
): Record<string, MixedStyleDeclaration> => {
  const typographyStyle: MixedStyleDeclaration = {
    fontFamily: typography.fontFamily,
    fontSize: Number.parseFloat(scaleFontSize(18, typography.fontSizeScale)),
    lineHeight: Number.parseFloat(
      scaleLineHeight(28, typography.lineHeight, typography.fontSizeScale)
    ),
  }
  const defaultTextStyle: MixedStyleDeclaration = {
    ...typographyStyle,
    color: theme.colors.default,
  }

  return {
    p: defaultTextStyle,
    b: { ...typographyStyle, fontWeight: 'bold' },
    strong: { ...typographyStyle, fontWeight: 'bold' },
    em: { ...typographyStyle, color: theme.colors.quart, fontStyle: 'italic' },
    i: { ...typographyStyle, color: theme.colors.quart, fontStyle: 'italic' },
    a: { ...typographyStyle, color: theme.colors.primary },
    li: defaultTextStyle,
    ol: defaultTextStyle,
    ul: defaultTextStyle,
    h1: { ...defaultTextStyle, fontWeight: 'bold' },
    h2: { ...defaultTextStyle, fontWeight: 'bold' },
    h3: { ...defaultTextStyle, fontWeight: 'bold' },
  }
}
