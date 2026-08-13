import type { BodyMotion, Expression, EyeMotion } from './geometry'

export const eyeMotionModes = ['none', 'microSaccades', 'shake'] as const
export const bodyMotionModes = ['none', 'slowDrift', 'shake'] as const
const eyeMotionSet = new Set<string>(eyeMotionModes)
const bodyMotionSet = new Set<string>(bodyMotionModes)
export const isEyeMotion = (value: unknown): value is EyeMotion =>
  typeof value === 'string' && eyeMotionSet.has(value)
export const isBodyMotion = (value: unknown): value is BodyMotion =>
  typeof value === 'string' && bodyMotionSet.has(value)

const smoothstep = (value: number) => value * value * (3 - 2 * value)
const hash = (value: number) => {
  const raw = Math.sin(value * 127.1 + 311.7) * 43758.5453
  return (raw - Math.floor(raw)) * 2 - 1
}

const expressionSeed = (expression: Expression) =>
  expression.headX * 0.71 + expression.headY * 1.13 + expression.headZ * 1.37

const smoothNoise = (elapsedMs: number, axis: number, seed: number, interval: number) => {
  const progress = elapsedMs / interval
  const step = Math.floor(progress)
  const blend = smoothstep(progress - step)
  const previous = hash(step * 3 + axis + seed)
  const next = hash((step + 1) * 3 + axis + seed)
  return previous + (next - previous) * blend
}

const saccade = (elapsedMs: number, axis: number, seed: number) => {
  const interval = 1100
  const warpedTime = elapsedMs + Math.sin(elapsedMs / 1700 + seed) * 280
  const step = Math.floor(warpedTime / interval)
  const progress = (((warpedTime % interval) + interval) % interval) / interval
  const blend = smoothstep(Math.min(progress / 0.09, 1))
  const previous = hash((step - 1) * 2 + axis + seed)
  const next = hash(step * 2 + axis + seed)
  const fadeIn = Math.min(elapsedMs / 240, 1)
  return (previous + (next - previous) * blend) * fadeIn
}

export const hasAmbientMotion = (expression: Expression) =>
  expression.eyeMotion !== 'none' || expression.bodyMotion !== 'none'

export const ambientBodyOffset = (expression: Expression, elapsedMs: number) => {
  const seed = expressionSeed(expression)
  if (expression.bodyMotion === 'slowDrift') {
    return {
      x: smoothNoise(elapsedMs, 3, seed, 2900) * 1.45,
      y: smoothNoise(elapsedMs, 4, seed, 3700) * 1.1,
    }
  }
  if (expression.bodyMotion === 'shake') {
    const time = elapsedMs / 1000
    return {
      x: (Math.sin(time * 31) + Math.sin(time * 53) * 0.45) * 1.35,
      y: (Math.sin(time * 37) + Math.sin(time * 61) * 0.4) * 1.1,
    }
  }
  return { x: 0, y: 0 }
}

export const applyAmbientMotion = (expression: Expression, elapsedMs: number): Expression => {
  const next = { ...expression }
  const seed = expressionSeed(expression)

  if (expression.eyeMotion === 'microSaccades') {
    const x = saccade(elapsedMs, 0, seed) * 1.5
    const y = saccade(elapsedMs, 1, seed) * 0.9
    next.positionXLeft += x
    next.positionXRight += x
    next.positionYLeft += y
    next.positionYRight += y
  } else if (expression.eyeMotion === 'shake') {
    const time = elapsedMs / 1000
    const x = (Math.sin(time * 47) + Math.sin(time * 71) * 0.45) * 1.2
    const y = (Math.sin(time * 59) + Math.sin(time * 83) * 0.4) * 0.8
    next.positionXLeft += x
    next.positionXRight += x
    next.positionYLeft += y
    next.positionYRight += y
  }

  if (expression.bodyMotion === 'slowDrift') {
    next.headX += smoothNoise(elapsedMs, 0, seed, 2600) * 0.8
    next.headY += smoothNoise(elapsedMs, 1, seed, 3300) * 1.15
    next.headZ += smoothNoise(elapsedMs, 2, seed, 4100) * 0.45
  } else if (expression.bodyMotion === 'shake') {
    const time = elapsedMs / 1000
    next.headX += (Math.sin(time * 31) + Math.sin(time * 53) * 0.45) * 1.15
    next.headY += (Math.sin(time * 37) + Math.sin(time * 61) * 0.4) * 1.35
    next.headZ += Math.sin(time * 43) * 0.7
  }

  return next
}
