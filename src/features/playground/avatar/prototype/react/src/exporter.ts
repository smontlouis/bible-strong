import { applyAvatarEyeDefaults, type StudioAvatar } from './avatars'
import type { Expression } from './geometry'
import { proceduralBrowserRuntime } from './proceduralBrowserRuntime'
import type { AvatarSequence } from './sequences'
import { standaloneEngineSource } from './standaloneEngine.generated'
import { createStoredZip } from './storedZip'

export type AvatarExportAnimation = Pick<
  AvatarSequence,
  'name' | 'description' | 'playbackMode' | 'blink'
> & {
  steps: Pick<
    AvatarSequence['steps'][number],
    'expressionId' | 'holdMs' | 'transitionMs' | 'transition'
  >[]
}

export type AvatarExportPayload = {
  version: 1
  avatar: {
    name: string
    surface: StudioAvatar['body']['primary']
    bodyNodes: StudioAvatar['body']['nodes']
    colors: StudioAvatar['colors']
  }
  expressions: Record<string, Expression>
  animations: Record<string, AvatarExportAnimation>
}

const animationKey = (animation: AvatarSequence, used: Set<string>) => {
  const source = animation.builtIn ? animation.id : animation.name
  const base =
    source
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'animation'
  let key = base
  let suffix = 2
  while (used.has(key)) key = `${base}-${suffix++}`
  used.add(key)
  return key
}

export const createAvatarExportPayload = (
  avatar: StudioAvatar,
  expressions: Expression[],
  selectedAnimations: AvatarSequence[]
): AvatarExportPayload => {
  const expressionById = new Map(expressions.map(expression => [expression.id, expression]))
  const referencedIds = new Set(
    selectedAnimations.flatMap(animation => animation.steps.map(step => step.expressionId))
  )
  const exportedExpressions = Object.fromEntries(
    [...referencedIds].flatMap(expressionId => {
      const expression = expressionById.get(expressionId)
      return expression
        ? [[expressionId, applyAvatarEyeDefaults(expression, avatar.eyes)] as const]
        : []
    })
  )
  const usedKeys = new Set<string>()
  const animations = Object.fromEntries(
    selectedAnimations.map(animation => {
      const key = animationKey(animation, usedKeys)
      return [
        key,
        {
          name: animation.name,
          description: animation.description,
          playbackMode: animation.playbackMode,
          blink: { ...animation.blink },
          steps: animation.steps
            .filter(step => exportedExpressions[step.expressionId])
            .map(({ expressionId, holdMs, transitionMs, transition }) => ({
              expressionId,
              holdMs,
              transitionMs,
              transition,
            })),
        } satisfies AvatarExportAnimation,
      ]
    })
  )
  return {
    version: 1,
    avatar: {
      name: avatar.name,
      surface: avatar.body.primary,
      bodyNodes: avatar.body.nodes,
      colors: avatar.colors,
    },
    expressions: exportedExpressions,
    animations,
  }
}

const serializedPayload = (payload: AvatarExportPayload) =>
  JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

