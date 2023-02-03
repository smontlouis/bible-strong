import styled from '@emotion/native'
import React, { forwardRef } from 'react'
import { TouchableOpacity, View, ViewProps } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { TAB_ICON_SIZE } from '~features/app-switcher/utils/constants'

export interface BoxProps extends ViewProps {
  children?: React.ReactNode
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
  marginTop?: number | 'auto'
  mt?: number | 'auto'
  marginLeft?: number | 'auto'
  ml?: number | 'auto'
  marginRight?: number | 'auto'
  mr?: number | 'auto'
  marginBottom?: number | 'auto'
  mb?: number | 'auto'
  marginVertical?: number | 'auto'
  my?: number | 'auto'
  marginHorizontal?: number | 'auto'
  mx?: number | 'auto'

  absoluteFill?: boolean

  borderWidth?: number
  borderBottomWidth?: number
  borderTopWidth?: number
  borderLeftWidth?: number
  borderRightWidth?: number
  borderColor?: string
  transform?: object
  borderRadius?: number
  borderTopLeftRadius?: number
  borderTopRightRadius?: number
  borderBottomLeftRadius?: number
  borderBottomRightRadius?: number

  overflow?: 'visible' | 'hidden'
  width?: number | string
  w?: number | string
  maxWidth?: number | string
  maxW?: number | string
  minWidth?: number | string
  minW?: number | string
  minHeight?: number | string
  minH?: number | string
  height?: number | string
  h?: number | string

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
  lightShadow?: boolean
  size?: number

  zIndex?: number

  shadow?: {
    shadowColor: string
    shadowOffset: {
      width: number
      height: number
    }
    shadowOpacity: number
    shadowRadius: number

    elevation: number
  }
}
const Box = styled.View<BoxProps>(props => {
  return {
    // container
    position: props.position ?? props.pos,
    top: props.top ?? props.t,
    left: props.left ?? props.l,
    right: props.right ?? props.r,
    bottom: props.bottom ?? props.b,

    padding: props.padding ?? props.p,
    paddingTop: props.paddingTop ?? props.pt,
    paddingLeft: props.paddingLeft ?? props.pl,
    paddingRight: props.paddingRight ?? props.pr,
    paddingBottom: props.bottomTabBarPadding
      ? TAB_ICON_SIZE
      : props.paddingBottom ?? props.pb,
    paddingVertical: props.paddingVertical ?? props.py,
    paddingHorizontal: props.paddingHorizontal ?? props.px,

    margin: props.margin ?? props.m,
    marginTop: props.marginTop ?? props.mt,
    marginLeft: props.marginLeft ?? props.ml,
    marginBottom: props.marginBottom ?? props.mb,
    marginRight: props.marginRight ?? props.mr,
    marginVertical: props.marginVertical ?? props.my,
    marginHorizontal: props.marginHorizontal ?? props.mx,

    borderWidth: props.borderWidth,
    borderBottomWidth: props.borderBottomWidth,
    borderTopWidth: props.borderTopWidth,
    borderLeftWidth: props.borderLeftWidth,
    borderRightWidth: props.borderRightWidth,
    borderColor:
      props.theme.colors[
        props.borderColor as keyof typeof props.theme.colors
      ] ?? props.borderColor,
    transform: props.transform,
    borderRadius: props.borderRadius,
    borderTopLeftRadius: props.borderTopLeftRadius,
    borderTopRightRadius: props.borderTopRightRadius,
    borderBottomLeftRadius: props.borderBottomLeftRadius,
    borderBottomRightRadius: props.borderBottomRightRadius,

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
    zIndex: props.zIndex,
    // shorthands
    flexWrap:
      (props.wrap && 'wrap') ??
      (props.wrapReverse && 'wrap-reverse') ??
      'nowrap',
    flexDirection:
      (props.row ? 'row' : 'column') + (props.reverse ? '-reverse' : ''),

    opacity: props.disabled ? 0.3 : props.opacity ?? 1,

    backgroundColor: props.theme.colors[
      (props.backgroundColor ?? props.bg) as keyof typeof props.theme.colors
    ]
      ? props.theme.colors[
          (props.backgroundColor ?? props.bg) as keyof typeof props.theme.colors
        ]
      : props.backgroundColor ?? props.bg,

    ...(props.grey && {
      backgroundColor: props.theme.colors.lightGrey,
    }),

    ...(props.background && {
      backgroundColor: props.theme.colors.reverse,
    }),

    ...(props.rounded && {
      borderRadius: 20,
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

    ...props.shadow,
  }
})

export const SafeAreaBox = forwardRef<
  View,
  BoxProps & {
    enablePaddingTop?: boolean
    enablePaddingBottom?: boolean
  }
>(({ enablePaddingTop = true, enablePaddingBottom = true, ...props }, ref) => {
  const insets = useSafeAreaInsets()
  return (
    <Box
      ref={ref}
      marginTop={enablePaddingTop ? insets.top : 0}
      marginBottom={enablePaddingBottom ? insets.bottom : 0}
      flex={1}
      {...props}
    />
  )
})

export const AnimatedSafeAreaBox = forwardRef<
  View,
  Animated.AnimateProps<BoxProps> & { hasBottomTabBar?: boolean }
>((props, ref) => {
  const insets = useSafeAreaInsets()
  return (
    <AnimatedBox
      ref={ref}
      paddingTop={insets.top}
      paddingBottom={insets.bottom}
      {...props}
    />
  )
})
export const TouchableBox = Box.withComponent(TouchableOpacity)
export const AnimatedBox = Animated.createAnimatedComponent(Box)
export const AnimatedTouchableBox = Animated.createAnimatedComponent(
  TouchableBox
)

export default Box
