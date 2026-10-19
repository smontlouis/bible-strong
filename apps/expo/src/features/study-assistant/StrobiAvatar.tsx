import { useEffect, useId, useRef, useState } from 'react'
import { AccessibilityInfo } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg'
import {
  advanceAvatarPlayback,
  applyAmbientMotion,
  playAvatarAnimation,
  renderAvatarDefinition,
  renderAvatarExpression,
  sampleAvatarFrame,
  validateAvatarDefinition,
  type AvatarDefinition,
  type AvatarFrameSnapshot,
  type AvatarPlaybackState,
} from '@bible-strong/avatar-core'
import strobiDefinition from './strobi.avatar.json'

export type StrobiAnimation = 'idle' | 'sleeping' | 'excited' | 'thinking' | 'listening'

const validated = validateAvatarDefinition(strobiDefinition)
if (!validated.ok) throw new Error(`Invalid avatar definition: ${validated.errors[0]?.message}`)
const definition: AvatarDefinition = validated.value

// A body node is drawn behind or in front of the head depending on the pose.
const layers = Array.from({ length: definition.body.nodes.length + 2 }, (_, index) => index)
// The geometry is sampled on the JS thread: half the display rate keeps the motion fluid
// at this size without competing with the reader.
const FRAME_MS = 1000 / 30

const AnimatedPath = Animated.createAnimatedComponent(Path)

// The grey of a colour at the same lightness, for the muted avatar.
const toGrey = (color: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color
  const value = parseInt(color.slice(1), 16)
  const level = Math.round(
    0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)
  )
  return `rgb(${level}, ${level}, ${level})`
}

// A fill that fades to its grey as the avatar is muted.
type Fill = { color: string; grey: string; muted: SharedValue<number> }

const fillOf = ({ color, grey, muted }: Fill) => {
  'worklet'
  return interpolateColor(muted.get(), [0, 1], [color, grey])
}

function ShapePath({ d, fill }: { d: SharedValue<string>; fill?: Fill }) {
  const animatedProps = useAnimatedProps(() =>
    fill ? { d: d.get(), fill: fillOf(fill) } : { d: d.get() }
  )
  return <AnimatedPath animatedProps={animatedProps} />
}

function LayerPath({
  paths,
  index,
  fill,
}: {
  paths: SharedValue<string[]>
  index: number
  fill: Fill
}) {
  const animatedProps = useAnimatedProps(() => ({
    d: paths.get()[index] ?? '',
    fill: fillOf(fill),
  }))
  return <AnimatedPath animatedProps={animatedProps} />
}

function EyePath({
  d,
  visible,
  fill,
}: {
  d: SharedValue<string>
  visible: SharedValue<boolean>
  fill: Fill
}) {
  const animatedProps = useAnimatedProps(() => ({
    d: d.get(),
    opacity: visible.get() ? 1 : 0,
    fill: fillOf(fill),
  }))
  return <AnimatedPath animatedProps={animatedProps} />
}

/**
 * React Native renderer for the Strobi definition. The shared core samples one frame on
 * the JS thread; the paths reach the native views through shared values, so the avatar
 * never renders React while it moves.
 */
export default function StrobiAvatar({
  animation,
  size,
  muted = false,
}: {
  animation: StrobiAnimation
  size: number
  /** Greyed out, as a floating button left idle. */
  muted?: boolean
}) {
  const clipId = `${useId().replaceAll(':', '')}-head`
  const [initial] = useState(() => renderAvatarDefinition(definition))
  const [colors, setColors] = useState(initial.colors)
  const head = useSharedValue(initial.geometry.headPath)
  const left = useSharedValue(initial.geometry.leftPath)
  const right = useSharedValue(initial.geometry.rightPath)
  const leftVisible = useSharedValue(initial.geometry.leftVisible)
  const rightVisible = useSharedValue(initial.geometry.rightVisible)
  const back = useSharedValue(initial.geometry.backPaths)
  const front = useSharedValue(initial.geometry.frontPaths)
  const playback = useRef<AvatarPlaybackState | null>(null)
  const sample = useRef<AvatarFrameSnapshot | null>(null)
  const reduceMotion = useRef(false)
  const mutedProgress = useSharedValue(muted ? 1 : 0)

  useEffect(() => {
    mutedProgress.set(withTiming(muted ? 1 : 0, { duration: 300 }))
  }, [muted, mutedProgress])

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      reduceMotion.current = enabled
    })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      reduceMotion.current = enabled
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    const started = playAvatarAnimation(
      definition,
      animation,
      performance.now(),
      sample.current ?? undefined
    )
    if (!started.ok) return
    playback.current = started.value
    let frame = 0
    let renderedAt = 0
    const tick = () => {
      const state = playback.current
      if (!state) return
      const now = performance.now()
      if (now - renderedAt >= FRAME_MS - 1) {
        renderedAt = now
        const environment = { random: Math.random, reduceMotion: reduceMotion.current }
        const next = advanceAvatarPlayback(definition, state, now, environment)
        playback.current = next
        const current = sampleAvatarFrame(definition, next, now, environment)
        sample.current = current
        const expression = environment.reduceMotion
          ? current.expression
          : applyAmbientMotion(current.expression, current.sampledAt)
        const scene = renderAvatarExpression(definition, expression, current.colors, current.blink)
        head.set(scene.geometry.headPath)
        left.set(scene.geometry.leftPath)
        right.set(scene.geometry.rightPath)
        leftVisible.set(scene.geometry.leftVisible)
        rightVisible.set(scene.geometry.rightVisible)
        back.set(scene.geometry.backPaths)
        front.set(scene.geometry.frontPaths)
        // Colours only change with the expression: React follows them, not every frame.
        setColors(previous =>
          previous.body === scene.colors.body && previous.eyes === scene.colors.eyes
            ? previous
            : scene.colors
        )
        if (next.status !== 'playing') return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation])

  const body = { color: colors.body, grey: toGrey(colors.body), muted: mutedProgress }
  const eyes = { color: colors.eyes, grey: toGrey(colors.eyes), muted: mutedProgress }

  return (
    <Svg width={size} height={size} viewBox="-150 -150 300 300" pointerEvents="none">
      <Defs>
        <ClipPath id={clipId}>
          <ShapePath d={head} />
        </ClipPath>
      </Defs>
      {layers.map(index => (
        <LayerPath key={`back-${index}`} paths={back} index={index} fill={body} />
      ))}
      <ShapePath d={head} fill={body} />
      <G clipPath={`url(#${clipId})`}>
        <EyePath d={left} visible={leftVisible} fill={eyes} />
        <EyePath d={right} visible={rightVisible} fill={eyes} />
      </G>
      {layers.map(index => (
        <LayerPath key={`front-${index}`} paths={front} index={index} fill={body} />
      ))}
    </Svg>
  )
}
