import styled from '~styled'
import { bindStyles } from '~helpers/styledProps'
import theme from '~themes/default'

const Text = styled.Text(props => {
  const s = bindStyles(theme)
  return {
    fontFamily: s.fontFamily(props),

    color: props.color
      ? props.theme.colors[props.color]
      : props.theme.colors.default,
    fontSize: props.fontSize,
    fontWeight: props.bold ? 'bold' : undefined,
    textAlign: props.textAlign,
    opacity: props.opacity,

    // container
    backgroundColor: props.backgroundColor,
    padding: props.padding,
    paddingLeft: props.paddingLeft,
    paddingRight: props.paddingRight,
    paddingTop: props.paddingTop,
    paddingBottom: props.paddingBottom,
    margin: props.margin,
    marginLeft: props.marginLeft,
    marginRight: props.marginRight,
    marginTop: props.marginTop,
    marginBottom: props.marginBottom,
    borderWidth: props.borderWidth,
    overflow: props.overflow ? 'visible' : 'hidden',
    width: props.width,
    height: props.height,
    // flex props
    flexGrow: props.grow === true ? 1 : props.grow,
    flexShrink: props.shrink || 0,
    flexBasis: props.basis || 'auto',
    flex: props.flex === true ? 1 : props.flex,
    justifyContent: props.justifyContent || (props.center && 'center'),
    alignItems: props.alignItems || (props.center && 'center'),
    alignContent: props.alignContent || 'flex-start',
    alignSelf: props.alignSelf,
    // shorthands
    flexWrap:
      (props.wrap && 'wrap') ||
      (props.wrapReverse && 'wrap-reverse') ||
      'nowrap',
    flexDirection:
      (props.row ? 'row' : 'column') + (props.reverse ? '-reverse' : ''),

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
