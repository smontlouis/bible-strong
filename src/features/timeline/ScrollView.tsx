import React, { ReactNode, memo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'
import Animated, { debug } from 'react-native-reanimated'
import { snapPoint, usePanGestureHandler } from 'react-native-redash'
import { offset } from './constants'
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
  neq,
  diff,
  pow,
  min,
} = Animated

const friction = (ratio: Animated.Node<number>) =>
  multiply(0.7, pow(sub(1, ratio), 2))

interface WithScrollYParams {
  translationY: Animated.Value<number>
  velocityY: Animated.Value<number>
  state: Animated.Value<State>
  containerHeight: number
  contentHeight: number
}

interface WithScrollXParams {
  translationX: Animated.Value<number>
  velocityX: Animated.Value<number>
  state: Animated.Value<State>
  containerHeight: number
  contentHeight: number
}

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
    damping: 50,
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
  containerHeight,
  contentHeight,
}: WithScrollXParams) => {
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
    damping: 50,
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
                friction(min(divide(abs(overscroll), containerHeight), 1))
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
                lessOrEq(state.position, add(lowerBound, -100))
              ),
              [
                call([], () => console.log('NEXT')),
                set(config.toValue, add(lowerBound, -wp(100))),
                spring(clock, state, config),
                cond(
                  and(
                    eq(state.finished, 1),
                    eq(state.position, add(lowerBound, -wp(100)))
                  ),
                  [call([], () => console.log('NEXT DONE'))]
                ),
              ]
            ),
            cond(and(not(isDecaying), greaterOrEq(state.position, 100)), [
              call([], () => console.log('PREVIOUS')),
            ]),
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
}

export default memo(
  ({ children, width, height, translateX, translateY }: ScrollViewProps) => {
    const [containerHeight, setContainerHeight] = useState(0)
    const [containerWidth, setContainerWidth] = useState(0)

    const {
      gestureHandler,
      translation,
      velocity,
      state,
    } = usePanGestureHandler([])

    useCode(
      () =>
        block([
          set(
            translateY,
            withScrollY({
              translationY: translation.y,
              velocityY: velocity.y,
              state,
              containerHeight,
              contentHeight: height,
            })
          ),
          set(
            translateX,
            withScrollX({
              translationX: translation.x,
              velocityX: velocity.x,
              state,
              containerHeight: containerWidth,
              contentHeight: width,
            })
          ),
        ]),
      [
        width,
        containerHeight,
        containerWidth,
        state,
        translateY,
        translateX,
        velocity.x,
        velocity.y,
        translation.y,
        translation.x,
      ]
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
            style={{ width, height, transform: [{ translateY, translateX }] }}
          >
            {children}
          </Animated.View>
        </PanGestureHandler>
      </View>
    )
  }
)
