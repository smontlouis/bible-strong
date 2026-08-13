import { applyAvatarEyeDefaults, type StudioAvatar } from './avatars'
import type { Expression } from './geometry'
import { translateStudioText, type StudioLanguage } from './i18n'
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

const localizedPlaygroundCopy = (language: StudioLanguage) => {
  const t = (text: string) => translateStudioText(text, language)
  return {
    title: t('Playground de l’avatar'),
    eyebrow: t('Playground de l’avatar'),
    playing: t('En lecture'),
    paused: t('En pause'),
    stopped: t('Arrêté'),
    previewLabel: t('Aperçu procédural en direct'),
    previewAriaLabel: t('Aperçu de l’avatar'),
    animations: t('Animations'),
    animationsHelp: t('Choisissez une animation exportée pour la lancer.'),
    playback: t('Lecture'),
    playbackHelp: t('Contrôlez l’animation active.'),
    play: t('Lire'),
    pause: t('Pause'),
    stop: t('Arrêter'),
    api: t('API JavaScript'),
    apiHelp: t('Le module réutilisable est disponible dans avatar.js.'),
    apiNote: t(
      'Ouvrez cette démo directement, ou servez le dossier localement pour importer avatar.js depuis un autre module.'
    ),
  }
}

export const generateJavaScriptAvatarModule = (
  payload: AvatarExportPayload
) => `${standaloneEngineSource}
${`const DATA = ${serializedPayload(payload)};`}
${proceduralBrowserRuntime}
export const availableAnimations = Object.freeze(Object.keys(DATA.animations));
export function createAvatar(target, options = {}) { return mountAvatar(target, options); }
export default createAvatar;
`

