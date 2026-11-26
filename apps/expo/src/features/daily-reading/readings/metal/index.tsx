/**
 * Adapted from the Metal component of reacticx (MIT License, Copyright (c) 2026 rit3zh,
 * https://github.com/rit3zh/reacticx), 2026-11-26.
 *
 * A metallic ring drawn by Skia around what it holds, its reflections turning slowly. Changed for
 * the app: no manual memoization (the React Compiler does it), shared values read and written
 * through get and set, never during render. The web draws a CSS version (index.web.tsx).
 */
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia'
import { Children, isValidElement, useEffect, useState } from 'react'
import { AppState, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated'
import { MAX_STOPS, METAL_SHADER } from './conf'
import { CONF, DEFAULT_COLORS } from './const'
import { degreesToRadians, resolvePalette, resolveRadius } from './helper'
import type { MetalProps } from './types'

const SHADER = Skia.RuntimeEffect.Make(METAL_SHADER)!

const Metal = ({
  children,
  colors = DEFAULT_COLORS,
  borderWidth = CONF.borderWidth,
  borderRadius,
  softness = CONF.softness,
  opacity = CONF.opacity,
  glow = CONF.glow,
  sheen = CONF.sheen,
  speed = CONF.speed,
  bands = CONF.bands,
  sharpness = CONF.sharpness,
  distortion = CONF.distortion,
  noiseScale = CONF.noiseScale,
  bevel = CONF.bevel,
  contrast = CONF.contrast,
  direction = CONF.direction,
  paused = false,
  style,
}: MetalProps) => {
  const [measured, setMeasured] = useState({ width: 0, height: 0 })

  const time = useSharedValue(0)
  const pace = useSharedValue(speed)
  useEffect(() => {
    pace.set(speed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed])

  // The ring rests while the app is in the background.
  const [backgrounded, setBackgrounded] = useState(false)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', status =>
      setBackgrounded(status !== 'active')
    )
    return () => subscription.remove()
  }, [])
  const running = !paused && !backgrounded

  const frames = useFrameCallback(frame => {
    'worklet'
    if (frame.timeSincePreviousFrame != null) {
      time.set(time.get() + (frame.timeSincePreviousFrame / 1000) * pace.get())
    }
  }, false)
  useEffect(() => {
    frames.setActive(running)
  }, [frames, running])

  const palette = resolvePalette(colors)
  const stops = Math.min(Math.max(colors.length, 2), MAX_STOPS)
  // The radius the child already rounds by, so wrapping a circle needs no extra prop.
  const [child] = Children.toArray(children)
  const childStyle = isValidElement<{ style?: StyleProp<ViewStyle> }>(child)
    ? child.props.style
    : undefined
  const radius = resolveRadius(borderRadius, measured.width, measured.height, childStyle, style)
  const bleed = glow > 0 ? Math.max(borderWidth * 4, 8) : 0
  const directionRadians = degreesToRadians(direction)
  const canvasWidth = measured.width + bleed * 2
  const canvasHeight = measured.height + bleed * 2

  const uniforms = useDerivedValue(() => ({
    u_resolution: [canvasWidth, canvasHeight] as [number, number],
    u_time: time.get(),
    u_colors: palette,
    u_shape: [borderWidth, radius, softness, opacity] as [number, number, number, number],
    u_pattern: [stops, bands, sharpness, directionRadians] as [number, number, number, number],
    u_surface: [distortion, noiseScale, bevel, contrast] as [number, number, number, number],
    u_light: [sheen, glow, bleed] as [number, number, number],
  }))

  return (
    <View
      style={style}
      onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout
        setMeasured(previous =>
          previous.width === width && previous.height === height ? previous : { width, height }
        )
      }}
    >
      {children}
      {measured.width > 0 && measured.height > 0 ? (
        <View pointerEvents="none" style={[styles.overlay, { top: -bleed, left: -bleed }]}>
          <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
            <Fill>
              <Shader source={SHADER} uniforms={uniforms} />
            </Fill>
          </Canvas>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute' },
})

export { METAL_COLORS } from './const'

export default Metal
