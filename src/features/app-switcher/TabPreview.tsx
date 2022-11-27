import { PrimitiveAtom, useAtom } from 'jotai'
import React, { useEffect } from 'react'
import { Image, useWindowDimensions } from 'react-native'
import {
  TapGestureHandler,
  TapGestureHandlerGestureEvent,
} from 'react-native-gesture-handler'
import Animated, {
  Easing,
  Extrapolate,
  interpolate,
  measure,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import Box, { BoxProps } from '~common/ui/Box'
import Text from '~common/ui/Text'
import {
  activeTabIndexAtom,
  activeTabPropertiesAtom,
  TabItem,
} from '../../state/tabs'
import { TAB_PREVIEW_SCALE } from './AppSwitcherScreen'

interface TabPreviewProps {
  index: number
  tabAtom: PrimitiveAtom<TabItem>
  tapGestureRef: React.RefObject<TapGestureHandler>
  simultaneousHandlers?: React.Ref<unknown> | React.Ref<unknown>[] | undefined
}

export const AnimatedBox = Animated.createAnimatedComponent(Box)

const TabPreview = ({
  index,
  tabAtom,
  tapGestureRef,
  simultaneousHandlers,
  ...props
}: TabPreviewProps & BoxProps) => {
  const { height: HEIGHT, width: WIDTH } = useWindowDimensions()
  const [tab] = useAtom(tabAtom)
  const [activeTabIndex, setActiveTabIndex] = useAtom(activeTabIndexAtom)
  const [activeTabProperties, setActiveTabProperties] = useAtom(
    activeTabPropertiesAtom
  )

  const isActiveTabNotInitialized =
    index === activeTabIndex && !activeTabProperties

  // @ts-ignore: FIXME(TS) correct type for createAnimatedComponent
  const ref = useAnimatedRef<AnimatedBox>()

  const animationProgress = useSharedValue(isActiveTabNotInitialized ? 1 : 0)
  const x = useSharedValue(0)
  const y = useSharedValue(0)

  const handler = useAnimatedGestureHandler<TapGestureHandlerGestureEvent>({
    onFinish: (_evt, _ctx, isCanceledOrFailed) => {
      if (isCanceledOrFailed) {
        return
      }

      // measure the image
      // width/height and position to animate from it to the full screen one
      const measurements = measure(ref)

      x.value = measurements.pageX
      y.value = measurements.pageY

      runOnJS(handlePress)()
    },
  })

  function handlePress() {
    setActiveTabProperties({
      x,
      y,
      animationProgress,
    })
    setActiveTabIndex(index)
  }

  const styles = useAnimatedStyle(() => {
    const interpolateProgress = (
      range: [number, number],
      easingFn = (val: number) => val
    ) =>
      interpolate(
        easingFn(animationProgress.value),
        [0, 1],
        range,
        Extrapolate.CLAMP
      )
    return {
      width: WIDTH * TAB_PREVIEW_SCALE,
      height: HEIGHT * TAB_PREVIEW_SCALE,
      opacity: interpolateProgress([1, 0], Easing.bezierFn(1, 0, 1, 0)),
      transform: [
        {
          scale: interpolateProgress([1, 1 / TAB_PREVIEW_SCALE]),
        },
      ],
    }
  })

  // Initialize the active tab properties for selected item the first time
  useEffect(() => {
    if (isActiveTabNotInitialized) {
      x.value = 0
      y.value = 0

      runOnJS(handlePress)()
    }
  }, [])

  return (
    <TapGestureHandler
      onGestureEvent={handler}
      ref={tapGestureRef}
      simultaneousHandlers={simultaneousHandlers}
      maxDist={1}
    >
      <AnimatedBox
        ref={ref}
        borderRadius={30}
        bg="reverse"
        center
        style={styles}
        {...props}
      >
        {tab.base64Preview ? (
          <Image
            style={{ width: '100%', height: '100%' }}
            source={{ uri: `data:image/png;base64,${tab.base64Preview}` }}
          />
        ) : (
          <Text>{tab.type}</Text>
        )}
      </AnimatedBox>
    </TapGestureHandler>
  )
}

export default TabPreview
