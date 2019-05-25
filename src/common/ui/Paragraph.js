import styled from '@emotion/native'

import Text from './Text'

const scaleFontSize = (value, scale, scaleLineHeight = 0) => {
  return Math.round(value + (scale * 0.1 * value) + (scaleLineHeight * 0.1 * value))
} // Scale

const Paragraph = styled(Text)(({ small, color, theme, scale = 0, scaleLineHeight = 0 }) => ({
  fontFamily: 'literata-book',
  fontSize: small ? 14 : scaleFontSize(20, scale),
  lineHeight: small ? 22 : scaleFontSize(34, scale, scaleLineHeight)
}))

export default Paragraph
