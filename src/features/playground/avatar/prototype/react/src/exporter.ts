import { applyAvatarEyeDefaults, type StudioAvatar } from './avatars'
import { poseFromExpression, renderAvatar, type AvatarGeometry, type Expression } from './geometry'
import type { AvatarSequence } from './sequences'

type ExportGeometry = Pick<
  AvatarGeometry,
  | 'backPaths'
  | 'frontPaths'
  | 'headPath'
  | 'leftPath'
  | 'rightPath'
  | 'leftVisible'
  | 'rightVisible'
>

export type AvatarExportFrame = {
  normal: ExportGeometry
  blink: ExportGeometry
  bodyColor: string
  eyeColor: string
  bodyMotion: Expression['bodyMotion']
  eyeMotion: Expression['eyeMotion']
}

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
  avatar: { name: string }
  frames: Record<string, AvatarExportFrame>
  animations: Record<string, AvatarExportAnimation>
}

const geometryForExport = (geometry: AvatarGeometry): ExportGeometry => ({
  backPaths: geometry.backPaths,
  frontPaths: geometry.frontPaths,
  headPath: geometry.headPath,
  leftPath: geometry.leftPath,
  rightPath: geometry.rightPath,
  leftVisible: geometry.leftVisible,
  rightVisible: geometry.rightVisible,
})

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
  const frames = Object.fromEntries(
    [...referencedIds].flatMap(expressionId => {
      const expression = expressionById.get(expressionId)
      if (!expression) return []
      const pose = poseFromExpression(applyAvatarEyeDefaults(expression, avatar.eyes))
      const options = { includeWire: false, bodyNodes: avatar.body.nodes }
      return [
        [
          expressionId,
          {
            normal: geometryForExport(renderAvatar(pose, avatar.body.primary, 1, options)),
            blink: geometryForExport(renderAvatar(pose, avatar.body.primary, 0.1, options)),
            bodyColor: expression.bodyColor ?? avatar.colors.body,
            eyeColor: expression.eyeColor ?? avatar.colors.eyes,
            bodyMotion: expression.bodyMotion,
            eyeMotion: expression.eyeMotion,
          } satisfies AvatarExportFrame,
        ],
      ]
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
            .filter(step => frames[step.expressionId])
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
  return { version: 1, avatar: { name: avatar.name }, frames, animations }
}

const serializedPayload = (payload: AvatarExportPayload) =>
  JSON.stringify(payload)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

const browserRuntime = `
const SVG_NS = 'http://www.w3.org/2000/svg';
let avatarInstanceCount = 0;

function svgNode(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function populateLayer(layer, frame, blinked, clipId) {
  layer.replaceChildren();
  const geometry = frame.normal;
  const defs = svgNode('defs');
  const clip = svgNode('clipPath', { id: clipId });
  clip.append(svgNode('path', { d: geometry.headPath }));
  defs.append(clip);
  layer.append(defs);
  geometry.backPaths.forEach(d => layer.append(svgNode('path', { d, fill: frame.bodyColor })));
  layer.append(svgNode('path', { d: geometry.headPath, fill: frame.bodyColor }));
  const eyeLayer = (eyeGeometry, closed) => {
    const eyes = svgNode('g', { 'clip-path': 'url(#' + clipId + ')' });
    eyes.classList.add('avatar-export-eyes');
    eyes.dataset.motion = frame.eyeMotion;
    eyes.style.opacity = closed === blinked ? '1' : '0';
    eyes.append(
      svgNode('path', { d: eyeGeometry.leftPath, fill: frame.eyeColor, opacity: eyeGeometry.leftVisible ? 1 : 0 }),
      svgNode('path', { d: eyeGeometry.rightPath, fill: frame.eyeColor, opacity: eyeGeometry.rightVisible ? 1 : 0 })
    );
    return eyes;
  };
  const openEyes = eyeLayer(frame.normal, false);
  const closedEyes = eyeLayer(frame.blink, true);
  layer.append(openEyes, closedEyes);
  layer.__avatarEyes = { openEyes, closedEyes };
  geometry.frontPaths.forEach(d => layer.append(svgNode('path', { d, fill: frame.bodyColor })));
  layer.dataset.motion = frame.bodyMotion;
}

function setBlink(layer, blinked, duration) {
  const eyes = layer.__avatarEyes;
  if (!eyes) return;
  const transition = 'opacity ' + Math.max(duration / 2, 40) + 'ms ease-in-out';
  eyes.openEyes.style.transition = transition;
  eyes.closedEyes.style.transition = transition;
  eyes.openEyes.style.opacity = blinked ? '0' : '1';
  eyes.closedEyes.style.opacity = blinked ? '1' : '0';
}

function mountAvatar(target, options = {}) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(host instanceof Element)) throw new Error('Avatar target not found.');
  const names = Object.keys(DATA.animations);
  if (!names.length) throw new Error('This export does not contain any animation.');
  const svg = svgNode('svg', { viewBox: '-150 -150 300 300', role: 'img', 'aria-label': DATA.avatar.name });
  const instanceId = ++avatarInstanceCount;
  svg.style.cssText = 'display:block;width:100%;height:100%;overflow:visible';
  const style = svgNode('style');
  style.textContent = \`
    .avatar-export-layer { transform-box: fill-box; transform-origin: center; }
    .avatar-export-layer[data-motion="slowDrift"] { animation: avatarSlowDrift 5.8s ease-in-out infinite alternate; }
    .avatar-export-layer[data-motion="shake"] { animation: avatarShake .1s linear infinite alternate; }
    .avatar-export-eyes { transform-box: fill-box; transform-origin: center; }
    .avatar-export-eyes[data-motion="microSaccades"] { animation: eyeSaccade 2.7s steps(1,end) infinite; }
    .avatar-export-eyes[data-motion="shake"] { animation: eyeShake .08s linear infinite alternate; }
    @keyframes avatarSlowDrift { 0%{transform:translate(-1.5px,1px) rotate(-.7deg)} 50%{transform:translate(1px,-1.5px) rotate(.4deg)} 100%{transform:translate(2px,.5px) rotate(.8deg)} }
    @keyframes avatarShake { from{transform:translate(-1.4px,.8px) rotate(-.45deg)} to{transform:translate(1.4px,-.8px) rotate(.45deg)} }
    @keyframes eyeSaccade { 0%,82%{transform:translate(0,0)} 84%{transform:translate(1.2px,-.5px)} 87%{transform:translate(-.7px,.8px)} 90%,100%{transform:translate(0,0)} }
    @keyframes eyeShake { from{transform:translate(-.8px,.4px)} to{transform:translate(.8px,-.4px)} }
  \`;
  svg.append(style);
  const layers = [svgNode('g'), svgNode('g')];
  layers.forEach(layer => { layer.classList.add('avatar-export-layer'); svg.append(layer); });
  host.replaceChildren(svg);
  if (options.size != null) {
    const size = typeof options.size === 'number' ? options.size + 'px' : String(options.size);
    host.style.width = size;
    host.style.height = size;
  }

  let front = 0;
  let currentFrameId = null;
  let currentAnimation = names.includes(options.animation) ? options.animation : names[0];
  let stepIndex = 0;
  let direction = 1;
  let playing = false;
  let stepTimer = null;
  let blinkTimer = null;
  let blinkEndTimer = null;
  let stepDueAt = null;
  let pausedRemainingMs = 0;
  let paused = false;

  const clearTimers = () => {
    [stepTimer, blinkTimer, blinkEndTimer].forEach(timer => timer != null && clearTimeout(timer));
    stepTimer = blinkTimer = blinkEndTimer = null;
  };

  const transitionEase = transition =>
    transition === 'snappy'
      ? 'cubic-bezier(.22,1,.36,1)'
      : transition === 'spring'
        ? 'cubic-bezier(.18,1.28,.38,1)'
        : 'cubic-bezier(.4,0,.2,1)';

  const showFrame = (frameId, duration = 0, transition = 'smooth') => {
    const frame = DATA.frames[frameId];
    if (!frame) return;
    currentFrameId = frameId;
    const nextIndex = duration > 0 ? 1 - front : front;
    const next = layers[nextIndex];
    populateLayer(next, frame, false, 'avatar-export-clip-' + instanceId + '-' + nextIndex);
    if (duration <= 0) {
      layers[front].style.opacity = '1';
      layers[1 - front].style.opacity = '0';
      return;
    }
    const previous = layers[front];
    next.style.transition = 'none';
    next.style.opacity = '0';
    previous.style.opacity = '1';
    requestAnimationFrame(() => {
      next.style.transition = 'opacity ' + duration + 'ms ' + transitionEase(transition);
      previous.style.transition = 'opacity ' + duration + 'ms ' + transitionEase(transition);
      next.style.opacity = '1';
      previous.style.opacity = '0';
    });
    front = nextIndex;
  };

  const blink = animation => {
    if (!playing || !currentFrameId || !animation.blink.enabled) return;
    setBlink(layers[front], true, animation.blink.durationMs);
    blinkEndTimer = setTimeout(() => {
      setBlink(layers[front], false, animation.blink.durationMs);
      blinkEndTimer = null;
    }, Math.max(40, animation.blink.durationMs / 2));
  };

  const scheduleBlink = (animation, delay) => {
    if (!animation.blink.enabled) return;
    blinkTimer = setTimeout(() => {
      blink(animation);
      const range = animation.blink.maxIntervalMs - animation.blink.minIntervalMs;
      scheduleBlink(animation, animation.blink.minIntervalMs + Math.random() * range);
    }, delay);
  };

  const advance = animation => {
    const last = animation.steps.length - 1;
    const playbackMode = options.loop === true ? 'loop' : options.loop === false ? 'once' : animation.playbackMode;
    if (playbackMode === 'once' && stepIndex >= last) {
      playing = false;
      options.onAnimationEnd?.(currentAnimation);
      return;
    }
    if (playbackMode === 'pingPong' && last > 0) {
      if (stepIndex >= last) direction = -1;
      else if (stepIndex <= 0) direction = 1;
      stepIndex += direction;
    } else stepIndex = (stepIndex + 1) % (last + 1);
    runStep(animation);
  };

  const runStep = animation => {
    if (!playing || !animation.steps.length) return;
    const step = animation.steps[stepIndex];
    showFrame(step.expressionId, step.transitionMs, step.transition);
    const duration = step.transitionMs + step.holdMs;
    stepDueAt = performance.now() + duration;
    stepTimer = setTimeout(() => advance(animation), duration);
  };

  const resumeStep = animation => {
    const delay = Math.max(pausedRemainingMs, 0);
    stepDueAt = performance.now() + delay;
    stepTimer = setTimeout(() => advance(animation), delay);
    scheduleBlink(animation, animation.blink.minIntervalMs);
  };

  const api = {
    element: svg,
    get animation() { return currentAnimation; },
    get playing() { return playing; },
    play(animationName) {
      animationName = animationName || currentAnimation;
      if (!DATA.animations[animationName]) throw new Error('Unknown animation: ' + animationName);
      if (animationName === currentAnimation && paused) {
        clearTimers();
        paused = false;
        playing = true;
        resumeStep(DATA.animations[currentAnimation]);
        return api;
      }
      clearTimers();
      currentAnimation = animationName;
      const animation = DATA.animations[animationName];
      stepIndex = 0;
      direction = 1;
      paused = false;
      playing = true;
      runStep(animation);
      scheduleBlink(animation, animation.blink.initialDelayMs);
      return api;
    },
    pause() {
      if (playing && stepDueAt != null) pausedRemainingMs = Math.max(stepDueAt - performance.now(), 0);
      clearTimers();
      if (currentFrameId) populateLayer(layers[front], DATA.frames[currentFrameId], false, 'avatar-export-clip-' + instanceId + '-' + front);
      paused = true;
      playing = false;
      return api;
    },
    stop() {
      clearTimers();
      paused = false;
      playing = false;
      stepIndex = 0;
      direction = 1;
      const first = DATA.animations[currentAnimation].steps[0];
      if (first) showFrame(first.expressionId);
      return api;
    },
    destroy() { clearTimers(); svg.remove(); },
  };
  const firstStep = DATA.animations[currentAnimation].steps[0];
  if (firstStep) showFrame(firstStep.expressionId);
  if (options.autoplay !== false) api.play(currentAnimation);
  return api;
}
`

export const generateJavaScriptAvatarModule = (
  payload: AvatarExportPayload
) => `${`const DATA = ${serializedPayload(payload)};`}
${browserRuntime}
export const availableAnimations = Object.freeze(Object.keys(DATA.animations));
export function createAvatar(target, options = {}) { return mountAvatar(target, options); }
export default createAvatar;
`

const reactRuntime = `
type Geometry = { backPaths: string[]; frontPaths: string[]; headPath: string; leftPath: string; rightPath: string; leftVisible: boolean; rightVisible: boolean }
type Frame = { normal: Geometry; blink: Geometry; bodyColor: string; eyeColor: string; bodyMotion: string; eyeMotion: string }
type Step = { expressionId: string; holdMs: number; transitionMs: number; transition: string }
type AnimationDefinition = { name: string; description: string; playbackMode: 'loop' | 'once' | 'pingPong'; blink: { enabled: boolean; initialDelayMs: number; minIntervalMs: number; maxIntervalMs: number; durationMs: number }; steps: Step[] }
type ExportData = { avatar: { name: string }; frames: Record<string, Frame>; animations: Record<string, AnimationDefinition> }

const DATA: ExportData = __PAYLOAD__
export const availableAnimations = __ANIMATIONS__ as const
export type AnimationName = (typeof availableAnimations)[number]

export type AvatarProps = {
  animation?: AnimationName
  playing?: boolean
  loop?: boolean
  size?: number | string
  className?: string
  style?: CSSProperties
  onAnimationEnd?: (animation: AnimationName) => void
}

export type AvatarHandle = {
  play: (animation?: AnimationName) => void
  pause: () => void
  stop: () => void
}

const motionStyle = (bodyMotion: string): CSSProperties => ({
  transformBox: 'fill-box',
  transformOrigin: 'center',
  animation:
    bodyMotion === 'slowDrift'
      ? 'avatarSlowDrift 5.8s ease-in-out infinite alternate'
      : bodyMotion === 'shake'
        ? 'avatarShake .1s linear infinite alternate'
        : undefined,
})

const eyeMotionStyle = (eyeMotion: string): CSSProperties => ({
  transformBox: 'fill-box',
  transformOrigin: 'center',
  animation:
    eyeMotion === 'microSaccades'
      ? 'eyeSaccade 2.7s steps(1,end) infinite'
      : eyeMotion === 'shake'
        ? 'eyeShake .08s linear infinite alternate'
        : undefined,
})

const transitionEase = (transition: string) =>
  transition === 'snappy'
    ? 'cubic-bezier(.22,1,.36,1)'
    : transition === 'spring'
      ? 'cubic-bezier(.18,1.28,.38,1)'
      : 'cubic-bezier(.4,0,.2,1)'

function AvatarFrame({ frame, blink, blinkDuration, clipId }: { frame: Frame; blink: boolean; blinkDuration: number; clipId: string }) {
  const geometry = frame.normal
  const eyeLayer = (eyeGeometry: Geometry, closed: boolean) => (
    <g
      clipPath={\`url(#\${clipId})\`}
      style={{
        ...eyeMotionStyle(frame.eyeMotion),
        opacity: closed === blink ? 1 : 0,
        transition: \`opacity \${Math.max(blinkDuration / 2, 40)}ms ease-in-out\`,
      }}
    >
      <path d={eyeGeometry.leftPath} fill={frame.eyeColor} opacity={eyeGeometry.leftVisible ? 1 : 0} />
      <path d={eyeGeometry.rightPath} fill={frame.eyeColor} opacity={eyeGeometry.rightVisible ? 1 : 0} />
    </g>
  )
  return (
    <g style={motionStyle(frame.bodyMotion)}>
      <defs><clipPath id={clipId}><path d={geometry.headPath} /></clipPath></defs>
      {geometry.backPaths.map((path, index) => <path d={path} fill={frame.bodyColor} key={\`back-\${index}\`} />)}
      <path d={geometry.headPath} fill={frame.bodyColor} />
      {eyeLayer(frame.normal, false)}
      {eyeLayer(frame.blink, true)}
      {geometry.frontPaths.map((path, index) => <path d={path} fill={frame.bodyColor} key={\`front-\${index}\`} />)}
    </g>
  )
}

export const Avatar = forwardRef<AvatarHandle, AvatarProps>(function Avatar(
  { animation = availableAnimations[0], playing = true, loop, size = '100%', className, style, onAnimationEnd },
  ref
) {
  const clipId = useId().replace(/:/g, '')
  const [selectedAnimation, setSelectedAnimation] = useState<AnimationName>(animation)
  const [isPlaying, setIsPlaying] = useState(playing)
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [blinking, setBlinking] = useState(false)
  const animationDefinition = DATA.animations[selectedAnimation]
  const step = animationDefinition.steps[stepIndex] ?? animationDefinition.steps[0]
  const desiredFrameId = step?.expressionId ?? Object.keys(DATA.frames)[0]
  const [renderedFrameId, setRenderedFrameId] = useState(desiredFrameId)
  const renderedFrameIdRef = useRef(desiredFrameId)
  const [previousFrameId, setPreviousFrameId] = useState<string | null>(null)
  const frame = DATA.frames[renderedFrameId]
  const previousFrame = previousFrameId ? DATA.frames[previousFrameId] : null

  useEffect(() => { setSelectedAnimation(animation); setStepIndex(0); setDirection(1) }, [animation])
  useEffect(() => { setIsPlaying(playing) }, [playing])
  useEffect(() => {
    if (!desiredFrameId || desiredFrameId === renderedFrameIdRef.current) return
    setPreviousFrameId(renderedFrameIdRef.current)
    renderedFrameIdRef.current = desiredFrameId
    setRenderedFrameId(desiredFrameId)
    const timer = window.setTimeout(() => setPreviousFrameId(null), step?.transitionMs ?? 0)
    return () => window.clearTimeout(timer)
  }, [desiredFrameId, step?.transitionMs])

  useEffect(() => {
    if (!isPlaying || !step) return
    const timer = window.setTimeout(() => {
      const last = animationDefinition.steps.length - 1
      const playbackMode = loop === true ? 'loop' : loop === false ? 'once' : animationDefinition.playbackMode
      if (playbackMode === 'once' && stepIndex >= last) {
        setIsPlaying(false)
        onAnimationEnd?.(selectedAnimation)
        return
      }
      if (playbackMode === 'pingPong' && last > 0) {
        const nextDirection = stepIndex >= last ? -1 : stepIndex <= 0 ? 1 : direction
        setDirection(nextDirection)
        setStepIndex(stepIndex + nextDirection)
      } else setStepIndex((stepIndex + 1) % (last + 1))
    }, step.transitionMs + step.holdMs)
    return () => window.clearTimeout(timer)
  }, [animationDefinition, direction, isPlaying, loop, onAnimationEnd, selectedAnimation, step, stepIndex])

  useEffect(() => {
    if (!isPlaying || !animationDefinition.blink.enabled) return
    let closeTimer: number | undefined
    let nextTimer: number | undefined
    const schedule = (delay: number) => {
      nextTimer = window.setTimeout(() => {
        setBlinking(true)
        closeTimer = window.setTimeout(() => setBlinking(false), Math.max(40, animationDefinition.blink.durationMs / 2))
        const range = animationDefinition.blink.maxIntervalMs - animationDefinition.blink.minIntervalMs
        schedule(animationDefinition.blink.minIntervalMs + Math.random() * range)
      }, delay)
    }
    schedule(animationDefinition.blink.initialDelayMs)
    return () => { if (closeTimer) clearTimeout(closeTimer); if (nextTimer) clearTimeout(nextTimer) }
  }, [animationDefinition, isPlaying])

  useImperativeHandle(ref, () => ({
    play(next = selectedAnimation) {
      if (next !== selectedAnimation) {
        setSelectedAnimation(next)
        setStepIndex(0)
        setDirection(1)
      }
      setIsPlaying(true)
    },
    pause() { setIsPlaying(false) },
    stop() {
      setIsPlaying(false)
      setStepIndex(0)
      setDirection(1)
    },
  }), [selectedAnimation])

  if (!frame) return null
  const dimension = typeof size === 'number' ? \`\${size}px\` : size
  return (
    <svg className={className} viewBox="-150 -150 300 300" role="img" aria-label={DATA.avatar.name} style={{ width: dimension, height: dimension, display: 'block', overflow: 'visible', ...style }}>
      <style>{\`
        @keyframes avatarFrameIn { from{opacity:0} to{opacity:1} }
        @keyframes avatarFrameOut { from{opacity:1} to{opacity:0} }
        @keyframes avatarSlowDrift { 0%{transform:translate(-1.5px,1px) rotate(-.7deg)} 50%{transform:translate(1px,-1.5px) rotate(.4deg)} 100%{transform:translate(2px,.5px) rotate(.8deg)} }
        @keyframes avatarShake { from{transform:translate(-1.4px,.8px) rotate(-.45deg)} to{transform:translate(1.4px,-.8px) rotate(.45deg)} }
        @keyframes eyeSaccade { 0%,82%{transform:translate(0,0)} 84%{transform:translate(1.2px,-.5px)} 87%{transform:translate(-.7px,.8px)} 90%,100%{transform:translate(0,0)} }
        @keyframes eyeShake { from{transform:translate(-.8px,.4px)} to{transform:translate(.8px,-.4px)} }
      \`}</style>
      {previousFrame && (
        <g style={{ animation: \`avatarFrameOut \${step?.transitionMs ?? 0}ms \${transitionEase(step?.transition ?? 'smooth')} forwards\` }}>
          <AvatarFrame frame={previousFrame} blink={false} blinkDuration={animationDefinition.blink.durationMs} clipId={\`\${clipId}-previous\`} />
        </g>
      )}
      <g key={renderedFrameId} style={{ animation: \`avatarFrameIn \${step?.transitionMs ?? 0}ms \${transitionEase(step?.transition ?? 'smooth')}\` }}>
        <AvatarFrame frame={frame} blink={blinking} blinkDuration={animationDefinition.blink.durationMs} clipId={clipId} />
      </g>
    </svg>
  )
})

export default Avatar
`

export const generateReactAvatarComponent = (payload: AvatarExportPayload) => {
  const animations = JSON.stringify(Object.keys(payload.animations))
  return `import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type CSSProperties } from 'react'\n${reactRuntime
    .replace('__PAYLOAD__', serializedPayload(payload))
    .replace('__ANIMATIONS__', animations)}`
}

export const avatarExportFileName = (name: string, extension: 'js' | 'tsx') => {
  const base =
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'avatar'
  return `${base}-avatar.${extension}`
}
