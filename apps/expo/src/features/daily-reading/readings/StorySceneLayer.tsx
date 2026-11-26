import { Blur, Canvas, Image as SkiaImage, Skia, type SkImage } from '@shopify/react-native-skia'
import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated'
import {
  focusTransformOf,
  layerBoxOf,
  travelOf,
  useTiltStyle,
  verticalShiftOf,
  type SceneDepth,
  type SceneStage,
  type Tilt,
} from './storySceneMotion'

export type StorySceneLayerProps = {
  uri: string
  depth: SceneDepth
  /** 0 on the verse and the blessing, 1 once the eye is in the scene. */
  focus: SharedValue<number>
  /** The same, as a state: the web animates it with CSS. */
  focused: boolean
  /** Where the eye stands in the scene, from -1 (its left edge) to 1 (its right one). */
  camera: SharedValue<number>
  /** The same, as a state, for the web. */
  cameraAt: number
  /** The stage, once measured: the layer is drawn on a square as tall as it. */
  stage: SceneStage | null
  tilt: SharedValue<Tilt>
  /** The reader asked for less motion: the layer neither moves nor comes closer, it only blurs. */
  still: boolean
  /** A cut-out layer, transparent around its shapes. */
  cutOut?: boolean
}

/** The decoded pictures, shared by the two pictures of a scene and kept for the last scenes. */
const pictures = new Map<string, Promise<SkImage | null>>()
const KEPT_PICTURES = 6

/**
 * Skia decodes the file expo-image already keeps, so the scene is not downloaded twice; the
 * address itself when the cache has no path for it.
 */
const loadPicture = (uri: string) => {
  const known = pictures.get(uri)
  if (known) return known
  const loading = (async () => {
    let source = uri
    try {
      if (await Image.prefetch(uri, 'disk')) {
        const path = await Image.getCachePathAsync(uri)
        if (path) source = path.startsWith('file://') ? path : `file://${path}`
      }
    } catch {
      // The address then.
    }
    const data = await Skia.Data.fromURI(source)
    return Skia.Image.MakeImageFromEncoded(data)
  })().catch(() => null)
  pictures.set(uri, loading)
  if (pictures.size > KEPT_PICTURES) pictures.delete(pictures.keys().next().value!)
  return loading
}

const usePicture = (uri: string) => {
  const [loaded, setLoaded] = useState<{ uri: string; picture: SkImage } | null>(null)
  useEffect(() => {
    let current = true
    void loadPicture(uri).then(picture => {
      if (current && picture) setLoaded({ uri, picture })
    })
    return () => {
      current = false
    }
  }, [uri])
  return loaded
}

/**
 * One layer of the scene on iOS and Android: views move it with the tilt and bring it closer,
 * and Skia draws its picture with a blur that really grows, frame after frame, as the eye goes
 * into the scene. expo-image shows it until Skia has decoded it.
 */
const StorySceneLayer = ({
  uri,
  depth,
  focus,
  camera,
  stage,
  tilt,
  still,
  cutOut = false,
}: StorySceneLayerProps) => {
  const tiltStyle = useTiltStyle(tilt, depth.shift, depth.direction, still, verticalShiftOf(depth))
  const travel = travelOf(depth, stage)
  const focusStyle = useAnimatedStyle(() =>
    focusTransformOf(depth, focus.get(), still, camera.get(), travel)
  )
  const blur = useDerivedValue(() => depth.blur + (depth.focusBlur - depth.blur) * focus.get())
  const loaded = usePicture(uri)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  // Another scene shows through expo-image until its own picture is decoded.
  const picture = loaded?.uri === uri ? loaded.picture : null
  const ready = picture && size
  return (
    <Animated.View
      pointerEvents="none"
      style={[stage ? layerBoxOf(stage) : StyleSheet.absoluteFill, tiltStyle]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, focusStyle]}
        onLayout={({ nativeEvent }) =>
          setSize(previous =>
            previous?.width === nativeEvent.layout.width &&
            previous.height === nativeEvent.layout.height
              ? previous
              : { width: nativeEvent.layout.width, height: nativeEvent.layout.height }
          )
        }
      >
        {/* An opaque background stays under its Skia copy; a cut-out one would show twice. */}
        {!ready || !cutOut ? (
          <Image
            source={{ uri }}
            contentFit="cover"
            transition={{ duration: 500, effect: 'cross-dissolve' }}
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {ready ? (
          <Canvas style={StyleSheet.absoluteFill}>
            <SkiaImage
              image={picture}
              fit="cover"
              x={0}
              y={0}
              width={size.width}
              height={size.height}
            >
              <Blur blur={blur} mode={cutOut ? 'decal' : 'clamp'} />
            </SkiaImage>
          </Canvas>
        ) : null}
      </Animated.View>
    </Animated.View>
  )
}

export default StorySceneLayer
