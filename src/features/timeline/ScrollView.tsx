import React, { memo, ReactNode, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector, State } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { wp, wpUI } from '~helpers/utils'

function friction(value: number) {
  'worklet'

  const MAX_FRICTION = 200
  const MAX_VALUE = 500

  const res = Math.max(
    1,
    Math.min(
      MAX_FRICTION,
      1 + (Math.abs(value) * (MAX_FRICTION - 1)) / MAX_VALUE
    )
  )

  if (value < 0) {
    return -res
  }

  return res
}

interface AnimationProps {
  translateX: SharedValue<number>
  translateY: SharedValue<number>
  translationX: SharedValue<number>
  velocityX: SharedValue<number>
  translationY: SharedValue<number>
  velocityY: SharedValue<number>
  state: SharedValue<State>
  containerHeight: number
  containerWidth: number
  onPrev: () => void
  onNext: () => void
  isFirst?: boolean
  isLast?: boolean
  contentWidth: number
  contentHeight: number
  isReady: SharedValue<number>
  entrance: 0 | 1
  opacity: SharedValue<number>
}

type WithScrollYParams = Pick<
  AnimationProps,
  'translationY' | 'velocityY' | 'state' | 'containerHeight' | 'contentHeight'
>

type WithScrollXParams = Pick<
  AnimationProps,
  | 'translationX'
  | 'velocityX'
  | 'state'
  | 'containerWidth'
  | 'contentWidth'
  | 'onNext'
  | 'onPrev'
  | 'isFirst'
  | 'isLast'
  | 'entrance'
>

// const withScrollY = ({
//   translationY,
//   velocityY,
//   state: gestureState,
//   containerHeight,
//   contentHeight,
// }: WithScrollYParams) => {
//   const clock = new Clock()
//   const delta = new Value(0)
//   const isSpringing = new Value(0)
//   const isDecaying = new Value(0)
//   const state = {
//     time: new Value(0),
//     position: new Value(0),
//     velocity: new Value(0),
//     finished: new Value(0),
//   }
//   const upperBound = 0
//   const lowerBound = -1 * (contentHeight - containerHeight)

//   const isInBound = and(
//     lessOrEq(state.position, upperBound),
//     greaterOrEq(state.position, lowerBound)
//   )
//   const config = {
//     ...SpringUtils.makeDefaultConfig(),
//     toValue: new Value(0),
//     damping: 150,
//   }
//   const overscroll = sub(
//     state.position,
//     cond(greaterOrEq(state.position, 0), upperBound, lowerBound)
//   )
//   return block([
//     startClock(clock),
//     set(delta, diff(translationY)),
//     cond(
//       eq(gestureState, State.ACTIVE),
//       [
//         set(isSpringing, 0),
//         set(isDecaying, 0),
//         set(
//           state.position,
//           add(
//             state.position,
//             cond(isInBound, delta, [
//               multiply(
//                 delta,
//                 friction(min(divide(abs(overscroll), containerHeight), 1))
//               ),
//             ])
//           )
//         ),
//         set(state.velocity, velocityY),
//         set(state.time, 0),
//       ],
//       [
//         set(translationY, 0),
//         cond(
//           and(isInBound, not(isSpringing)),
//           [set(isDecaying, 1), decay(clock, state, { deceleration: 0.997 })],
//           [
//             set(isSpringing, 1),
//             set(
//               config.toValue,
//               snapPoint(state.position, state.velocity, [
//                 lowerBound,
//                 upperBound,
//               ])
//             ),
//             spring(clock, state, config),
//           ]
//         ),
//       ]
//     ),
//     state.position,
//   ])
// }

// const withScrollX = ({
//   translationX,
//   velocityX,
//   state: gestureState,
//   containerWidth,
//   contentWidth,
//   onPrev,
//   onNext,
//   isFirst,
//   isLast,
//   entrance,
// }: WithScrollXParams) => {
//   const clock = new Clock()
//   const delta = new Value(0)
//   const isSpringing = new Value(0)
//   const isDecaying = new Value(0)
//   const onPullTriggered = new Value(0)
//   const onPullTriggeredEnd = new Value(0)
//   const upperBound = 0
//   const lowerBound = -1 * (contentWidth - containerWidth)

