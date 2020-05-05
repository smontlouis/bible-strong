import styled from '~styled'
import { bindStyles } from '~helpers/styledProps'
import theme from '~themes/default'

const Text = styled.Text(props => {
  const s = bindStyles(theme)
  return {
    fontFamily: s.fontFamily(props),

    color:
      props.theme.colors[props.color] ||
      props.color ||
      props.theme.colors.default,
    fontSize: props.fontSize,
    fontWeight: props.bold ? 'bold' : undefined,
    textAlign: props.textAlign,

    // container
    position: props.position ?? props.pos,
    top: props.top ?? props.t,
    left: props.left ?? props.l,
    right: props.right ?? props.r,
    bottom: props.bottom ?? props.b,
    padding: props.padding ?? props.p,
    paddingVertical: props.paddingVertical ?? props.py,
    paddingHorizontal: props.paddingHorizontal ?? props.px,
    margin: props.margin ?? props.m,
    marginTop: props.marginTop ?? props.mt,
    marginLeft: props.marginLeft ?? props.ml,
    marginBottom: props.marginRight ?? props.mb,
    marginRight: props.marginRight ?? props.mr,
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