export const generateJavaScriptAvatarHtml = (
  payload: AvatarExportPayload,
  language: StudioLanguage = 'en'
) => {
  const firstAnimation = Object.keys(payload.animations)[0]
  const copy = localizedPlaygroundCopy(language)
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapedHtml(payload.avatar.name)} · ${copy.title}</title>
    <style>
      * { box-sizing: border-box; }
      :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; color: #f7f8fa; background: #0d1117; }
      button { font: inherit; }
      .playground { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0; }
      .topbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 22px; }
      .identity { display: flex; align-items: center; gap: 12px; }
      .brand-mark { width: 13px; height: 13px; border-radius: 50%; background: #5b7fe5; box-shadow: 0 0 0 7px rgb(91 127 229 / 12%); }
      .eyebrow { margin: 0 0 3px; color: #7f9cff; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
      h1 { margin: 0; font-size: clamp(20px, 3vw, 28px); letter-spacing: -.035em; }
      .status { display: inline-flex; align-items: center; gap: 8px; min-height: 34px; padding: 0 12px; border: 1px solid #293140; border-radius: 999px; color: #aeb8c7; background: #141a22; font-size: 12px; font-weight: 700; }
      .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #47cf8a; box-shadow: 0 0 0 4px rgb(71 207 138 / 10%); }
      .status[data-state="paused"] .status-dot { background: #f4b860; box-shadow: 0 0 0 4px rgb(244 184 96 / 10%); }
      .status[data-state="stopped"] .status-dot { background: #788395; box-shadow: none; }
      .workspace { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(310px, .65fr); gap: 18px; }
      .preview-card, .control-card { border: 1px solid #252d39; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 80px rgb(0 0 0 / 22%); }
      .preview-card { min-height: min(680px, calc(100vh - 130px)); display: grid; place-items: center; position: relative; background: radial-gradient(circle at 50% 42%, #1a2432 0, #111821 54%, #0b1016 100%); }
      .preview-card::after { content: "${copy.previewLabel}"; position: absolute; left: 20px; bottom: 18px; color: #667285; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
      #avatar { width: min(72%, 520px); aspect-ratio: 1; }
      .control-card { align-self: stretch; padding: 22px; color: #171a20; background: #f7f8fa; }
      .section + .section { margin-top: 22px; padding-top: 22px; border-top: 1px solid #dde1e8; }
      .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
      h2 { margin: 0; font-size: 15px; letter-spacing: -.015em; }
      .section-copy { margin: 4px 0 0; color: #717a89; font-size: 12px; line-height: 1.45; }
      #active-animation { color: #5277dc; font-size: 12px; font-weight: 800; }
      .animation-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; max-height: 250px; overflow: auto; padding: 2px; }
      .animation-button { min-width: 0; padding: 10px 11px; overflow: hidden; color: #424a57; border: 1px solid #d8dde6; border-radius: 11px; background: #fff; text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; transition: border-color 150ms ease, box-shadow 150ms ease, color 150ms ease, background 150ms ease; }
      .animation-button:hover { border-color: #9db2f4; }
      .animation-button.is-active { color: #315bc8; border-color: #7392ed; background: #edf2ff; box-shadow: 0 0 0 3px rgb(91 127 229 / 12%); }
      .animation-button:focus-visible, .transport-button:focus-visible { outline: 3px solid rgb(91 127 229 / 30%); outline-offset: 2px; }
      .transport { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
      .transport-button { min-height: 42px; border: 1px solid #d6dbe4; border-radius: 11px; color: #343a45; background: #fff; font-weight: 750; cursor: pointer; }
      .transport-button:hover { background: #f0f3f8; }
      .transport-button.primary { color: #fff; border-color: #171a20; background: #171a20; }
      .transport-button.primary:hover { background: #2a2e36; }
      .api-example { margin: 0; padding: 14px; overflow-x: auto; color: #cfdbed; border-radius: 12px; background: #171c24; font: 11px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; }
      .api-note { margin: 10px 0 0; color: #7d8694; font-size: 11px; line-height: 1.5; }
      @media (max-width: 820px) {
        .playground { width: min(100% - 20px, 620px); padding: 18px 0; }
        .workspace { grid-template-columns: 1fr; }
        .preview-card { min-height: 52vh; }
        #avatar { width: min(72vw, 430px); }
      }
    </style>
  </head>
  <body>
    <main class="playground">
      <header class="topbar">
        <div class="identity">
          <span class="brand-mark" aria-hidden="true"></span>
          <div>
            <p class="eyebrow">${copy.eyebrow}</p>
            <h1>${escapedHtml(payload.avatar.name)}</h1>
          </div>
        </div>
        <div class="status" id="playback-status" data-state="playing">
          <span class="status-dot" aria-hidden="true"></span>
          <span id="playback-status-label">${copy.playing}</span>
        </div>
      </header>

      <div class="workspace">
        <section class="preview-card" aria-label="${copy.previewAriaLabel}">
          <div id="avatar"></div>
        </section>

        <aside class="control-card">
          <section class="section">
            <div class="section-heading">
              <div>
                <h2>${copy.animations}</h2>
                <p class="section-copy">${copy.animationsHelp}</p>
              </div>
              <span id="active-animation"></span>
            </div>
            <div class="animation-list" id="animation-list"></div>
          </section>

          <section class="section">
            <div class="section-heading">
              <div>
                <h2>${copy.playback}</h2>
                <p class="section-copy">${copy.playbackHelp}</p>
              </div>
            </div>
            <div class="transport">
              <button class="transport-button primary" id="play-animation" type="button">▶ ${copy.play}</button>
              <button class="transport-button" id="pause-animation" type="button">Ⅱ ${copy.pause}</button>
              <button class="transport-button" id="stop-animation" type="button">■ ${copy.stop}</button>
            </div>
          </section>

          <section class="section">
            <div class="section-heading">
              <div>
                <h2>${copy.api}</h2>
                <p class="section-copy">${copy.apiHelp}</p>
              </div>
            </div>
            <pre class="api-example"><code>import { createAvatar } from &#39;./avatar.js&#39;

const avatar = createAvatar('#avatar', {
  animation: ${JSON.stringify(firstAnimation)},
  size: 320,
})

avatar.play(${JSON.stringify(firstAnimation)})
avatar.pause()
avatar.stop()</code></pre>
            <p class="api-note">${copy.apiNote}</p>
          </section>
        </aside>
      </div>
    </main>
    <script type="module">
${generateJavaScriptAvatarModule(payload)}
      let activeAnimation = ${JSON.stringify(firstAnimation)}
      const animationList = document.querySelector('#animation-list')
      const activeLabel = document.querySelector('#active-animation')
      const status = document.querySelector('#playback-status')
      const statusLabel = document.querySelector('#playback-status-label')
      const animationButtons = new Map()

      const setStatus = state => {
        status.dataset.state = state
        statusLabel.textContent = state === 'playing' ? ${JSON.stringify(copy.playing)} : state === 'paused' ? ${JSON.stringify(copy.paused)} : ${JSON.stringify(copy.stopped)}
      }
      const avatar = createAvatar('#avatar', {
        size: '100%',
        autoplay: false,
        onAnimationEnd: () => setStatus('stopped'),
      })
      const selectAnimation = name => {
        activeAnimation = name
        activeLabel.textContent = DATA.animations[name]?.name || name
        animationButtons.forEach((button, animationName) => {
          button.classList.toggle('is-active', animationName === name)
          button.setAttribute('aria-pressed', String(animationName === name))
        })
      }

      availableAnimations.forEach(name => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'animation-button'
        button.textContent = DATA.animations[name]?.name || name
        button.title = name
        button.addEventListener('click', () => {
          selectAnimation(name)
          avatar.play(name)
          setStatus('playing')
        })
        animationButtons.set(name, button)
        animationList.append(button)
      })

      document.querySelector('#play-animation').addEventListener('click', () => {
        avatar.play(activeAnimation)
        setStatus('playing')
      })
      document.querySelector('#pause-animation').addEventListener('click', () => {
        avatar.pause()
        setStatus('paused')
      })
      document.querySelector('#stop-animation').addEventListener('click', () => {
        avatar.stop()
        setStatus('stopped')
      })

      selectAnimation(activeAnimation)
      avatar.play(activeAnimation)
      window.avatar = avatar
    </script>
  </body>
</html>
`
}

export const generateJavaScriptAvatarPackage = (
  payload: AvatarExportPayload,
  language: StudioLanguage = 'en'
) => {
  return createStoredZip([
    { name: 'index.html', content: generateJavaScriptAvatarHtml(payload, language) },
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
