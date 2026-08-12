import { useEffect, useId, useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { ClipPath, Defs, G, Path, Svg } from 'react-native-svg'

import Box from '~common/ui/Box'
import {
  BLOB_RING,
  centroid,
  EYE_HALF,
  EXPRESSIONS,
  HEAD_CENTER,
  HEAD_PATH,
  horizontalSpan,
  interpolateRing,
  ringPath,
  type AvatarExpression,
  type AvatarRing,
} from './grokBotGeometry'

export type AvatarGaze = {
  x: number
  y: number
}

export type AvatarEyeStyle = 'capsule' | 'dot' | 'smile'
export type AvatarMood = 'neutral' | 'warm' | 'curious' | 'focused'
export type AvatarActivity = 'idle' | 'listening' | 'thinking' | 'speaking'
export type AvatarVariant = 'orb' | 'halo' | 'pebble'

export type BibleStrongAvatarProps = {
  activity?: AvatarActivity
  autoBlink?: boolean
  blinkKey?: number
  expression?: number
  eyeScale?: number
  eyeStyle?: AvatarEyeStyle
  gaze?: AvatarGaze
  mood?: AvatarMood
  onPress?: () => void
  size?: number
  turn?: number
  variant?: AvatarVariant
}

type Spring = {
  target: number
  value: number
  velocity: number
}

type Runtime = {
  blinkAt: number | null
  from: AvatarExpression
  gaze: AvatarGaze
  lastFrame: number
  morph: Spring
  nextBlink: number
  to: AvatarExpression
}

const palette: Record<AvatarVariant, { body: string; eyes: string }> = {
  orb: { body: '#5B7FE5', eyes: '#071333' },
  halo: { body: '#FFFFFF', eyes: '#050505' },
  pebble: { body: '#111827', eyes: '#FFFFFF' },
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const smoothstep = (value: number) => value * value * (3 - 2 * value)

const stepSpring = (spring: Spring, frequency: number, damping: number, delta: number) => {
  spring.velocity +=
    (-2 * damping * frequency * spring.velocity -
      frequency * frequency * (spring.value - spring.target)) *
    delta
  spring.value += spring.velocity * delta

  if (!Number.isFinite(spring.value) || !Number.isFinite(spring.velocity)) {
    spring.value = spring.target
    spring.velocity = 0
  }
}

const getCurrentExpression = (runtime: Runtime): AvatarExpression => {
  const progress = clamp(runtime.morph.value, 0, 1)
  return [
    interpolateRing(runtime.from[0], runtime.to[0], progress),
    interpolateRing(runtime.from[1], runtime.to[1], progress),
  ]
}

const getBlinkScale = (now: number, blinkAt: number | null) => {
  if (blinkAt === null) return 1
  const progress = (now - blinkAt) / 320
  if (progress < 0 || progress >= 1) return 1
  return Math.max(progress < 0.42 ? 1 - progress / 0.42 : (progress - 0.42) / 0.58, 0.04)
}

const getLegacyExpression = (eyeStyle: AvatarEyeStyle, mood: AvatarMood) => {
  if (mood === 'curious') return 3
  if (mood === 'focused') return 7
  if (mood === 'warm') return 2
  if (eyeStyle === 'dot') return 3
  if (eyeStyle === 'smile') return 4
  return 0
}

const getVerticalBounds = (ring: AvatarRing) => {
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const point of ring) {
    top = Math.min(top, point[1])
    bottom = Math.max(bottom, point[1])
  }
  return { bottom, top }
}

const BODY_BOUNDS = getVerticalBounds(BLOB_RING)

const projectEyes = ({
  blinkScale,
  expression,
  eyeScale,
  gaze,
  turnAngle,
}: {
  blinkScale: number
  expression: AvatarExpression
  eyeScale: number
  gaze: AvatarGaze
  turnAngle: number | null
}) => {
  const centers = [centroid(expression[0]), centroid(expression[1])] as const
  let leftHalfWidth = 0
  let rightHalfWidth = 0

  for (const point of expression[0])
    leftHalfWidth = Math.max(leftHalfWidth, Math.abs(point[0] - centers[0][0]))
  for (const point of expression[1])
    rightHalfWidth = Math.max(rightHalfWidth, Math.abs(point[0] - centers[1][0]))

  const centerDistance = Math.abs(centers[1][0] - centers[0][0])
  const separationLimit =
    leftHalfWidth + rightHalfWidth > 0.5
      ? clamp((centerDistance - 5) / (leftHalfWidth + rightHalfWidth), 0.35, 4)
      : 4
  const requestedScale = Math.min(clamp(eyeScale, 0.2, 2), separationLimit)

  return expression.map((ring, index) => {
    const [sourceX, sourceY] = centers[index]
    let faceCenterX = HEAD_CENTER
    let eyeOffsetX = sourceX - HEAD_CENTER
    let perspectiveX = 1
    let isVisible = true
    let depthConstraint = 1

    if (turnAngle !== null) {
      const projectedY = clamp(sourceY, BODY_BOUNDS.top + 2, BODY_BOUNDS.bottom - 2)
      const [left, right] = horizontalSpan(BLOB_RING, projectedY)
      const radius = Math.max((right - left) / 2, 12)
      faceCenterX = (left + right) / 2
      const baseLongitude = Math.asin(clamp(eyeOffsetX / radius, -1, 1))
      const longitude = baseLongitude + turnAngle
      const depth = Math.cos(longitude)
      const baseDepth = Math.max(Math.cos(baseLongitude), 0.02)
      isVisible = depth > 0.02
      perspectiveX = Math.max(depth, 0.02) / baseDepth
      eyeOffsetX = radius * Math.sin(longitude)
      depthConstraint = smoothstep(clamp(depth / 0.5, 0, 1))
    }

    const scaleX = clamp(perspectiveX * requestedScale, 0.02, 2.4)
    const scaleY = clamp(blinkScale * requestedScale, 0.02, 2.4)
    const verticalHalf = EYE_HALF * scaleY + 2
    const finalY = clamp(
      sourceY + gaze.y,
      BODY_BOUNDS.top + verticalHalf,
      BODY_BOUNDS.bottom - verticalHalf
    )
    let legalLeft = Number.NEGATIVE_INFINITY
    let legalRight = Number.POSITIVE_INFINITY

    for (let pointIndex = 0; pointIndex < ring.length; pointIndex += 2) {
      const scaledOffsetX = (ring[pointIndex][0] - sourceX) * scaleX
      const [bodyLeft, bodyRight] = horizontalSpan(
        BLOB_RING,
        finalY + (ring[pointIndex][1] - sourceY) * scaleY
      )
      legalLeft = Math.max(legalLeft, bodyLeft - scaledOffsetX)
      legalRight = Math.min(legalRight, bodyRight - scaledOffsetX)
    }

    const desiredX = faceCenterX + eyeOffsetX + gaze.x
    const constrainedX =
      legalLeft <= legalRight
        ? clamp(desiredX, legalLeft, legalRight)
        : (legalLeft + legalRight) / 2
    const finalX = constrainedX + (desiredX - constrainedX) * (1 - depthConstraint)

    return {
      path: ringPath(ring),
      visible: isVisible,
      transform: `translate(${finalX.toFixed(2)} ${finalY.toFixed(2)}) scale(${scaleX.toFixed(4)} ${scaleY.toFixed(4)}) translate(${(-sourceX).toFixed(2)} ${(-sourceY).toFixed(2)})`,
    }
  })
}

const BibleStrongAvatar = ({
  autoBlink = true,
  blinkKey = 0,
  expression,
  eyeScale = 1,
  eyeStyle = 'capsule',
  gaze = { x: 0, y: 0 },
  mood = 'neutral',
  onPress,
  size = 168,
  turn = 0,
  variant = 'orb',
}: BibleStrongAvatarProps) => {
  const resolvedExpression = clamp(
    Math.round(expression ?? getLegacyExpression(eyeStyle, mood)),
    0,
    EXPRESSIONS.length - 1
  )
  const initialExpression = EXPRESSIONS[resolvedExpression]
  const runtime = useRef<Runtime>({
    blinkAt: null,
    from: initialExpression,
    gaze: { x: 0, y: 0 },
    lastFrame: 0,
    morph: { target: 1, value: 1, velocity: 0 },
    nextBlink: Date.now() + 6000 + Math.random() * 8000,
    to: initialExpression,
  })
  const gazeTarget = useRef(gaze)
  const [frameTime, setFrameTime] = useState(Date.now())
  const clipId = `avatar-head-${useId().replace(/[:]/g, '')}`
  const colors = palette[variant]

  gazeTarget.current = gaze

  useEffect(() => {
    const current = getCurrentExpression(runtime.current)
    runtime.current.from = current
    runtime.current.to = EXPRESSIONS[resolvedExpression]
    runtime.current.morph = { target: 1, value: 0, velocity: 0 }
  }, [resolvedExpression])

  useEffect(() => {
    if (blinkKey === 0) return
    runtime.current.blinkAt = Date.now()
  }, [blinkKey])

  useEffect(() => {
    let animationFrame: number

    const animate = (now: number) => {
      const current = runtime.current
      const delta =
        current.lastFrame === 0 ? 1 / 60 : Math.min((now - current.lastFrame) / 1000, 0.1)
      current.lastFrame = now
      const steps = Math.max(1, Math.ceil(delta / (1 / 120)))
      const step = delta / steps
      for (let index = 0; index < steps; index += 1) stepSpring(current.morph, 7, 1, step)

      const gazeEase = 1 - Math.exp(60 * Math.log(1 - 0.09) * delta)
      const targetX = clamp(gazeTarget.current.x, -1, 1) * 13.2
      const targetY = clamp(gazeTarget.current.y, -1, 1) * 8.4
      current.gaze.x += (targetX - current.gaze.x) * gazeEase
      current.gaze.y += (targetY - current.gaze.y) * gazeEase

      const clock = Date.now()
      if (autoBlink && clock >= current.nextBlink) {
        current.blinkAt = clock
        current.nextBlink = clock + 6000 + Math.random() * 8000
      }
      if (current.blinkAt !== null && clock - current.blinkAt >= 320) current.blinkAt = null

      setFrameTime(clock)
      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [autoBlink])

  const displayedExpression = getCurrentExpression(runtime.current)
  const blinkScale = getBlinkScale(frameTime, runtime.current.blinkAt)
  const turnAngle = Math.abs(turn) < 0.001 ? null : turn
  const eyes = projectEyes({
    blinkScale,
    expression: displayedExpression,
    eyeScale,
    gaze: runtime.current.gaze,
    turnAngle,
  })

  return (
    <Box size={size * 1.12} center overflow="visible">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Avatar Bible Strong"
        accessibilityHint="Déclenche un clignement"
        onPress={() => {
          runtime.current.blinkAt = Date.now()
          onPress?.()
        }}
      >
        <Svg width={size} height={size} viewBox="-15 -15 259 259">
          <Defs>
            <ClipPath id={clipId}>
              <Path d={HEAD_PATH} />
            </ClipPath>
          </Defs>
          <Path d={HEAD_PATH} fill={colors.body} />
          <G clipPath={`url(#${clipId})`}>
            {eyes.map((eye, index) => (
              <Path
                key={index}
                d={eye.path}
                fill={colors.eyes}
                opacity={eye.visible ? 1 : 0}
                transform={eye.transform}
              />
            ))}
          </G>
        </Svg>
      </Pressable>
    </Box>
  )
}

export default BibleStrongAvatar
