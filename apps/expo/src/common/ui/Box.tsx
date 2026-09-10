import { motify, MotiTransitionProp, StyleValueWithReplacedTransforms } from '@alloc/moti'
import { ImageStyle } from 'expo-image'
import React from 'react'
import { Platform, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native'
import { twMerge } from '~common/ui/classNames'

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

export type BoxProps = React.ComponentPropsWithRef<typeof View> & {
  className?: string
  as?: React.ElementType
  /** React Native Web data attributes, omitted from native views. */
  dataSet?: Record<string, string>
}

const Box = ({ as: Component = View, className, style, dataSet, ...props }: BoxProps) => {
  return (
    <Component
      {...props}
      {...(dataSet && Platform.OS === 'web' ? { dataSet } : {})}
      className={className}
      style={style}
    />
  )
}

export const HStack = ({ className, ...props }: BoxProps) => (
  <Box {...props} className={twMerge('flex-row', className)} />
)

export const VStack = ({ className, ...props }: BoxProps) => (
  <Box {...props} className={twMerge('flex-col', className)} />
)

export const SafeAreaBox = ({
  isPadding = true,
  className,
  style,
  ...props
}: BoxProps & {
  isPadding?: boolean
}) => {
  const insets = useSafeAreaInsets()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  return (
    <Box
      {...props}
      style={[
        isPadding
          ? { paddingTop: insets.top, paddingBottom: bottomBarHeight }
          : { marginTop: insets.top, marginBottom: insets.bottom },
        style,
      ]}
      className={twMerge('flex-1 bg-reverse overflow-hidden border-continuous', className)}
    />
  )
}

export const AnimatedSafeAreaBox = ({
  style,
  ...props
}: AnimatedProps<Omit<BoxProps, 'key' | 'ref'>> & {
  ref?: React.Ref<View>
  hasBottomTabBar?: boolean
}) => {
  const insets = useSafeAreaInsets()
  return (
    <AnimatedBox
      {...props}
      style={[{ paddingTop: insets.top, paddingBottom: insets.bottom }, style]}
    />
  )
}

export const TouchableBox = ({
  as: _as,
  ...props
}: BoxProps & Omit<React.ComponentPropsWithRef<typeof TouchableOpacity>, keyof BoxProps>) => (
  <Box as={TouchableOpacity} accessibilityRole="button" {...props} />
)

export const AnimatedBox = Animated.createAnimatedComponent(Box)
export const AnimatedHStack = Animated.createAnimatedComponent(HStack)
export const AnimatedVStack = Animated.createAnimatedComponent(VStack)
export const AnimatedTouchableBox = Animated.createAnimatedComponent(TouchableBox)

export const MotiTouchableBox = motify(TouchableBox)()
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
  animateLayout?: boolean
  direction?: 'left' | 'right' | 'top' | 'bottom'
  entering?: EntryExitAnimationFunction | ComplexAnimationBuilder
  exiting?: EntryExitAnimationFunction | ComplexAnimationBuilder
  skipEntering?: boolean
  skipExiting?: boolean
}

export const FadingBox = ({
  children,
  keyProp,
  animateLayout = true,
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
        layout={animateLayout ? LinearTransition : undefined}
        {...props}
      >
        {children}
      </AnimatedBox>
    </LayoutAnimationConfig>
  )
}
