import { defaultExpression } from '../presets'
import { applyAvatarEyeDefaults, defaultAvatarEyes, parseAvatarEyeDefaults } from '../avatars'

describe('avatar eye defaults', () => {
  it('keeps the historical rendering when using default values', () => {
    expect(applyAvatarEyeDefaults(defaultExpression, defaultAvatarEyes)).toEqual(defaultExpression)
  })

  it('composes avatar defaults as variations around the neutral expression', () => {
    const expression = { ...defaultExpression, widthLeft: 28, positionYLeft: 5 }
    const eyes = { ...defaultAvatarEyes, widthLeft: 30, positionYLeft: -12 }

    const result = applyAvatarEyeDefaults(expression, eyes)

    expect(result.widthLeft).toBe(38)
    expect(result.positionYLeft).toBe(0)
    expect(expression.widthLeft).toBe(28)
  })

  it('migrates the former shared eye position without changing its placement', () => {
    const result = parseAvatarEyeDefaults(undefined, { x: 6, y: -4 })

    expect(result.positionXLeft).toBe(6)
    expect(result.positionXRight).toBe(6)
    expect(result.positionYLeft).toBe(-11)
    expect(result.positionYRight).toBe(-11)
  })

  it('sanitizes partial persisted values', () => {
    const result = parseAvatarEyeDefaults({ widthLeft: 42, heightRight: Number.NaN })

    expect(result.widthLeft).toBe(42)
    expect(result.heightRight).toBe(defaultAvatarEyes.heightRight)
    expect(result.spacing).toBe(defaultAvatarEyes.spacing)
  })
})
