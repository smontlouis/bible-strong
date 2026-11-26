import { Image } from 'expo-image'
import { StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'
import {
  FOCUS_CSS_EASING,
  FOCUS_DURATION,
  focusTransformOf,
  layerBoxOf,
  travelOf,
  useTiltStyle,
  verticalShiftOf,
} from './storySceneMotion'
import type { StorySceneLayerProps } from './StorySceneLayer'

/**
 * One layer of the scene on the web and in the desktop app: the browser animates its blur (a
 * CSS filter) and its closeness with CSS transitions, and the pointer moves it as a tilt would.
 * No Skia here, which the web would have to download.
 */
const StorySceneLayer = ({
  uri,
  depth,
  focused,
  cameraAt,
  stage,
  tilt,
  still,
}: StorySceneLayerProps) => {
  const tiltStyle = useTiltStyle(tilt, depth.shift, depth.direction, still, verticalShiftOf(depth))
  const amount = focused ? 1 : 0
  return (
    <Animated.View
      pointerEvents="none"
      style={[stage ? layerBoxOf(stage) : StyleSheet.absoluteFill, tiltStyle]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            ...focusTransformOf(depth, amount, still, cameraAt, travelOf(depth, stage)),
            filter: `blur(${depth.blur + (depth.focusBlur - depth.blur) * amount}px)`,
            transitionProperty: ['transform', 'filter'],
            transitionDuration: FOCUS_DURATION,
            transitionTimingFunction: FOCUS_CSS_EASING,
          },
        ]}
      >
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={{ duration: 500, effect: 'cross-dissolve' }}
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </Animated.View>
  )
}

export default StorySceneLayer
