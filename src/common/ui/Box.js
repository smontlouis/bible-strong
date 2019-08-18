import styled from '@emotion/native'

const Box = styled.View(props => ({
  // container
  padding: props.padding,
  margin: props.margin,
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
  flexWrap: (props.wrap && 'wrap') || (props.wrapReverse && 'wrap-reverse') || 'nowrap',
  flexDirection: (props.row ? 'row' : 'column') + (props.reverse ? '-reverse' : ''),

  opacity: props.disabled ? 0.3 : 1
}))

export default Box
