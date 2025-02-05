import { bindStyles } from '~helpers/styledProps'
import styled from '@emotion/native'
import { Theme } from '~themes'
import { TextProps as BaseTextProps } from 'react-native'

export interface TextProps extends BaseTextProps {
  children?: React.ReactNode
  color?: string
  lineHeight?: number
  fontSize?: number
  bold?: boolean
  textAlign?: string
  fontWeight?: string
  position?: 'absolute' | 'relative'
  pos?: 'absolute' | 'relative'
  top?: number
  t?: number
  left?: number
  l?: number
  right?: number
  r?: number
  bottom?: number
  b?: number

  padding?: number
  p?: number
  paddingTop?: number
  pt?: number
  paddingLeft?: number
  pl?: number
  paddingRight?: number
  pr?: number
  paddingBottom?: number
  pb?: number
  paddingVertical?: number
  py?: number
  paddingHorizontal?: number
  px?: number

  margin?: number
  m?: number
  marginTop?: number
  mt?: number
  marginLeft?: number
  ml?: number
  marginRight?: number
  mr?: number
  marginBottom?: number
  mb?: number
  marginVertical?: number
  my?: number
  marginHorizontal?: number
  mx?: number

  absoluteFill?: boolean

  borderWidth?: number
  borderColor?: string
  transform?: object
  borderRadius?: number
  borderTopLeftRadius?: number
  borderTopRightRadius?: number
  borderBottomLeftRadius?: number
  borderBottomRightRadius?: number

  overflow?: 'visible' | 'hidden'
  width?: number
  w?: number
  maxWidth?: number
  maxW?: number
  minWidth?: number
  minW?: number
  minHeight?: number
  minH?: number
  height?: number
  h?: number

  grow?: boolean
  shrink?: number
  basis?: number
  flex?: boolean | number
  justifyContent?: string
  center?: boolean
  alignItems?: string
  alignContent?: string
  alignSelf?: string
  wrap?: boolean
  wrapReverse?: boolean
  row?: boolean
  reverse?: boolean
  disabled?: boolean
  opacity?: number

  backgroundColor?: string
  bg?: string

  grey?: boolean
  background?: boolean
  rounded?: boolean
  shadow?: boolean
  lightShadow?: boolean
  size?: string

  theme?: Theme

  title?: boolean
  text?: boolean
  textTransform?: string
}

const Text = styled.Text((props: TextProps) => {
  const s = bindStyles(props.theme)
  return {
    fontFamily: s.fontFamily(props),

    color:
      props.theme.colors[props.color] ||
      props.color ||
      props.theme.colors.default,
    lineHeight: props.lineHeight,
    fontSize: props.fontSize || 16,
    fontWeight: props.fontWeight ?? (props.bold ? 'bold' : undefined),
    textAlign: props.textAlign,

    textTransform: props.textTransform,
    padding: props.padding ?? props.p,
    paddingTop: props.paddingTop ?? props.pt,
    paddingLeft: props.paddingLeft ?? props.pl,
    paddingRight: props.paddingRight ?? props.pr,
    paddingBottom: props.paddingBottom ?? props.pb,
    paddingVertical: props.paddingVertical ?? props.py,
    paddingHorizontal: props.paddingHorizontal ?? props.px,

    margin: props.margin ?? props.m,
    marginTop: props.marginTop ?? props.mt,
    marginLeft: props.marginLeft ?? props.ml,
    marginBottom: props.marginBottom ?? props.mb,
    marginRight: props.marginRight ?? props.mr,
    marginVertical: props.marginVertical ?? props.my,
    marginHorizontal: props.marginHorizontal ?? props.mx,

    // container
    position: props.position ?? props.pos,
    top: props.top ?? props.t,
    left: props.left ?? props.l,
    right: props.right ?? props.r,
    bottom: props.bottom ?? props.b,
    borderWidth: props.borderWidth,
    borderColor: props.theme.colors[props.borderColor] ?? props.borderColor,
    transform: props.transform,

    overflow: props.overflow ? 'visible' : 'hidden',
    width: props.width ?? props.w,
    maxWidth: props.maxWidth ?? props.maxW,
    minWidth: props.minWidth ?? props.minW,
    minHeight: props.minHeight ?? props.minH,
    height: props.height ?? props.h,
    // flex props
    flexGrow: props.grow === true ? 1 : props.grow,
    flexShrink: props.shrink ?? 0,
    flexBasis: props.basis ?? 'auto',
    flex: props.flex === true ? 1 : props.flex,
    justifyContent: props.justifyContent ?? (props.center && 'center'),
    alignItems: props.alignItems ?? (props.center && 'center'),
    alignContent: props.alignContent ?? 'flex-start',
    alignSelf: props.alignSelf,
    // shorthands
    flexWrap:
      (props.wrap && 'wrap') ??
      (props.wrapReverse && 'wrap-reverse') ??
      'nowrap',
    flexDirection:
      (props.row ? 'row' : 'column') + (props.reverse ? '-reverse' : ''),

    opacity: props.disabled ? 0.3 : props.opacity ?? 1,

    backgroundColor: props.theme.colors[props.backgroundColor ?? props.bg]
      ? props.theme.colors[props.backgroundColor ?? props.bg]
      : props.backgroundColor ?? props.bg,

    ...(props.underline && {
      textDecorationLine: 'underline',
      textDecorationStyle: 'solid',
      textDecorationColor: props.theme.colors.default,
    }),
  }
})

Text.defaultProps = {
  fontFamily: 'text',
  colors: 'default',
}

export default Text
