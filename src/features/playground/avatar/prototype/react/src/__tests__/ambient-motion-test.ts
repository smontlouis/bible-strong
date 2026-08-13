import { ambientBodyOffset, applyAmbientMotion, hasAmbientMotion } from '../ambientMotion'
import { defaultExpression } from '../presets'

describe('perpetual expression motion', () => {
  it('leaves a motionless expression unchanged', () => {
    const expression = { ...defaultExpression }

    expect(hasAmbientMotion(expression)).toBe(false)
    expect(applyAmbientMotion(expression, 500)).toEqual(expression)
  })

  it('moves both eyes together without mutating the saved expression', () => {
    const expression = { ...defaultExpression, eyeMotion: 'microSaccades' as const }
    const animated = applyAmbientMotion(expression, 500)

    expect(animated.positionXLeft - expression.positionXLeft).toBeCloseTo(
      animated.positionXRight - expression.positionXRight
    )
    expect(animated.positionYLeft - expression.positionYLeft).toBeCloseTo(
      animated.positionYRight - expression.positionYRight
    )
    expect(animated.positionXLeft).not.toBe(expression.positionXLeft)
    expect(expression.positionXLeft).toBe(defaultExpression.positionXLeft)
  })

  it('adds body motion without changing eye placement', () => {
    const expression = { ...defaultExpression, bodyMotion: 'shake' as const }
    const animated = applyAmbientMotion(expression, 500)

    expect(animated.headY).not.toBe(expression.headY)
    expect(animated.positionXLeft).toBe(expression.positionXLeft)
    expect(animated.positionYRight).toBe(expression.positionYRight)
  })

  it('visibly offsets a symmetric body when it shakes', () => {
    const expression = { ...defaultExpression, bodyMotion: 'shake' as const }

    expect(ambientBodyOffset(expression, 500)).not.toEqual({ x: 0, y: 0 })
  })

  it('visibly offsets a symmetric body during slow drift', () => {
    const expression = { ...defaultExpression, bodyMotion: 'slowDrift' as const }

    expect(ambientBodyOffset(expression, 1500)).not.toEqual({ x: 0, y: 0 })
  })
})
