import styled from '@emotion/native'

import Text from './Text'

const scaleFontSize = (value, scale, scaleLineHeight = 0) => {
  return Math.round(value + scale * 0.1 * value + scaleLineHeight * 0.1 * value)
} // Scale

const Paragraph = styled(Text)(
  ({ small, theme, scale = 0, scaleLineHeight = 0 }) => ({
    fontFamily: theme.fontFamily.paragraph,
    fontSize: small ? 14 : scaleFontSize(19, scale),
    lineHeight: small ? 22 : scaleFontSize(29, scale, scaleLineHeight)
  })
)

export default Paragraph
