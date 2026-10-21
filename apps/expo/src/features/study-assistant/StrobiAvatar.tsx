import { useEffect, useId, useState } from 'react'
import { AccessibilityInfo, AppState } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedProps,
  useFrameCallback,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
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
// The geometry is sampled on the UI thread at half the display rate: the motion stays fluid
// at this size for half the work.
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
 * React Native renderer for the Strobi definition. The shared core samples each frame on
 * the UI thread (Bundle Mode forwards `@bible-strong/avatar-core` to it, see babel.config.js)
 * and writes the paths straight into shared values: the JS thread only hears of a change of
 * colours. The frame callback pauses while the app is not active.
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
  const mutedProgress = useSharedValue(muted ? 1 : 0)
  const reduceMotion = useSharedValue(false)
  // What React asks for; the frame callback starts it on its own clock.
  const requestedAnimation = useSharedValue(animation)
  const playedAnimation = useSharedValue<StrobiAnimation | null>(null)
  const playback = useSharedValue<AvatarPlaybackState | null>(null)
  const sample = useSharedValue<AvatarFrameSnapshot | null>(null)
  const renderedAt = useSharedValue(0)
  const shownColors = useSharedValue(initial.colors)

  useEffect(() => {
    mutedProgress.set(withTiming(muted ? 1 : 0, { duration: 300 }))
  }, [muted, mutedProgress])

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => reduceMotion.set(enabled))
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled =>
      reduceMotion.set(enabled)
    )
    return () => subscription.remove()
  }, [reduceMotion])

  useEffect(() => {
    requestedAnimation.set(animation)
  }, [animation, requestedAnimation])

  const frameCallback = useFrameCallback(({ timestamp: now }) => {
    const requested = requestedAnimation.get()
    if (playedAnimation.get() !== requested) {
      playedAnimation.set(requested)
      const started = playAvatarAnimation(definition, requested, now, sample.get() ?? undefined)
      playback.set(started.ok ? started.value : null)
      renderedAt.set(0)
    }
    const state = playback.get()
    if (!state || now - renderedAt.get() < FRAME_MS - 1) return
    renderedAt.set(now)
    const environment = { random: Math.random, reduceMotion: reduceMotion.get() }
    const next = advanceAvatarPlayback(definition, state, now, environment)
    // A finished animation keeps its last frame without sampling again.
    playback.set(next.status === 'playing' ? next : null)
    const current = sampleAvatarFrame(definition, next, now, environment)
    sample.set(current)
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
    const previous = shownColors.get()
    if (previous.body !== scene.colors.body || previous.eyes !== scene.colors.eyes) {
      shownColors.set(scene.colors)
      scheduleOnRN(setColors, scene.colors)
    }
  }, AppState.currentState === 'active')

  // The display may keep firing in background (it does in the simulator): nothing to draw there.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      frameCallback.setActive(state === 'active')
    )
    return () => subscription.remove()
  }, [frameCallback])

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
