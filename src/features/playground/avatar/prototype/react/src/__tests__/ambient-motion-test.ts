import { applyAmbientMotion, hasAmbientMotion } from '../ambientMotion'
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
})