//   const state = {
//     time: new Value(0),
//     position: new Value(entrance === 0 ? lowerBound : 0),
//     velocity: new Value(0),
//     finished: new Value(0),
//   }

//   const isInBound = and(
//     lessOrEq(state.position, upperBound),
//     greaterOrEq(state.position, lowerBound)
//   )
//   const config = {
//     ...SpringUtils.makeDefaultConfig(),
//     toValue: new Value(0),
//     damping: 150,
//   }
//   const overscroll = sub(
//     state.position,
//     cond(greaterOrEq(state.position, 0), upperBound, lowerBound)
//   )
//   return block([
//     startClock(clock),
//     set(delta, diff(translationX)),
//     cond(
//       eq(gestureState, State.ACTIVE),
//       [
//         set(isSpringing, 0),
//         set(isDecaying, 0),
//         set(
//           state.position,
//           add(
//             state.position,
//             cond(isInBound, delta, [
//               multiply(
//                 delta,
//                 friction(min(divide(abs(overscroll), containerWidth), 1))
//               ),
//             ])
//           )
//         ),
//         set(state.velocity, velocityX),
//         set(state.time, 0),
//       ],
//       [
//         set(translationX, 0),
//         cond(
//           and(isInBound, not(isSpringing)),
//           [set(isDecaying, 1), decay(clock, state, { deceleration: 0.997 })],
//           [
//             set(isSpringing, 1),
//             cond(
//               and(
//                 not(isDecaying),
//                 not(isLast),
//                 lessOrEq(state.position, add(lowerBound, -100))
//               ),
//               [
//                 cond(not(onPullTriggered), [set(onPullTriggered, 1)]),
//                 set(config.toValue, add(lowerBound, -wp(100))),
//                 reTiming(
//                   clock,
//                   { ...state, frameTime: new Value(0) },
//                   {
//                     ...config,
//                     duration: 500,
//                     easing: EasingNode.out(EasingNode.ease),
//                   }
//                 ),
//                 cond(
//                   and(
//                     state.finished,
//                     eq(state.position, add(lowerBound, -wp(100))),
//                     not(onPullTriggeredEnd)
//                   ),
//                   [call([], onNext), set(onPullTriggeredEnd, 1)]
//                 ),
//               ]
//             ),
//             cond(
//               and(
//                 not(isDecaying),
//                 not(isFirst),
//                 greaterOrEq(state.position, 100)
//               ),
//               [
//                 cond(not(onPullTriggered), [set(onPullTriggered, 1)]),
//                 set(config.toValue, wp(100)),
//                 reTiming(
//                   clock,
//                   { ...state, frameTime: new Value(0) },
//                   {
//                     ...config,
//                     duration: 500,
//                     easing: EasingNode.out(EasingNode.ease),
//                   }
//                 ),
//                 cond(
//                   and(
//                     state.finished,
//                     eq(state.position, wp(100)),
//                     not(onPullTriggeredEnd)
//                   ),
//                   [call([], onPrev), set(onPullTriggeredEnd, 1)]
//                 ),
//               ]
//             ),
//             set(
//               config.toValue,
//               snapPoint(state.position, state.velocity, [
//                 lowerBound,
//                 upperBound,
//               ])
//             ),
//             spring(clock, state, config),
//           ]
//         ),
//       ]
//     ),
//     state.position,
//   ])
// }

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

interface ScrollViewProps {
  children: ReactNode
  x: SharedValue<number>
  y: SharedValue<number>
  width: number
  height: number
  onPrev: () => void
  onNext: () => void
  isFirst?: boolean
  isLast?: boolean
  isReady: SharedValue<number>
  entrance: 0 | 1
}

