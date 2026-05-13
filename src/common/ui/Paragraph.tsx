import React from 'react'
import styled from '@emotion/native'
import { RootState } from '~redux/modules/reducer'

import Text, { TextProps } from './Text'
import { useSelector } from 'react-redux'

const scaleFontSize = (value: number, scale: number, scaleLineHeight: number = 0) => {
  return Math.round(value + scale * 0.1 * value + scaleLineHeight * 0.1 * value)
} // Scale

type ParagraphStyleProps = {
  small?: boolean
  scale?: number
  scaleLineHeight?: number
  fontFamily?: keyof typeof import('~themes').baseTheme.fontFamily
  medium?: boolean
  size?: string | number
}

const P = styled(Text)<ParagraphStyleProps>(
  ({ small, theme, scale = 0, scaleLineHeight = 0, fontFamily }) => ({
    fontFamily: fontFamily ? theme.fontFamily[fontFamily] : theme.fontFamily.paragraph,
    fontSize: small ? 14 : scaleFontSize(19, scale),
    lineHeight: small ? 22 : scaleFontSize(29, scale, scaleLineHeight),
  })
)

type ParagraphProps = Omit<TextProps, 'size'> & ParagraphStyleProps

const Paragraph = ({
  small,
  scale = 0,
  scaleLineHeight = 0,
  fontFamily,
  medium: _medium,
  size: _size,
  children,
  ...props
}: ParagraphProps) => {
  const fontSizeScale = useSelector((state: RootState) => state.user.bible.settings.fontSizeScale)

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
