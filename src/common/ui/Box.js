import styled from '@emotion/native'
import { withTheme } from 'emotion-theming'

const Box = styled.View(props => ({
  // container
  position: props.position,
  padding: props.padding,
  paddingVertical: props.paddingVertical,
  paddingHorizontal: props.paddingHorizontal,
  margin: props.margin,
  borderWidth: props.borderWidth,
  overflow: props.overflow ? 'visible' : 'hidden',
  width: props.width,
  maxWidth: props.maxWidth,
  minWidth: props.minWidth,
  minHeight: props.minHeight,
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

  opacity: props.disabled ? 0.3 : 1,

  ...(props.grey && {
    backgroundColor: props.theme.colors.lightGrey
  }),

  ...(props.background && {
    backgroundColor: props.theme.colors.reverse
  }),

  ...(props.rounded && {
    borderRadius: 10
  }),

  ...(props.shadow && {
    backgroundColor: props.theme.colors.reverse,
    shadowColor: props.theme.colors.default,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
    borderRadius: 5,
    overflow: 'visible'
  })
}))

export default withTheme(Box)
