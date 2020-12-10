import React from 'react'
import styled from '@emotion/native'
import { RootState } from '~redux/modules/reducer'

import Text from './Text'
import { useSelector } from 'react-redux'

const scaleFontSize = (value, scale, scaleLineHeight = 0) => {
  return Math.round(value + scale * 0.1 * value + scaleLineHeight * 0.1 * value)
} // Scale

const P = styled(Text)(
  ({ small, theme, scale = 0, scaleLineHeight = 0, fontFamily }) => ({
    fontFamily: theme.fontFamily[fontFamily] || theme.fontFamily.paragraph,
    fontSize: small ? 14 : scaleFontSize(19, scale),
    lineHeight: small ? 22 : scaleFontSize(29, scale, scaleLineHeight),
  })
)

const Paragraph = ({
  small,
  scale = 0,
  scaleLineHeight = 0,
  fontFamily,
  children,
  ...props
}: any) => {
  const fontSizeScale = useSelector(
    (state: RootState) => state.user.bible.settings.fontSizeScale
  )

  return (
    <P
      {...{
        small,
        scale: scale + fontSizeScale,
        scaleLineHeight,
        fontFamily,
        children,
      }}
      {...props}
      selectable
    />
  )
}

export default Paragraph
