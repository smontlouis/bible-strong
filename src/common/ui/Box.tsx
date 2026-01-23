import { motify, MotiTransitionProp, StyleValueWithReplacedTransforms } from '@alloc/moti'
import styled from '@emotion/native'
import { ImageStyle } from 'expo-image'
import React, { Ref } from 'react'
import { TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native'

import Animated, {
  AnimatedProps,
  ComplexAnimationBuilder,
  Easing,
  EntryExitAnimationFunction,
  LayoutAnimationConfig,
  LinearTransition,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import Text, { AnimatedText, TextProps } from './Text'

export type BoxProps = {
  debug?: boolean

  as?: React.ElementType<any> | undefined
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
  gap?: number
  absoluteFill?: boolean

  borderWidth?: number
  borderBottomWidth?: number
  borderTopWidth?: number
  borderLeftWidth?: number
  borderRightWidth?: number
  borderColor?: string
  transform?: any
  borderRadius?: number
  borderTopLeftRadius?: number
  borderTopRightRadius?: number
  borderBottomLeftRadius?: number
  borderBottomRightRadius?: number

  overflow?: 'visible' | 'hidden'
  width?: ViewStyle['width']
  w?: ViewStyle['width']
  maxWidth?: ViewStyle['maxWidth']
  maxW?: ViewStyle['maxWidth']
  minWidth?: ViewStyle['minWidth']
  minW?: ViewStyle['minWidth']
  minHeight?: ViewStyle['minHeight']
  minH?: ViewStyle['minHeight']
  height?: ViewStyle['height']
  h?: ViewStyle['height']
  maxHeight?: ViewStyle['maxHeight']
  maxH?: ViewStyle['maxHeight']

  flex?: true | number
  flexShrink?: number
  justifyContent?: ViewStyle['justifyContent']
  center?: boolean
  alignItems?: ViewStyle['alignItems']
  alignContent?: ViewStyle['alignContent']
  alignSelf?: ViewStyle['alignSelf']
  wrap?: boolean
  wrapReverse?: boolean
  row?: boolean
  reverse?: boolean
  disabled?: boolean
  opacity?: number

  backgroundColor?: string
  bg?: string

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
const Box = styled.View<BoxProps>(props => ({
  // container
  position: props.position ?? props.pos,
  top: props.top ?? props.t,
  left: props.left ?? props.l,
  right: props.right ?? props.r,
  bottom: props.bottom ?? props.b,
  hitSlop: props.hitSlop,

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

  gap: props.gap,

  borderWidth: props.borderWidth,
  borderBottomWidth: props.borderBottomWidth,
  borderTopWidth: props.borderTopWidth,
  borderLeftWidth: props.borderLeftWidth,
  borderRightWidth: props.borderRightWidth,
  borderColor:
    props.theme.colors[props.borderColor as keyof typeof props.theme.colors] ?? props.borderColor,
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
  maxHeight: props.maxHeight ?? props.maxH,
  height: props.height ?? props.h,
  // flex props
  flex: props.flex === true ? 1 : props.flex,
  justifyContent: props.justifyContent ?? (props.center ? 'center' : undefined),
  alignItems: props.alignItems ?? (props.center ? 'center' : undefined),
  alignContent: props.alignContent ?? 'flex-start',
  alignSelf: props.alignSelf,
  zIndex: props.zIndex,
  // shorthands
  flexWrap:
    (props.wrap ? 'wrap' : undefined) ??
    (props.wrapReverse ? 'wrap-reverse' : undefined) ??
    'nowrap',
  flexDirection: props.row ? 'row' : 'column',
  flexShrink: props.flexShrink,

  opacity: props.disabled ? 0.6 : (props.opacity ?? 1),

  backgroundColor: props.theme.colors[
    (props.backgroundColor ?? props.bg) as keyof typeof props.theme.colors
  ]
    ? props.theme.colors[(props.backgroundColor ?? props.bg) as keyof typeof props.theme.colors]
    : (props.backgroundColor ?? props.bg),

  ...(props.background
    ? {
        backgroundColor: props.theme.colors.reverse,
      }
    : {}),

  ...(props.rounded
    ? {
        borderRadius: 20,
      }
    : {}),

  ...(props.size
    ? {
        width: props.size,
        height: props.size,
      }
    : {}),

  ...(props.absoluteFill
    ? {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        top: 0,
      }
    : {}),

  ...(props.lightShadow
    ? {
        shadowColor: 'rgb(89,131,240)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 7,
        elevation: 1,
        overflow: 'visible',
      }
    : {}),

  ...props.shadow,

  ...(props.debug && __DEV__
    ? {
        boxShadow: 'inset 0 0 0 2px red',
      }
    : {}),

  borderCurve: 'continuous',
}))

export const HStack = styled(Box)({
  flexDirection: 'row',
})

export const VStack = styled(Box)({
  flexDirection: 'column',
})

export const SafeAreaBox = ({
  isPadding = true,
  ref,
  ...props
}: BoxProps & {
  isPadding?: boolean
  ref?: Ref<View>
}) => {
  const insets = useSafeAreaInsets()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  return (
    <Box
      ref={ref}
      {...(isPadding
        ? {
            paddingTop: insets.top,
            paddingBottom: bottomBarHeight,
          }
        : {
            marginTop: insets.top,
            marginBottom: insets.bottom,
          })}
      bg="reverse"
      flex={1}
      {...props}
    />
  )
}

export const AnimatedSafeAreaBox = ({
  ref,
  ...props
}: AnimatedProps<BoxProps> & { hasBottomTabBar?: boolean; ref?: Ref<View> }) => {
  const insets = useSafeAreaInsets()
  return <AnimatedBox ref={ref} paddingTop={insets.top} paddingBottom={insets.bottom} {...props} />
}
const BasicTouchableBox = Box.withComponent(TouchableOpacity)
export const TouchableBox = BasicTouchableBox

export const AnimatedBox = Animated.createAnimatedComponent(Box)
export const AnimatedHStack = Animated.createAnimatedComponent(HStack)
export const AnimatedVStack = Animated.createAnimatedComponent(VStack)
export const AnimatedTouchableBox = Animated.createAnimatedComponent(BasicTouchableBox)

export const MotiTouchableBox = motify(BasicTouchableBox)()
export const MotiBox = motify(Box)()
export const MotiHStack = motify(HStack)()
export const MotiVStack = motify(VStack)()
export const MotiText = motify(Text)()

export const motiTransition: {
  transition: MotiTransitionProp<
    StyleValueWithReplacedTransforms<ViewStyle | TextStyle | ImageStyle>
  >
} = {
  transition: {
    type: 'timing',
    duration: 300,
    easing: Easing.bezier(0.13, 0.69, 0.5, 0.98),
  },
}
export default Box

export const fadeSlideLeftIn = () => {
  'worklet'
  const animations = {
    opacity: withDelay(300, withTiming(1, { duration: 200 })),
    transform: [{ translateX: withDelay(300, withTiming(0, { duration: 200 })) }],
  }
  const initialValues = {
    opacity: 0,
    transform: [{ translateX: 5 }],
  }
  return {
    initialValues,
    animations,
  }
}

export const fadeSlideLeftOut = () => {
  'worklet'
  const animations = {
    opacity: withTiming(0, { duration: 200 }),
    transform: [{ translateX: withTiming(-5, { duration: 200 }) }],
  }
  const initialValues = {
    opacity: 1,
    transform: [{ translateX: 0 }],
  }
  return {
    initialValues,
    animations,
  }
}

export const fadeSlideLeftAnimations = {
  entering: fadeSlideLeftIn,
  exiting: fadeSlideLeftOut,
}

export const fadeSlideUpIn = () => {
  'worklet'
  const animations = {
    opacity: withDelay(300, withTiming(1, { duration: 200 })),
    transform: [{ translateY: withDelay(300, withTiming(0, { duration: 200 })) }],
  }
  const initialValues = {
    opacity: 0,
    transform: [{ translateY: 5 }],
  }
  return {
    initialValues,
    animations,
  }
}

export const fadeSlideUpOut = () => {
  'worklet'
  const animations = {
    opacity: withTiming(0, { duration: 200 }),
    transform: [{ translateY: withTiming(-5, { duration: 200 }) }],
  }
  const initialValues = {
    opacity: 1,
    transform: [{ translateY: 0 }],
  }
  return {
    initialValues,
    animations,
  }
}

export const fadeSlideUpAnimations = {
  entering: fadeSlideUpIn,
  exiting: fadeSlideUpOut,
}

export const fadeSlideRightIn = () => {
  'worklet'
  const animations = {
    opacity: withDelay(300, withTiming(1, { duration: 200 })),
    transform: [{ translateX: withDelay(300, withTiming(0, { duration: 200 })) }],
  }
  const initialValues = {
    opacity: 0,
    transform: [{ translateX: 5 }],
  }
  return {
    initialValues,
    animations,
  }
}

export const fadeSlideRightOut = () => {
  'worklet'
  const animations = {
    opacity: withTiming(0, { duration: 200 }),
    transform: [{ translateX: withTiming(5, { duration: 200 }) }],
  }
  const initialValues = {
    opacity: 1,
    transform: [{ translateX: 0 }],
  }
  return {
    initialValues,
    animations,
  }
}

export const fadeSlideRightAnimations = {
  entering: fadeSlideRightIn,
  exiting: fadeSlideRightOut,
}

export const fadeSlideBottomIn = () => {
  'worklet'
  const animations = {
    opacity: withDelay(300, withTiming(1, { duration: 200 })),
    transform: [{ translateY: withDelay(300, withTiming(0, { duration: 200 })) }],
  }
  const initialValues = {
    opacity: 0,
    transform: [{ translateY: -5 }],
  }
  return {
    initialValues,
    animations,
  }
}

export const fadeSlideBottomOut = () => {
  'worklet'
  const animations = {
    opacity: withTiming(0, { duration: 200 }),
    transform: [{ translateY: withTiming(5, { duration: 200 }) }],
  }
  const initialValues = {
    opacity: 1,
    transform: [{ translateY: 0 }],
  }
  return {
    initialValues,
    animations,
  }
}

export const fadeSlideBottomAnimations = {
  entering: fadeSlideBottomIn,
  exiting: fadeSlideBottomOut,
}

type FadingTextProps = Omit<TextProps, 'direction'> & {
  direction?: 'left' | 'right' | 'top' | 'bottom'
  children: string
}

export const FadingText = ({ children, direction = 'left', ...props }: FadingTextProps) => {
  const animationMap = {
    left: { entering: fadeSlideLeftIn, exiting: fadeSlideLeftOut },
    right: { entering: fadeSlideRightIn, exiting: fadeSlideRightOut },
    top: { entering: fadeSlideUpIn, exiting: fadeSlideUpOut },
    bottom: { entering: fadeSlideBottomIn, exiting: fadeSlideBottomOut },
  }

  const { entering: enteringAnimation, exiting: exitingAnimation } = animationMap[direction]

  return (
    <LayoutAnimationConfig skipEntering skipExiting>
      <AnimatedText
        key={children}
        entering={enteringAnimation}
        exiting={exitingAnimation}
        {...props}
      >
        {children}
      </AnimatedText>
    </LayoutAnimationConfig>
  )
}

type FadingViewProps = Omit<BoxProps, 'direction'> & {
  keyProp: string
  direction?: 'left' | 'right' | 'top' | 'bottom'
  entering?: EntryExitAnimationFunction | ComplexAnimationBuilder
  exiting?: EntryExitAnimationFunction | ComplexAnimationBuilder
  skipEntering?: boolean
  skipExiting?: boolean
}

export const FadingBox = ({
  children,
  keyProp,
  direction = 'left',
  entering,
  exiting,
  skipEntering = true,
  skipExiting = true,
  ...props
}: FadingViewProps) => {
  const animationMap = {
    left: { entering: fadeSlideLeftIn, exiting: fadeSlideLeftOut },
    right: { entering: fadeSlideRightIn, exiting: fadeSlideRightOut },
    top: { entering: fadeSlideUpIn, exiting: fadeSlideUpOut },
    bottom: { entering: fadeSlideBottomIn, exiting: fadeSlideBottomOut },
  }

  const defaultAnims = animationMap[direction]
  const enteringAnimation = entering ?? defaultAnims.entering
  const exitingAnimation = exiting ?? defaultAnims.exiting

  return (
    <LayoutAnimationConfig skipEntering={skipEntering} skipExiting={skipExiting}>
      <AnimatedBox
        key={keyProp ?? children?.toString() ?? ''}
        entering={enteringAnimation}
        exiting={exitingAnimation}
        layout={LinearTransition}
        {...props}
      >
        {children}
      </AnimatedBox>
    </LayoutAnimationConfig>
  )
}
