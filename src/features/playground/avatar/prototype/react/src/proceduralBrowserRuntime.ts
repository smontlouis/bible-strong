export const proceduralBrowserRuntime = `
let avatarInstanceCount = 0;
const SVG_NS = 'http://www.w3.org/2000/svg';
const clamp01 = value => Math.max(0, Math.min(1, value));
const easeProgress = (progress, transition) => transition === 'smooth'
  ? progress * progress * (3 - 2 * progress)
  : transition === 'snappy'
    ? 1 - (1 - progress) ** 3
    : 1 - Math.exp(-6 * progress) * Math.cos(8 * progress);
const nearestAngle = (target, current) => {
  let resolved = target;
  while (resolved - current > 180) resolved -= 360;
  while (resolved - current < -180) resolved += 360;
  return resolved;
};
const resolvedTargetExpression = (target, current) => ({
  ...target,
  headX: nearestAngle(target.headX, current.headX),
  headY: nearestAngle(target.headY, current.headY),
  headZ: nearestAngle(target.headZ, current.headZ),
  leftAngle: nearestAngle(target.leftAngle, current.leftAngle),
  rightAngle: nearestAngle(target.rightAngle, current.rightAngle),
});
const colorChannels = color => {
  const value = color.replace('#', '');
  const hex = value.length === 3 ? value.split('').map(channel => channel + channel).join('') : value;
  const numeric = Number.parseInt(hex, 16);
  return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
};
const interpolateColor = (from, to, progress) => {
  const left = colorChannels(from);
  const right = colorChannels(to);
  const value = left.map((channel, index) => Math.round(channel + (right[index] - channel) * progress));
  return '#' + value.map(channel => channel.toString(16).padStart(2, '0')).join('');
};
const resolveColors = expression => ({
  body: expression.bodyColor || DATA.avatar.colors.body,
  eyes: expression.eyeColor || DATA.avatar.colors.eyes,
});
const svgElement = name => document.createElementNS(SVG_NS, name);

function mountAvatar(target, options = {}) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) throw new Error('Avatar target was not found.');
  const animationNames = Object.keys(DATA.animations);
  if (!animationNames.length) throw new Error('The avatar export contains no animations.');
  const instanceId = ++avatarInstanceCount;
  const clipId = 'avatar-procedural-clip-' + instanceId;
  const svg = svgElement('svg');
  svg.setAttribute('viewBox', '-150 -150 300 300');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', DATA.avatar.name);
  svg.style.width = typeof options.size === 'number' ? options.size + 'px' : options.size || '100%';
  svg.style.height = typeof options.size === 'number' ? options.size + 'px' : options.size || '100%';
  svg.style.display = 'block';
  svg.style.overflow = 'visible';
  const defs = svgElement('defs');
  const clipPath = svgElement('clipPath');
  const clipHead = svgElement('path');
  clipPath.id = clipId;
  clipPath.append(clipHead);
  defs.append(clipPath);
  svg.append(defs);
  const motionLayer = svgElement('g');
  const backLayer = svgElement('g');
  const head = svgElement('path');
  const eyesLayer = svgElement('g');
  const leftEye = svgElement('path');
  const rightEye = svgElement('path');
  const frontLayer = svgElement('g');
  eyesLayer.setAttribute('clip-path', 'url(#' + clipId + ')');
  eyesLayer.append(leftEye, rightEye);
  motionLayer.append(backLayer, head, eyesLayer, frontLayer);
  svg.append(motionLayer);
  host.replaceChildren(svg);

  const ensurePaths = (group, paths, fill) => {
    while (group.children.length < paths.length) group.append(svgElement('path'));
    while (group.children.length > paths.length) group.lastElementChild.remove();
    paths.forEach((path, index) => {
      group.children[index].setAttribute('d', path);
      group.children[index].setAttribute('fill', fill);
    });
  };
  let currentAnimation = options.animation && DATA.animations[options.animation] ? options.animation : animationNames[0];
  const initialStep = DATA.animations[currentAnimation].steps[0];
  const initialExpression = DATA.expressions[initialStep.expressionId];
  let currentPose = AvatarProceduralEngine.poseFromExpression(initialExpression);
  let currentColors = resolveColors(initialExpression);
  let blinkAmount = 1;
  let transitionState = null;
  let blinkState = null;
  let frameRequest = null;
  let stepTimer = null;
  let blinkTimer = null;
  let blinkDueAt = null;
  let stepIndex = 0;
  let direction = 1;
  let playing = false;
  let paused = false;
  let pausedRemainingMs = 0;
  let pausedTransition = null;
  let pausedBlink = null;
  let pausedBlinkDelay = 0;
  let stepDueAt = null;
  let ambientStartedAt = performance.now();
  let ambientSignature = initialExpression.eyeMotion + ':' + initialExpression.bodyMotion;
  let lastAmbientFrame = 0;

  const applyMotion = expression => {
    const signature = expression.eyeMotion + ':' + expression.bodyMotion;
    if (signature !== ambientSignature) {
      ambientSignature = signature;
      ambientStartedAt = performance.now();
    }
  };
  const render = (time = performance.now()) => {
    const elapsed = time - ambientStartedAt;
    const expression = AvatarProceduralEngine.hasAmbientMotion(currentPose.expression)
      ? AvatarProceduralEngine.applyAmbientMotion(currentPose.expression, elapsed)
      : currentPose.expression;
    const renderedPose = AvatarProceduralEngine.poseFromExpression(expression);
    const geometry = AvatarProceduralEngine.renderAvatar(renderedPose, DATA.avatar.surface, blinkAmount, {
      includeWire: false,
      bodyNodes: DATA.avatar.bodyNodes,
    });
    const offset = AvatarProceduralEngine.ambientBodyOffset(currentPose.expression, elapsed);
    motionLayer.setAttribute('transform', 'translate(' + offset.x + ' ' + offset.y + ')');
    ensurePaths(backLayer, geometry.backPaths, currentColors.body);
    ensurePaths(frontLayer, geometry.frontPaths, currentColors.body);
    head.setAttribute('d', geometry.headPath);
    head.setAttribute('fill', currentColors.body);
    clipHead.setAttribute('d', geometry.headPath);
    leftEye.setAttribute('d', geometry.leftPath);
    rightEye.setAttribute('d', geometry.rightPath);
    leftEye.setAttribute('fill', currentColors.eyes);
    rightEye.setAttribute('fill', currentColors.eyes);
    leftEye.style.display = geometry.leftVisible ? '' : 'none';
    rightEye.style.display = geometry.rightVisible ? '' : 'none';
  };
  const tick = time => {
    frameRequest = null;
    if (transitionState) {
      const linear = clamp01((time - transitionState.startedAt) / transitionState.durationMs);
      const eased = easeProgress(linear, transitionState.transition);
      const expression = { ...transitionState.fromPose.expression };
      AvatarProceduralEngine.expressionFields.forEach(field => {
        expression[field] = transitionState.fromPose.expression[field] +
          (transitionState.toPose.expression[field] - transitionState.fromPose.expression[field]) * eased;
      });
      expression.eyeMotion = transitionState.toPose.expression.eyeMotion;
      expression.bodyMotion = transitionState.toPose.expression.bodyMotion;
      currentPose = AvatarProceduralEngine.poseFromExpression(expression);
      currentColors = {
        body: interpolateColor(transitionState.fromColors.body, transitionState.toColors.body, clamp01(eased)),
        eyes: interpolateColor(transitionState.fromColors.eyes, transitionState.toColors.eyes, clamp01(eased)),
      };
      if (linear >= 1) {
        currentPose = transitionState.toPose;
        currentColors = transitionState.toColors;
        transitionState = null;
      }
    }
    if (blinkState) {
      const progress = clamp01((time - blinkState.startedAt) / blinkState.durationMs);
      if (progress <= 0.42) {
        const closeProgress = progress / 0.42;
        blinkAmount = 1 - closeProgress * closeProgress;
      } else {
        const openProgress = (progress - 0.42) / 0.58;
        blinkAmount = 1 - (1 - openProgress) ** 2;
      }
      if (progress >= 1) {
        blinkAmount = 1;
        blinkState = null;
      }
    }
    const ambientActive = AvatarProceduralEngine.hasAmbientMotion(currentPose.expression);
    if (transitionState || blinkState || !ambientActive || time - lastAmbientFrame >= 1000 / 30) {
      render(time);
      if (ambientActive) lastAmbientFrame = time;
    }
    if (transitionState || blinkState || ambientActive) frameRequest = requestAnimationFrame(tick);
  };
  const requestTick = () => {
    if (frameRequest === null) frameRequest = requestAnimationFrame(tick);
  };
  const animateTo = (expressionId, durationMs, transition) => {
    const target = DATA.expressions[expressionId];
    if (!target) return;
    applyMotion(target);
    const resolved = resolvedTargetExpression(target, currentPose.expression);
    const targetPose = AvatarProceduralEngine.poseFromExpression(resolved);
    const targetColors = resolveColors(target);
    if (durationMs <= 0) {
      transitionState = null;
      currentPose = targetPose;
      currentColors = targetColors;
      render();
      if (AvatarProceduralEngine.hasAmbientMotion(currentPose.expression)) requestTick();
      return;
    }
    transitionState = {
      fromPose: currentPose,
      toPose: targetPose,
      fromColors: currentColors,
      toColors: targetColors,
      startedAt: performance.now(),
      durationMs,
      transition,
      expressionId,
    };
    requestTick();
  };
  const clearSchedule = () => {
    if (stepTimer !== null) clearTimeout(stepTimer);
    if (blinkTimer !== null) clearTimeout(blinkTimer);
    stepTimer = null;
    blinkTimer = null;
    blinkDueAt = null;
    stepDueAt = null;
  };
  const scheduleBlink = (animation, delay) => {
    if (!animation.blink.enabled) return;
    blinkDueAt = performance.now() + delay;
    blinkTimer = setTimeout(() => {
      blinkDueAt = null;
      blinkState = { startedAt: performance.now(), durationMs: animation.blink.durationMs };
      requestTick();
      const range = animation.blink.maxIntervalMs - animation.blink.minIntervalMs;
      scheduleBlink(animation, animation.blink.durationMs + animation.blink.minIntervalMs + Math.random() * range);
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
    animateTo(step.expressionId, step.transitionMs, step.transition);
    const duration = step.transitionMs + step.holdMs;
    stepDueAt = performance.now() + duration;
    stepTimer = setTimeout(() => advance(animation), duration);
  };
  const api = {
    element: svg,
    get animation() { return currentAnimation; },
    get playing() { return playing; },
    play(animationName) {
      animationName = animationName || currentAnimation;
      if (!DATA.animations[animationName]) throw new Error('Unknown animation: ' + animationName);
      clearSchedule();
      if (animationName === currentAnimation && paused) {
        paused = false;
        playing = true;
        if (pausedTransition) animateTo(pausedTransition.expressionId, pausedTransition.durationMs, pausedTransition.transition);
        if (pausedBlink) {
          blinkState = {
            startedAt: performance.now() - pausedBlink.progress * pausedBlink.durationMs,
            durationMs: pausedBlink.durationMs,
          };
          requestTick();
        }
        stepDueAt = performance.now() + pausedRemainingMs;
        stepTimer = setTimeout(() => advance(DATA.animations[currentAnimation]), pausedRemainingMs);
        scheduleBlink(
          DATA.animations[currentAnimation],
          pausedBlinkDelay || DATA.animations[currentAnimation].blink.minIntervalMs
        );
        pausedTransition = null;
        pausedBlink = null;
        pausedBlinkDelay = 0;
        return api;
      }
      currentAnimation = animationName;
      stepIndex = 0;
      direction = 1;
      paused = false;
      playing = true;
      runStep(DATA.animations[currentAnimation]);
      scheduleBlink(DATA.animations[currentAnimation], DATA.animations[currentAnimation].blink.initialDelayMs);
      return api;
    },
    pause() {
      const now = performance.now();
      if (playing && stepDueAt !== null) pausedRemainingMs = Math.max(stepDueAt - now, 0);
      pausedBlinkDelay = blinkDueAt === null ? 0 : Math.max(blinkDueAt - now, 0);
      if (transitionState) {
        const elapsed = now - transitionState.startedAt;
        pausedTransition = {
          expressionId: transitionState.expressionId,
          durationMs: Math.max(transitionState.durationMs - elapsed, 0),
          transition: transitionState.transition,
        };
      }
      if (blinkState) {
        pausedBlink = {
          progress: clamp01((now - blinkState.startedAt) / blinkState.durationMs),
          durationMs: blinkState.durationMs,
        };
      }
      clearSchedule();
      transitionState = null;
      blinkState = null;
      paused = true;
      playing = false;
      render();
      return api;
    },
    stop() {
      clearSchedule();
      transitionState = null;
      blinkState = null;
      blinkAmount = 1;
      pausedBlink = null;
      pausedBlinkDelay = 0;
      paused = false;
      playing = false;
      stepIndex = 0;
      direction = 1;
      const first = DATA.animations[currentAnimation].steps[0];
      if (first) animateTo(first.expressionId, 0, first.transition);
      return api;
    },
    destroy() {
      clearSchedule();
      if (frameRequest !== null) cancelAnimationFrame(frameRequest);
      svg.remove();
    },
  };
  applyMotion(initialExpression);
  render();
  if (AvatarProceduralEngine.hasAmbientMotion(initialExpression)) requestTick();
  if (options.autoplay !== false) api.play(currentAnimation);
  return api;
}
`
