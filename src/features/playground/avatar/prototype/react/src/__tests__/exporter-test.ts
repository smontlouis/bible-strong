import { createAvatar } from '../avatars'
import { parse } from '@babel/parser'
import {
  createAvatarExportPayload,
  generateJavaScriptAvatarModule,
  generateReactAvatarComponent,
} from '../exporter'
import { initialExpressions } from '../presets'
import { createInitialSequences } from '../sequences'

describe('avatar export', () => {
  const avatar = createAvatar('Strobi')
  const animations = createInitialSequences().filter(item =>
    ['idle', 'listening'].includes(item.id)
  )
  const payload = createAvatarExportPayload(avatar, initialExpressions, animations)

  it('includes only the selected animations and their referenced expressions', () => {
    expect(Object.keys(payload.animations)).toEqual(['idle', 'listening'])
    expect(Object.keys(payload.frames).sort()).toEqual(
      [
        ...new Set(animations.flatMap(animation => animation.steps.map(step => step.expressionId))),
      ].sort()
    )
    expect(payload.avatar.name).toBe('Strobi')
  })

  it('generates a standalone JavaScript module without a Web Component', () => {
    const source = generateJavaScriptAvatarModule(payload)

    expect(source).toContain('export function createAvatar')
    expect(source).toContain('play(animationName)')
    expect(source).toContain('export const availableAnimations')
    expect(source).toContain('pausedRemainingMs')
    expect(source).toContain('step.transition')
    expect(source).toContain('stepIndex = 0')
    expect(source).not.toContain('customElements.define')
    expect(source).not.toContain("from '")
    expect(() => parse(source, { sourceType: 'module' })).not.toThrow()
  })

  it('generates a self-contained typed React component', () => {
    const source = generateReactAvatarComponent(payload)

    expect(source).toContain("from 'react'")
    expect(source).toContain('export type AnimationName')
    expect(source).toContain('animation?: AnimationName')
    expect(source).toContain('forwardRef<AvatarHandle, AvatarProps>')
    expect(source).toContain('transitionEase(step?.transition')
    expect(source).toContain('setStepIndex(0)')
    expect(source).not.toContain("from 'motion")
    expect(() =>
      parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
    ).not.toThrow()
  })
})
