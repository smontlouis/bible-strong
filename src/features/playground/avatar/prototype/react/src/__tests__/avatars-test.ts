import { defaultExpression } from '../presets'
import { createInitialSequences } from '../sequences'
import {
  applyAvatarEyeDefaults,
  cloneAvatarBehavior,
  createAvatar,
  defaultAvatarEyes,
  parseAvatarEyeDefaults,
  resolveAvatarBehavior,
} from '../avatars'
import { initialExpressions } from '../presets'

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

  it('sanitizes partial persisted values', () => {
    const result = parseAvatarEyeDefaults({ widthLeft: 42, heightRight: Number.NaN })

    expect(result.widthLeft).toBe(42)
    expect(result.heightRight).toBe(defaultAvatarEyes.heightRight)
    expect(result.spacing).toBe(defaultAvatarEyes.spacing)
  })
})

describe('avatar behavior library', () => {
  const base = {
    expressions: initialExpressions,
    sequences: createInitialSequences(),
  }

  it('inherits the base library until the avatar owns a customization', () => {
    const avatar = createAvatar('Strobi')

    expect(resolveAvatarBehavior(avatar, base)).toBe(base)
  })

  it('clones expressions, animations and nested steps as one independent library', () => {
    const behavior = cloneAvatarBehavior(base)

    expect(behavior).not.toBe(base)
    expect(behavior.expressions).not.toBe(base.expressions)
    expect(behavior.sequences).not.toBe(base.sequences)
    expect(behavior.sequences[0].steps).not.toBe(base.sequences[0].steps)
    expect(behavior.sequences[0].blink).not.toBe(base.sequences[0].blink)
  })
})