const escapedHtml = (value: string) =>
  value.replace(/[&<>"']/g, character => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })

export const generateJavaScriptAvatarModule = (
  payload: AvatarExportPayload
) => `${standaloneEngineSource}
${`const DATA = ${serializedPayload(payload)};`}
${proceduralBrowserRuntime}
export const availableAnimations = Object.freeze(Object.keys(DATA.animations));
export function createAvatar(target, options = {}) { return mountAvatar(target, options); }
export default createAvatar;
`

export const generateJavaScriptAvatarHtml = (payload: AvatarExportPayload) => {
  const firstAnimation = Object.keys(payload.animations)[0]
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapedHtml(payload.avatar.name)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #101419; font-family: system-ui, sans-serif; }
      #avatar { width: min(70vmin, 520px); }
    </style>
  </head>
  <body>
    <div id="avatar"></div>
    <script type="module">
${generateJavaScriptAvatarModule(payload)}
      const avatar = createAvatar('#avatar', { size: '100%', autoplay: false })
      avatar.play(${JSON.stringify(firstAnimation)})
      window.avatar = avatar
    </script>
  </body>
</html>
`
}

export const generateJavaScriptAvatarPackage = (payload: AvatarExportPayload) => {
  return createStoredZip([
    { name: 'index.html', content: generateJavaScriptAvatarHtml(payload) },
    { name: 'avatar.js', content: generateJavaScriptAvatarModule(payload) },
  ])
}

export const generateReactAvatarComponent = (payload: AvatarExportPayload) => {
  const animationNames = Object.keys(payload.animations)
  const animationUnion = animationNames.map(name => JSON.stringify(name)).join(' | ') || 'never'
  const runtimeSource = JSON.stringify(generateJavaScriptAvatarModule(payload))
  return `
import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from 'react'

type RuntimeAvatar = {
  play: (animation?: AnimationName) => RuntimeAvatar
  pause: () => RuntimeAvatar
  stop: () => RuntimeAvatar
  destroy: () => void
}
type AvatarRuntimeModule = {
  createAvatar: (
    target: HTMLElement,
    options: {
      animation: AnimationName
      autoplay: boolean
      loop?: boolean
      size: string
      onAnimationEnd: (animation: AnimationName) => void
    }
  ) => RuntimeAvatar
}

const RUNTIME_SOURCE = ${runtimeSource}
let runtimePromise: Promise<AvatarRuntimeModule> | null = null
const loadRuntime = () => {
  if (runtimePromise) return runtimePromise
  const url = URL.createObjectURL(new Blob([RUNTIME_SOURCE], { type: 'text/javascript' }))
  runtimePromise = import(/* @vite-ignore */ url).then(module => {
    URL.revokeObjectURL(url)
    return module as AvatarRuntimeModule
  })
  return runtimePromise
}

export type AnimationName = ${animationUnion}
export type AvatarHandle = {
  play: (animation?: AnimationName) => void
  pause: () => void
  stop: () => void
}
export type AvatarProps = {
  animation?: AnimationName
  playing?: boolean
  loop?: boolean
  size?: number | string
  className?: string
  style?: CSSProperties
  onAnimationEnd?: (animation: AnimationName) => void
}

export const Avatar = forwardRef<AvatarHandle, AvatarProps>(function Avatar(
  {
    animation = ${JSON.stringify(animationNames[0])},
    playing = true,
    loop,
    size = 240,
    className,
    style,
    onAnimationEnd,
  },
  ref
) {
  const host = useRef<HTMLSpanElement>(null)
  const controller = useRef<RuntimeAvatar | null>(null)
  const animationRef = useRef(animation)
  const playingRef = useRef(playing)
  const onAnimationEndRef = useRef(onAnimationEnd)
  animationRef.current = animation
  playingRef.current = playing
  onAnimationEndRef.current = onAnimationEnd

  useEffect(() => {
    if (!host.current) return
    let disposed = false
    let avatar: RuntimeAvatar | null = null
    void loadRuntime().then(runtime => {
      if (disposed || !host.current) return
      avatar = runtime.createAvatar(host.current, {
        animation: animationRef.current,
        autoplay: playingRef.current,
        loop,
        size: '100%',
        onAnimationEnd: next => onAnimationEndRef.current?.(next),
      })
      controller.current = avatar
    })
    return () => {
      disposed = true
      avatar?.destroy()
      controller.current = null
    }
  }, [loop])

  useEffect(() => {
    const avatar = controller.current
    if (!avatar) return
    if (playing) avatar.play(animation)
    else avatar.pause()
  }, [animation, playing])

  useImperativeHandle(ref, () => ({
    play(next = animation) { controller.current?.play(next) },
    pause() { controller.current?.pause() },
    stop() { controller.current?.stop() },
  }), [animation])

  const dimension = typeof size === 'number' ? size + 'px' : size
  return <span ref={host} className={className} style={{ display: 'inline-block', width: dimension, height: dimension, ...style }} />
})

export default Avatar
`
}

export const avatarExportFileName = (name: string, extension: 'js' | 'tsx' | 'zip') => {
  const base =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'avatar'
  return `${base}-avatar.${extension}`
}
