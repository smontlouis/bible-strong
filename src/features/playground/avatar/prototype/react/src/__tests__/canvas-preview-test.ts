import { applyAvatarEyeDefaults, defaultAvatarEyes } from '../avatars'
import { resolveCanvasPreviewExpression } from '../canvasPreview'
import { defaultExpression } from '../presets'

describe('canvas preview expression', () => {
  it('keeps customized neutral eyes applied while rotating the body preview', () => {
    const eyes = {
      ...defaultAvatarEyes,
      widthLeft: 37,
      positionYLeft: -18,
      leftAngle: 21,
      rightAngle: -21,
    }
    const draggedExpression = { ...defaultExpression, headX: 24, headY: 31 }

    expect(resolveCanvasPreviewExpression(draggedExpression, eyes, true, 'head')).toEqual(
      applyAvatarEyeDefaults(draggedExpression, eyes)
    )
  })

  it('does not compose neutral eyes twice outside body editing', () => {
    const eyes = { ...defaultAvatarEyes, widthLeft: 37 }

    expect(resolveCanvasPreviewExpression(defaultExpression, eyes, false, 'head')).toBe(
      defaultExpression
    )
  })

  it('does not compose customized eyes twice while editing an eye handle', () => {
    const eyes = { ...defaultAvatarEyes, widthLeft: 37 }
    const customizedExpression = applyAvatarEyeDefaults(defaultExpression, eyes)

    expect(resolveCanvasPreviewExpression(customizedExpression, eyes, true, 'eyes')).toBe(
      customizedExpression
    )
  })
})
