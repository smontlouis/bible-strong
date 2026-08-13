import { createAvatar } from '../avatars'
import { parse } from '@babel/parser'
import {
  createAvatarExportPayload,
  generateJavaScriptAvatarHtml,
  generateJavaScriptAvatarModule,
  generateJavaScriptAvatarPackage,
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
    expect(Object.keys(payload.expressions).sort()).toEqual(
      [
        ...new Set(animations.flatMap(animation => animation.steps.map(step => step.expressionId))),
      ].sort()
    )
    expect(payload).not.toHaveProperty('frames')
    expect(payload.avatar.name).toBe('Strobi')
  })

  it('generates a standalone JavaScript module without a Web Component', () => {
    const source = generateJavaScriptAvatarModule(payload)

    expect(source).toContain('export function createAvatar')
    expect(source).toContain('play(animationName)')
    expect(source).toContain('export const availableAnimations')
    expect(source).toContain('pausedRemainingMs')
    expect(source).toContain('pausedBlinkDelay')
    expect(source).toContain('pausedBlink')
    expect(source).toContain('step.transition')
    expect(source).toContain('stepIndex = 0')
    expect(source).not.toContain('customElements.define')
    expect(source).not.toContain("from '")
    expect(() => parse(source, { sourceType: 'module' })).not.toThrow()
  })

  it('uses the Studio geometry engine to render interpolated transition frames', () => {
    const source = generateJavaScriptAvatarModule(payload)

    expect(source).toContain('AvatarProceduralEngine')
    expect(source).toContain('expressionFields')
    expect(source).toContain('requestAnimationFrame')
    expect(source).not.toContain('avatarFrameIn')
  })

  it('generates an HTML demo that works when opened directly from the filesystem', () => {
    const source = generateJavaScriptAvatarHtml(payload)

    expect(source).not.toContain("import { createAvatar } from './avatar.js'")
    expect(source).toContain('function createAvatar')
    expect(source).toContain('avatar.play("idle")')
  })

  it('generates an interactive playground for the exported animations', () => {
    const source = generateJavaScriptAvatarHtml(payload)

    expect(source).toContain('id="animation-list"')
    expect(source).toContain('id="play-animation"')
    expect(source).toContain('id="pause-animation"')
    expect(source).toContain('id="stop-animation"')
    expect(source).toContain('availableAnimations.forEach')
    expect(source).toContain('avatar.play(activeAnimation)')
    expect(source).toContain('avatar.pause()')
    expect(source).toContain('avatar.stop()')
    expect(source).toContain("createAvatar('#avatar'")
  })

  it('localizes the exported playground', () => {
    const source = generateJavaScriptAvatarHtml(payload, 'fr')

    expect(source).toContain('<html lang="fr">')
    expect(source).toContain('Choisissez une animation exportée')
    expect(source).toContain('▶ Lire')
    expect(source).toContain('En pause')
  })

  it('keeps user-authored names and descriptions inside the generated script', () => {
    const source = generateJavaScriptAvatarHtml({
      ...payload,
      avatar: { ...payload.avatar, name: '</title><script>alert(1)</script>' },
    })

    expect(source).not.toContain('</title><script>alert(1)</script>')
    expect(source).toContain('&lt;/title&gt;')
    expect(source).toContain('\\u003c/script>')
  })

  it('packages the direct-open demo and reusable module together', async () => {
    const archive = new Uint8Array(await generateJavaScriptAvatarPackage(payload).arrayBuffer())
    const contents = new TextDecoder().decode(archive)

    expect(contents).toContain('index.html')
    expect(contents).toContain('avatar.js')
  })

  it('generates a self-contained typed React component', () => {
    const source = generateReactAvatarComponent(payload)

    expect(source).toContain("from 'react'")
    expect(source).toContain('export type AnimationName')
    expect(source).toContain('animation?: AnimationName')
    expect(source).toContain('forwardRef<AvatarHandle, AvatarProps>')
    expect(source).toContain('AvatarProceduralEngine')
    expect(source).toContain('runtime.createAvatar(host.current')
    expect(source).not.toContain('@ts-nocheck')
    expect(source).not.toContain('avatarFrameIn')
    expect(source).not.toContain("from 'motion")
    expect(() =>
      parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] })
    ).not.toThrow()
  })
})