export default memo(
  ({
    children,
    width,
    height,
    x,
    y,
    onPrev,
    onNext,
    isFirst,
    isLast,
    isReady,
    entrance,
  }: ScrollViewProps) => {
    const [containerHeight, setContainerHeight] = useState(0)
    const [containerWidth, setContainerWidth] = useState(0)
    const opacity = useSharedValue(0)
    const canStartAnimation = useSharedValue(0)
    const upperBoundX = 0
    const lowerBoundX = -1 * (width - containerWidth)
    const upperBoundY = 0
    const lowerBoundY = -1 * (height - containerHeight)
    const deltaX = useSharedValue(0)
    const deltaY = useSharedValue(0)

    useEffect(() => {
      if (canStartAnimation.value === 0) {
        x.value = entrance ? wpUI(100) : lowerBoundX - wpUI(100)
        canStartAnimation.value = withDelay(
          1500,
          withTiming(1, { duration: 0 })
        )
      }
    }, [])

    useAnimatedReaction(
      () => canStartAnimation.value,
      () => {
        if (canStartAnimation.value === 1) {
          if (!isReady.value) {
            opacity.value = 1
            x.value = withTiming(
              entrance ? 0 : lowerBoundX,
              { duration: 1000 },
              () => {
                isReady.value = 1
              }
            )
          }
        }
      }
    )

    const animatedStyles = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ translateY: y.value }, { translateX: x.value }],
    }))

    const panGesture = Gesture.Pan()
      .onStart(e => {
        deltaX.value = x.value
        deltaY.value = y.value
      })
      .onUpdate(e => {
        const translateX = deltaX.value + e.translationX
        const translateY = deltaY.value + e.translationY

        // Apply friction when reaching the bounds
        const isInBoundX = x.value >= lowerBoundX && x.value <= upperBoundX
        if (!isInBoundX) {
          const bound = x.value < lowerBoundX ? lowerBoundX : upperBoundX
          const distance = bound - translateX
          x.value = bound - friction(distance)
        } else {
          x.value = translateX
        }

        const isInBoundY = y.value >= lowerBoundY && y.value <= upperBoundY
        if (!isInBoundY) {
          const bound = y.value < lowerBoundY ? lowerBoundY : upperBoundY
          const distance = bound - translateY
          y.value = bound - friction(distance)
        } else {
          y.value = deltaY.value + e.translationY
        }
      })
      .onEnd(e => {
        const isInBoundX = x.value >= lowerBoundX && x.value <= upperBoundX
        if (!isInBoundX) {
          const direction = e.velocityX > 0 ? 'left' : 'right'

          if (
            direction === 'left' &&
            !isFirst &&
            (x.value - upperBoundX > 100 || e.velocityX > 1800)
          ) {
            x.value = withTiming(
              upperBoundX + wpUI(100),
              { duration: 300 },
              () => {
                runOnJS(onPrev)()
              }
            )
          } else if (
            direction === 'right' &&
            !isLast &&
            (x.value - lowerBoundX < -100 || e.velocityX < -1800)
          ) {
            x.value = withTiming(
              lowerBoundX - wpUI(100),
              { duration: 300 },
              () => {
                runOnJS(onNext)()
              }
            )
          } else {
            x.value = withTiming(
              Math.max(lowerBoundX, Math.min(upperBoundX, x.value))
            )
          }
        } else {
          x.value = withDecay({
            velocity: e.velocityX,
            clamp: [lowerBoundX, upperBoundX],
            rubberBandEffect: true,
            rubberBandFactor: 1,
            velocityFactor: 0.4,
          })
        }
        const isInBoundY = y.value >= lowerBoundY && y.value <= upperBoundY
        if (!isInBoundY) {
          y.value = withTiming(
            Math.max(lowerBoundY, Math.min(upperBoundY, y.value))
          )
        } else {
          y.value = withDecay({
            velocity: e.velocityY,
            clamp: [lowerBoundY, upperBoundY],
            rubberBandEffect: true,
            rubberBandFactor: 1,
            velocityFactor: 0.4,
          })
        }
      })

    return (
      <View
        style={styles.container}
        onLayout={({
          nativeEvent: {
            layout: { height: h, width: w },
          },
        }) => {
          setContainerHeight(h)
          setContainerWidth(w)
        }}
      >
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[{ width, height }, animatedStyles]}>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    )
  }
)
