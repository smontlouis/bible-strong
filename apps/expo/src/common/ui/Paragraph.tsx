import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import type { Theme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'
import Text, { type TextProps } from './Text'

const scaleFontSize = (value: number, scale: number, lineHeightScale = 0) =>
  Math.round(value + scale * 0.1 * value + lineHeightScale * 0.1 * value)

type ParagraphProps = TextProps & {
  small?: boolean
  scale?: number
  scaleLineHeight?: number
  fontFamily?: keyof Theme['fontFamily']
}

const Paragraph = ({
  small,
  scale = 0,
  scaleLineHeight = 0,
  fontFamily,
  style,
  ...props
}: ParagraphProps) => {
  const theme = useTheme()
  const fontSizeScale = useSelector((state: RootState) => state.user.bible.settings.fontSizeScale)
  return (
    <Text
      {...props}
      selectable={props.selectable ?? true}
      style={[
        {
          fontFamily: fontFamily ? theme.fontFamily[fontFamily] : theme.fontFamily.paragraph,
          fontSize: small ? 14 : scaleFontSize(19, scale + fontSizeScale),
          lineHeight: small ? 22 : scaleFontSize(29, scale + fontSizeScale, scaleLineHeight),
        },
        style,
      ]}
    />
  )
}

export default Paragraph
