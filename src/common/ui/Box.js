import styled from '@emotion/native'
import Animated from 'react-native-reanimated'

const Box = styled.View(props => {
  return {
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

    ...(props.grey && {
      backgroundColor: props.theme.colors.lightGrey,
    }),

    ...(props.background && {
      backgroundColor: props.theme.colors.reverse,
    }),

    ...(props.rounded && {
      borderRadius: 10,
    }),

    ...(props.shadow && {
      backgroundColor: props.theme.colors.reverse,
      shadowColor: props.theme.colors.default,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 2,
      borderRadius: 5,
      overflow: 'visible',
    }),

    ...(props.size && {
      width: props.size,
      height: props.size,
    }),

    ...(props.absoluteFill && {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      top: 0,
    }),

    ...(props.lightShadow && {
      shadowColor: 'rgb(89,131,240)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 7,
      elevation: 1,
      overflow: 'visible',
    }),
  }
})

export const AnimatedBox = Animated.createAnimatedComponent(Box)

export default Box
