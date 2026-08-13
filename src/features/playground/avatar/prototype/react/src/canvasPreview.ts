import { applyAvatarEyeDefaults, type AvatarEyeDefaults } from './avatars'
import { type Expression } from './geometry'

export type CanvasPreviewTarget = 'head' | 'eyes'

export const resolveCanvasPreviewExpression = (
  expression: Expression,
  avatarEyes: AvatarEyeDefaults,
  bodyEditing: boolean,
  target: CanvasPreviewTarget
) =>
  bodyEditing && target === 'head' ? applyAvatarEyeDefaults(expression, avatarEyes) : expression
