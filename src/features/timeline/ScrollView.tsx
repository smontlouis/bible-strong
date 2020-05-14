import React, { ReactNode, memo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  clockRunning,
  debug,
  or,
} from 'react-native-reanimated'
import {
  snapPoint,
  usePanGestureHandler,
  timing,
  delay,
  useValues,
} from 'react-native-redash'
import { wp } from '~helpers/utils'

const {
  SpringUtils,
  Value,
  Clock,
  eq,
  startClock,
  set,
  add,
  and,
  greaterOrEq,
  lessOrEq,
  cond,
  decay,
  block,
  not,
  spring,
  abs,
  multiply,
  divide,
  sub,
  useCode,
  call,
  diff,
  pow,
  min,
  timing: reTiming,
} = Animated

const friction = (ratio: Animated.Node<number>) =>
  multiply(0.7, pow(sub(1, ratio), 2))

interface AnimationProps {
  translateX: Animated.Value<number>
  translateY: Animated.Value<number>
  translationX: Animated.Value<number>
  velocityX: Animated.Value<number>
  translationY: Animated.Value<number>
  velocityY: Animated.Value<number>
  state: Animated.Value<State>
  containerHeight: number
  containerWidth: number
  onPrev: () => void
  onNext: () => void
  isFirst?: boolean
  isLast?: boolean
  contentWidth: number
  contentHeight: number
  isReady: Animated.Value<number>
  entrance: 0 | 1
  opacity: Animated.Value<number>
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

const withScrollY = ({
  translationY,
  velocityY,
  state: gestureState,
  containerHeight,
  contentHeight,
}: WithScrollYParams) => {
  const clock = new Clock()
  const delta = new Value(0)
  const isSpringing = new Value(0)
  const isDecaying = new Value(0)
  const state = {
    time: new Value(0),
    position: new Value(0),
    velocity: new Value(0),
    finished: new Value(0),
  }
  const upperBound = 0
  const lowerBound = -1 * (contentHeight - containerHeight)

  const isInBound = and(
    lessOrEq(state.position, upperBound),
    greaterOrEq(state.position, lowerBound)
  )
  const config = {
    ...SpringUtils.makeDefaultConfig(),
    toValue: new Value(0),
    damping: 150,
  }
  const overscroll = sub(
    state.position,
    cond(greaterOrEq(state.position, 0), upperBound, lowerBound)
  )
  return block([
    startClock(clock),
    set(delta, diff(translationY)),
    cond(
      eq(gestureState, State.ACTIVE),
      [
        set(isSpringing, 0),
        set(isDecaying, 0),
        set(
          state.position,
          add(
            state.position,
            cond(isInBound, delta, [
              multiply(
                delta,
                friction(min(divide(abs(overscroll), containerHeight), 1))
              ),
            ])
          )
        ),
        set(state.velocity, velocityY),
        set(state.time, 0),
      ],
      [
        set(translationY, 0),
        cond(
          and(isInBound, not(isSpringing)),
          [set(isDecaying, 1), decay(clock, state, { deceleration: 0.997 })],
          [
            set(isSpringing, 1),
            set(
              config.toValue,
              snapPoint(state.position, state.velocity, [
                lowerBound,
                upperBound,
              ])
            ),
            spring(clock, state, config),
          ]
        ),
      ]
    ),
    state.position,
  ])
}

const withScrollX = ({
  translationX,
  velocityX,
  state: gestureState,
  containerWidth,
  contentWidth,
  onPrev,
  onNext,
  isFirst,
  isLast,
  entrance,
}: WithScrollXParams) => {
  const clock = new Clock()
  const delta = new Value(0)
  const isSpringing = new Value(0)
  const isDecaying = new Value(0)
  const onPullTriggered = new Value(0)
  const onPullTriggeredEnd = new Value(0)
  const upperBound = 0
  const lowerBound = -1 * (contentWidth - containerWidth)

  const state = {
    time: new Value(0),
    position: new Value(entrance === 0 ? lowerBound : 0),
    velocity: new Value(0),
    finished: new Value(0),
  }

  const isInBound = and(
    lessOrEq(state.position, upperBound),
    greaterOrEq(state.position, lowerBound)
  )
  const config = {
    ...SpringUtils.makeDefaultConfig(),
    toValue: new Value(0),
    damping: 150,
  }
  const overscroll = sub(
    state.position,
    cond(greaterOrEq(state.position, 0), upperBound, lowerBound)
  )
  return block([
    startClock(clock),
    set(delta, diff(translationX)),
    cond(
      eq(gestureState, State.ACTIVE),
      [
        set(isSpringing, 0),
        set(isDecaying, 0),
        set(
          state.position,
          add(
            state.position,
            cond(isInBound, delta, [
              multiply(
                delta,
                friction(min(divide(abs(overscroll), containerWidth), 1))
              ),
            ])
          )
        ),
        set(state.velocity, velocityX),
        set(state.time, 0),
      ],
      [
        set(translationX, 0),
        cond(
          and(isInBound, not(isSpringing)),
          [set(isDecaying, 1), decay(clock, state, { deceleration: 0.997 })],
          [
            set(isSpringing, 1),
            cond(
              and(
                not(isDecaying),
                not(isLast),
                lessOrEq(state.position, add(lowerBound, -100))
              ),
              [
                cond(not(onPullTriggered), [set(onPullTriggered, 1)]),
                set(config.toValue, add(lowerBound, -wp(100))),
                reTiming(
                  clock,
                  { ...state, frameTime: new Value(0) },
                  { ...config, duration: 500, easing: Easing.out(Easing.ease) }
                ),
                cond(
                  and(
                    state.finished,
                    eq(state.position, add(lowerBound, -wp(100))),
                    not(onPullTriggeredEnd)
                  ),
                  [call([], onNext), set(onPullTriggeredEnd, 1)]
                ),
              ]
            ),
            cond(
              and(
                not(isDecaying),
                not(isFirst),
                greaterOrEq(state.position, 100)
              ),
              [
                cond(not(onPullTriggered), [set(onPullTriggered, 1)]),
                set(config.toValue, wp(100)),
                reTiming(
                  clock,
                  { ...state, frameTime: new Value(0) },
                  { ...config, duration: 500, easing: Easing.out(Easing.ease) }
                ),
                cond(
                  and(
                    state.finished,
                    eq(state.position, wp(100)),
                    not(onPullTriggeredEnd)
                  ),
                  [call([], onPrev), set(onPullTriggeredEnd, 1)]
                ),
              ]
            ),
            set(
              config.toValue,
              snapPoint(state.position, state.velocity, [
                lowerBound,
                upperBound,
              ])
            ),
            spring(clock, state, config),
          ]
        ),
      ]
    ),
    state.position,
  ])
}

const initAnimations = ({
  translateX,
  translateY,
  state,
  velocityX,
  velocityY,
  translationX,
  translationY,
  containerHeight,
  contentHeight,
  containerWidth,
  contentWidth,
  onPrev,
  onNext,
  isFirst,
  isLast,
  isReady,
  entrance,
  opacity,
}: AnimationProps) => {
  if (!containerHeight || !containerWidth) {
    return
  }

  const clock = new Clock()
  const canStartAnimation = new Value(0)
  const lowerBound = -1 * (contentWidth - containerWidth)

  const launchBlock = () =>
    block([
      cond(not(isReady), [
        set(opacity, 1),
        set(
          translateX,
          cond(
            entrance,
            timing({
              clock,
              duration: 1000,
              from: wp(100),
              to: 0,
              easing: Easing.out(Easing.ease),
            }),
            timing({
              clock,
              duration: 1000,
              from: lowerBound - wp(100),
              to: lowerBound,
              easing: Easing.out(Easing.ease),
            })
          )
        ),
      ]),
      cond(
        and(
          not(isReady),
          not(clockRunning(clock)),
          or(eq(translateX, lowerBound), eq(translateX, 0))
        ),
        [set(isReady, 1)]
      ),
      cond(isReady, [
        set(
          translateY,
          withScrollY({
            translationY,
            velocityY,
            state,
            containerHeight,
            contentHeight,
          })
        ),
        set(
          translateX,
          withScrollX({
            translationX,
            velocityX,
            state,
            containerWidth,
            contentWidth,
            onPrev,
            onNext,
            isFirst,
            isLast,
            entrance,
          })
        ),
      ]),
    ])

  return block([
    cond(canStartAnimation, 0, [
      set(translateX, cond(entrance, wp(100), lowerBound - wp(100))),
      delay(set(canStartAnimation, 1), 1500),
    ]),
    cond(canStartAnimation, [launchBlock()]),
  ])
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

interface ScrollViewProps {
  children: ReactNode
  translateX: Animated.Value<number>
  translateY: Animated.Value<number>
  width: number
  height: number
  onPrev: () => void
  onNext: () => void
  isFirst?: boolean
  isLast?: boolean
  isReady: Animated.Value<number>
  entrance: 0 | 1
}

export default memo(
  ({
    children,
    width,
    height,
    translateX,
    translateY,
    onPrev,
    onNext,
    isFirst,
    isLast,
    isReady,
    entrance,
  }: ScrollViewProps) => {
    const [containerHeight, setContainerHeight] = useState(0)
    const [containerWidth, setContainerWidth] = useState(0)
    const [opacity] = useValues([0], [])

    const {
      gestureHandler,
      translation,
      velocity,
      state,
    } = usePanGestureHandler([])

    useCode(
      () =>
        initAnimations({
          translateX,
          translateY,
          state,
          velocityX: velocity.x,
          velocityY: velocity.y,
          translationX: translation.x,
          translationY: translation.y,
          containerHeight,
          contentHeight: height,
          containerWidth,
          contentWidth: width,
          onPrev,
          onNext,
          isFirst,
          isLast,
          isReady,
          entrance,
          opacity,
        }),
      [containerHeight, containerWidth]
    )

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
        <PanGestureHandler {...gestureHandler}>
          <Animated.View
            style={{
              opacity,
              width,
              height,
              transform: [{ translateY, translateX }],
            }}
          >
            {children}
          </Animated.View>
        </PanGestureHandler>
      </View>
    )
  }
)
