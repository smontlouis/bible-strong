import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ViewProps } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import {
  cancelAnimation,
  createAnimatedComponent,
  Easing,
  FadeIn,
  FadeOut,
  type EntryOrExitLayoutType,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path, type PathProps } from 'react-native-svg'
import { runOnJS } from 'react-native-worklets'

import Box, { AnimatedBox } from '~common/ui/Box'
import type { OnboardingStageMetrics } from './OnboardingStage'

export type SceneLayoutMode = 'auto' | 'position' | 'resize' | 'scale'

export type SceneNodeAnchor = {
  x: number
  y: number
}

export type SceneNodeOffset = {
  x?: number
  y?: number
  rotation?: number
  scale?: number
}

export type SceneNodeOrbit = {
  centerX: number
  centerY: number
  radiusX: number
  radiusY: number
  rotationDegrees?: number
  phase: number
  frontPhase?: number
  duration: number
  startDelay?: number
  direction?: 1 | -1
  minScale?: number
  maxScale?: number
  minOpacity?: number
  maxOpacity?: number
  backZIndex?: number
  frontZIndex?: number
}

export type SceneNodeFrame = {
  x: number
  y: number
  width: number
  height: number
  scale?: number
  rotation?: number
  opacity?: number
  zIndex?: number
  anchors?: Record<string, SceneNodeAnchor>
}

export type SceneConnectionEndpoint =
  | string
  | {
      node: string
      anchor?: string
    }

export type SceneConnectionCurve = { type: 'straight' } | { type: 'quadratic'; bend?: number }

type SceneProps = {
  id: string
  children: ReactNode
}

type SceneNodeProps = {
  id: string
  frame: SceneNodeFrame
  contentKey?: string
  contentEntering?: EntryOrExitLayoutType | false
  contentExiting?: EntryOrExitLayoutType | false
  layout?: SceneLayoutMode
  transitionDelay?: number
  transitionDuration?: number
  opacityTransitionDelay?: number
  opacityTransitionDuration?: number
  orbit?: SceneNodeOrbit
  enterDelay?: number
  enterFrom?: SceneNodeOffset
  exitTo?: SceneNodeOffset
  entering?: EntryOrExitLayoutType | false
  exiting?: EntryOrExitLayoutType | false
  draggable?: boolean
  dragBounds?: string
  dragFriction?: number
  dragReturnToOrigin?: boolean
  onPress?: () => void
  pressScale?: number
  accessibilityLabel?: string
  pointerEvents?: ViewProps['pointerEvents']
  children: ReactElement
}

type SceneConnectionProps = {
  from: SceneConnectionEndpoint
  to: SceneConnectionEndpoint
  curve?: SceneConnectionCurve
  enterDelay?: number
  exiting?: EntryOrExitLayoutType | false
  transitionDelay?: number
  transitionKey?: string
  color?: string
  opacity?: number
  width?: number
}

type SceneLayerProps = {
  zIndex: number
  children: ReactNode
}

type SceneGraphProps = {
  activeSceneId: string
  connectionColor: string
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
  children: ReactNode
}

type NodeDescriptor = SceneNodeProps & {
  contentIdentity: string
}

type ConnectionDescriptor = SceneConnectionProps & {
  key: string
}

type SceneDescriptor = {
  id: string
  nodes: NodeDescriptor[]
  connections: ConnectionDescriptor[]
  layers: {
    key: string
    zIndex: number
    children: ReactNode
  }[]
}

type NodeGeometry = {
  x: SharedValue<number>
  y: SharedValue<number>
  dragX: SharedValue<number>
  dragY: SharedValue<number>
  width: SharedValue<number>
  height: SharedValue<number>
  scale: SharedValue<number>
  rotation: SharedValue<number>
}

type NodeRendererProps = {
  descriptor: NodeDescriptor
  orbitProgress: SharedValue<number>
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
  geometries: Map<string, NodeGeometry>
  notifyGeometryChange: React.Dispatch<React.SetStateAction<number>>
}

type ConnectionRendererProps = {
  connection: ConnectionDescriptor
  defaultColor: string
  nodes: Map<string, NodeDescriptor>
  geometries: Map<string, NodeGeometry>
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
}

const AnimatedPath = createAnimatedComponent(Path)
const contentTypeIds = new WeakMap<object, number>()
let nextContentTypeId = 0

type SceneMarker = 'connection' | 'layer' | 'node' | 'scene'
type MarkedSceneElement = {
  sceneGraphMarker?: SceneMarker
}

const SceneRoot = Object.assign((_props: SceneProps) => null, {
  sceneGraphMarker: 'scene' as const,
})
const SceneNode = Object.assign((_props: SceneNodeProps) => null, {
  sceneGraphMarker: 'node' as const,
})
const SceneConnection = Object.assign((_props: SceneConnectionProps) => null, {
  sceneGraphMarker: 'connection' as const,
})
const SceneLayer = Object.assign((_props: SceneLayerProps) => null, {
  sceneGraphMarker: 'layer' as const,
})

export const Scene = Object.assign(SceneRoot, {
  Node: SceneNode,
  Connection: SceneConnection,
  Layer: SceneLayer,
})

const getSceneMarker = (element: ReactElement) =>
  (element.type as MarkedSceneElement).sceneGraphMarker

const getContentIdentity = (content: ReactElement, contentKey?: string) => {
  const type = content.type

  if (typeof type === 'string') return `host:${type}:${contentKey ?? ''}`

  if (!contentTypeIds.has(type)) {
    nextContentTypeId += 1
    contentTypeIds.set(type, nextContentTypeId)
  }

  return `component:${contentTypeIds.get(type)}:${contentKey ?? ''}`
}

const endpointNodeId = (endpoint: SceneConnectionEndpoint) =>
  typeof endpoint === 'string' ? endpoint : endpoint.node

const connectionKey = (connection: SceneConnectionProps, index: number) =>
  `${endpointNodeId(connection.from)}:${endpointNodeId(connection.to)}:${index}`

const compileScene = (element: ReactElement<SceneProps>): SceneDescriptor => {
  const nodes: NodeDescriptor[] = []
  const connections: ConnectionDescriptor[] = []
  const ordinaryChildren: ReactNode[] = []
  const layers: SceneDescriptor['layers'] = []

  const visit = (child: ReactNode) => {
    if (!isValidElement(child)) {
      if (child !== null && child !== undefined && child !== false) ordinaryChildren.push(child)
      return
    }

    if (child.type === Fragment) {
      Children.forEach((child.props as { children?: ReactNode }).children, visit)
      return
    }

    if (getSceneMarker(child) === 'node') {
      const props = child.props as SceneNodeProps
      nodes.push({
        ...props,
        contentIdentity: getContentIdentity(props.children, props.contentKey),
      })
      return
    }

    if (getSceneMarker(child) === 'connection') {
      const props = child.props as SceneConnectionProps
      connections.push({ ...props, key: connectionKey(props, connections.length) })
      return
    }

    if (getSceneMarker(child) === 'layer') {
      const props = child.props as SceneLayerProps
      layers.push({ key: `layer:${layers.length}`, zIndex: props.zIndex, children: props.children })
      return
    }

    ordinaryChildren.push(child)
  }

  Children.forEach(element.props.children, visit)

  if (__DEV__) {
    const ids = new Set<string>()
    nodes.forEach(node => {
      if (ids.has(node.id)) throw new Error(`Duplicate Scene.Node id: ${node.id}`)
      ids.add(node.id)
    })
    nodes.forEach(node => {
      if (node.dragBounds && !ids.has(node.dragBounds)) {
        throw new Error(
          `Scene.Node "${node.id}" references unknown dragBounds node "${node.dragBounds}"`
        )
      }
    })
  }

  if (ordinaryChildren.length > 0) {
    layers.unshift({ key: 'ordinary', zIndex: 1, children: ordinaryChildren })
  }

  return { id: element.props.id, nodes, connections, layers }
}

const compileScenes = (children: ReactNode) =>
  Children.toArray(children).flatMap(child => {
    if (!isValidElement<SceneProps>(child) || getSceneMarker(child) !== 'scene') return []
    return [compileScene(child)]
  })

const withSceneSpring = (value: number, reduceMotion: boolean, delay = 0, duration?: number) => {
  if (reduceMotion) return value

  const animation = duration === undefined ? withSpring(value) : withSpring(value, { duration })
  return delay > 0 ? withDelay(delay, animation) : animation
}

const resolveDragLimits = (
  x: SharedValue<number>,
  y: SharedValue<number>,
  width: SharedValue<number>,
  height: SharedValue<number>,
  scale: SharedValue<number>,
  rotation: SharedValue<number>,
  bounds: NodeGeometry
) => {
  'worklet'

  const nodeRadians = (rotation.get() * Math.PI) / 180
  const nodeHalfWidth =
    (Math.abs(Math.cos(nodeRadians)) * width.get() * scale.get() +
      Math.abs(Math.sin(nodeRadians)) * height.get() * scale.get()) /
    2
  const nodeHalfHeight =
    (Math.abs(Math.sin(nodeRadians)) * width.get() * scale.get() +
      Math.abs(Math.cos(nodeRadians)) * height.get() * scale.get()) /
    2
  const boundsRadians = (bounds.rotation.get() * Math.PI) / 180
  const boundsHalfWidth =
    (Math.abs(Math.cos(boundsRadians)) * bounds.width.get() * bounds.scale.get() +
      Math.abs(Math.sin(boundsRadians)) * bounds.height.get() * bounds.scale.get()) /
    2
  const boundsHalfHeight =
    (Math.abs(Math.sin(boundsRadians)) * bounds.width.get() * bounds.scale.get() +
      Math.abs(Math.cos(boundsRadians)) * bounds.height.get() * bounds.scale.get()) /
    2
  const nodeCenterX = x.get() + width.get() / 2
  const nodeCenterY = y.get() + height.get() / 2
  const boundsCenterX = bounds.x.get() + bounds.dragX.get() + bounds.width.get() / 2
  const boundsCenterY = bounds.y.get() + bounds.dragY.get() + bounds.height.get() / 2

  return {
    minX: boundsCenterX - boundsHalfWidth - (nodeCenterX - nodeHalfWidth),
    maxX: boundsCenterX + boundsHalfWidth - (nodeCenterX + nodeHalfWidth),
    minY: boundsCenterY - boundsHalfHeight - (nodeCenterY - nodeHalfHeight),
    maxY: boundsCenterY + boundsHalfHeight - (nodeCenterY + nodeHalfHeight),
  }
}

const applyBoundedDragDelta = (current: number, delta: number, min: number, max: number) => {
  'worklet'

  const position = Math.max(min, Math.min(max, current))
  if (delta === 0) return position

  const direction = delta > 0 ? 1 : -1
  const availableDistance = direction > 0 ? max - position : position - min
  if (availableDistance <= 0) return position

  const resistedDistance = availableDistance * (1 - Math.exp(-Math.abs(delta) / availableDistance))

  return position + direction * resistedDistance
}

const resistDecayVelocity = (
  current: number,
  velocity: number,
  min: number,
  max: number,
  deceleration: number
) => {
  'worklet'

  if (velocity === 0) return 0

  const position = Math.max(min, Math.min(max, current))
  const availableDistance = velocity > 0 ? max - position : position - min
  const stoppingRate = 100 * (1 - deceleration)
  const maxVelocity = Math.max(0, availableDistance * stoppingRate * 0.8)

  return Math.max(-maxVelocity, Math.min(maxVelocity, velocity))
}

const NodeRenderer = ({
  descriptor,
  orbitProgress,
  metrics,
  reduceMotion,
  geometries,
  notifyGeometryChange,
}: NodeRendererProps) => {
  const [initialFrame] = useState(() => descriptor.frame)
  const x = useSharedValue(initialFrame.x)
  const y = useSharedValue(initialFrame.y)
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const previousTranslationX = useSharedValue(0)
  const previousTranslationY = useSharedValue(0)
  const interactionScale = useSharedValue(1)
  const panActive = useSharedValue(false)
  const width = useSharedValue(initialFrame.width)
  const height = useSharedValue(initialFrame.height)
  const scale = useSharedValue(initialFrame.scale ?? 1)
  const rotation = useSharedValue(initialFrame.rotation ?? 0)
  const opacity = useSharedValue(initialFrame.opacity ?? 1)

  useLayoutEffect(() => {
    const geometryRegistry = geometries
    const geometry = { x, y, dragX, dragY, width, height, scale, rotation }
    geometryRegistry.set(descriptor.id, geometry)
    notifyGeometryChange(version => version + 1)

    return () => {
      if (geometryRegistry.get(descriptor.id) === geometry) {
        geometryRegistry.delete(descriptor.id)
        notifyGeometryChange(version => version + 1)
      }
    }
  }, [
    descriptor.id,
    dragX,
    dragY,
    geometries,
    height,
    notifyGeometryChange,
    rotation,
    scale,
    width,
    x,
    y,
  ])

  useEffect(() => {
    const mode = descriptor.layout ?? 'auto'
    const transitionDelay = descriptor.transitionDelay ?? 0
    const transitionDuration = descriptor.transitionDuration
    const shouldResize =
      mode === 'resize' ||
      (mode === 'auto' &&
        (descriptor.frame.width !== initialFrame.width ||
          descriptor.frame.height !== initialFrame.height))

    x.set(withSceneSpring(descriptor.frame.x, reduceMotion, transitionDelay, transitionDuration))
    y.set(withSceneSpring(descriptor.frame.y, reduceMotion, transitionDelay, transitionDuration))
    if (mode === 'scale') {
      cancelAnimation(width)
      cancelAnimation(height)
    } else {
      width.set(
        withSceneSpring(
          shouldResize ? descriptor.frame.width : initialFrame.width,
          reduceMotion,
          transitionDelay,
          transitionDuration
        )
      )
      height.set(
        withSceneSpring(
          shouldResize ? descriptor.frame.height : initialFrame.height,
          reduceMotion,
          transitionDelay,
          transitionDuration
        )
      )
    }
    scale.set(
      withSceneSpring(
        mode === 'position' || shouldResize ? 1 : (descriptor.frame.scale ?? 1),
        reduceMotion,
        transitionDelay,
        transitionDuration
      )
    )
    rotation.set(
      withSceneSpring(
        descriptor.frame.rotation ?? 0,
        reduceMotion,
        transitionDelay,
        transitionDuration
      )
    )
    opacity.set(
      withSceneSpring(
        descriptor.frame.opacity ?? 1,
        reduceMotion,
        descriptor.opacityTransitionDelay ?? transitionDelay,
        descriptor.opacityTransitionDuration ?? transitionDuration
      )
    )
  }, [
    descriptor.frame,
    descriptor.layout,
    descriptor.opacityTransitionDelay,
    descriptor.opacityTransitionDuration,
    descriptor.transitionDelay,
    descriptor.transitionDuration,
    height,
    initialFrame,
    opacity,
    reduceMotion,
    rotation,
    scale,
    width,
    x,
    y,
  ])

  const animatedStyle = useAnimatedStyle(() => {
    const resolvedDragX = dragX.get()
    const resolvedDragY = dragY.get()
    const safeDragX = Number.isFinite(resolvedDragX) ? resolvedDragX : 0
    const safeDragY = Number.isFinite(resolvedDragY) ? resolvedDragY : 0
    const orbit = descriptor.orbit
    let orbitTranslateX = 0
    let orbitTranslateY = 0
    let orbitScale = 1
    let orbitOpacity = 1

    if (orbit) {
      const progress = reduceMotion ? 0 : orbitProgress.get()
      const orbitPhase = orbit.phase + progress * (orbit.direction ?? 1)
      const angle = orbitPhase * Math.PI * 2
      const rotationRadians = ((orbit.rotationDegrees ?? 0) * Math.PI) / 180
      const ellipseX = Math.cos(angle) * orbit.radiusX
      const ellipseY = Math.sin(angle) * orbit.radiusY
      const targetCenterX =
        orbit.centerX + ellipseX * Math.cos(rotationRadians) - ellipseY * Math.sin(rotationRadians)
      const targetCenterY =
        orbit.centerY + ellipseX * Math.sin(rotationRadians) + ellipseY * Math.cos(rotationRadians)
      const depthAngle = (orbitPhase - (orbit.frontPhase ?? 0.25)) * Math.PI * 2
      const depth = (Math.cos(depthAngle) + 1) / 2
      const nodeCenterX = x.get() + width.get() / 2
      const nodeCenterY = y.get() + height.get() / 2
      orbitTranslateX = targetCenterX - nodeCenterX
      orbitTranslateY = targetCenterY - nodeCenterY
      orbitScale =
        (orbit.minScale ?? 0.78) + depth * ((orbit.maxScale ?? 1.14) - (orbit.minScale ?? 0.78))
      orbitOpacity =
        (orbit.minOpacity ?? 0.78) + depth * ((orbit.maxOpacity ?? 1) - (orbit.minOpacity ?? 0.78))
    }

    return {
      opacity: opacity.get() * orbitOpacity,
      width: width.get() * metrics.scale,
      height: height.get() * metrics.scale,
      transform: [
        {
          translateX: (x.get() - initialFrame.x + safeDragX + orbitTranslateX) * metrics.scale,
        },
        {
          translateY: (y.get() - initialFrame.y + safeDragY + orbitTranslateY) * metrics.scale,
        },
        { rotate: `${rotation.get()}deg` },
        { scale: scale.get() * interactionScale.get() * orbitScale },
      ],
    }
  })
  const orbitLayerStyle = useAnimatedStyle(() => {
    const orbit = descriptor.orbit
    if (!orbit) return { zIndex: descriptor.frame.zIndex ?? 4 }

    const progress = reduceMotion ? 0 : orbitProgress.get()
    const orbitPhase = orbit.phase + progress * (orbit.direction ?? 1)
    const depthAngle = (orbitPhase - (orbit.frontPhase ?? 0.25)) * Math.PI * 2
    const depth = (Math.cos(depthAngle) + 1) / 2
    const backZIndex = orbit.backZIndex ?? 3
    const frontZIndex = orbit.frontZIndex ?? 8

    return {
      zIndex: Math.round(backZIndex + depth * (frontZIndex - backZIndex)),
    }
  })
  const boundsGeometry = descriptor.dragBounds ? geometries.get(descriptor.dragBounds) : undefined
  const dragFriction = Math.max(0.05, Math.min(1, descriptor.dragFriction ?? 0.45))
  const dragReturnToOrigin = descriptor.dragReturnToOrigin !== false
  const pressedScale = descriptor.pressScale ?? 0.96
  const sceneScale = metrics.scale
  const decayDeceleration = 0.99 + dragFriction * 0.008
  const maxDecayVelocity = 1200 * dragFriction
  const panGesture = Gesture.Pan()
    .enabled(Boolean(descriptor.draggable))
    .minDistance(5)
    .onBegin(() => {
      panActive.set(true)
      interactionScale.set(reduceMotion ? pressedScale : withSpring(pressedScale))
      cancelAnimation(dragX)
      cancelAnimation(dragY)
      if (!Number.isFinite(dragX.get())) dragX.set(0)
      if (!Number.isFinite(dragY.get())) dragY.set(0)
      previousTranslationX.set(0)
      previousTranslationY.set(0)
    })
    .onUpdate(event => {
      const translationX = event.translationX
      const translationY = event.translationY
      const deltaX = ((translationX - previousTranslationX.get()) / sceneScale) * dragFriction
      const deltaY = ((translationY - previousTranslationY.get()) / sceneScale) * dragFriction
      previousTranslationX.set(translationX)
      previousTranslationY.set(translationY)

      if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return

      if (!boundsGeometry) {
        dragX.set(current => current + deltaX)
        dragY.set(current => current + deltaY)
        return
      }

      const limits = resolveDragLimits(x, y, width, height, scale, rotation, boundsGeometry)

      dragX.set(applyBoundedDragDelta(dragX.get(), deltaX, limits.minX, limits.maxX))
      dragY.set(applyBoundedDragDelta(dragY.get(), deltaY, limits.minY, limits.maxY))
    })
    .onEnd(event => {
      if (dragReturnToOrigin || reduceMotion) return

      const rawVelocityX = (event.velocityX / sceneScale) * dragFriction
      const rawVelocityY = (event.velocityY / sceneScale) * dragFriction
      const velocityX = Math.max(-maxDecayVelocity, Math.min(maxDecayVelocity, rawVelocityX))
      const velocityY = Math.max(-maxDecayVelocity, Math.min(maxDecayVelocity, rawVelocityY))

      if (!boundsGeometry) {
        dragX.set(withDecay({ velocity: velocityX, deceleration: decayDeceleration }))
        dragY.set(withDecay({ velocity: velocityY, deceleration: decayDeceleration }))
        return
      }

      const limits = resolveDragLimits(x, y, width, height, scale, rotation, boundsGeometry)
      const resistedVelocityX = resistDecayVelocity(
        dragX.get(),
        velocityX,
        limits.minX,
        limits.maxX,
        decayDeceleration
      )
      const resistedVelocityY = resistDecayVelocity(
        dragY.get(),
        velocityY,
        limits.minY,
        limits.maxY,
        decayDeceleration
      )
      dragX.set(
        withDecay({
          velocity: resistedVelocityX,
          deceleration: decayDeceleration,
          clamp: [limits.minX, limits.maxX],
        })
      )
      dragY.set(
        withDecay({
          velocity: resistedVelocityY,
          deceleration: decayDeceleration,
          clamp: [limits.minY, limits.maxY],
        })
      )
    })
    .onFinalize(() => {
      panActive.set(false)
      interactionScale.set(reduceMotion ? 1 : withSpring(1))
      if (dragReturnToOrigin) {
        dragX.set(reduceMotion ? 0 : withSpring(0))
        dragY.set(reduceMotion ? 0 : withSpring(0))
      }
    })
  const onPress = descriptor.onPress
  const tapGesture = Gesture.Tap()
    .enabled(Boolean(onPress))
    .maxDistance(5)
    .onBegin(() => {
      interactionScale.set(reduceMotion ? pressedScale : withSpring(pressedScale))
    })
    .onEnd((_event, success) => {
      if (success && onPress) runOnJS(onPress)()
    })
    .onFinalize(() => {
      if (!panActive.get()) interactionScale.set(reduceMotion ? 1 : withSpring(1))
    })
  const interactionGesture =
    descriptor.draggable && onPress
      ? Gesture.Race(panGesture, tapGesture)
      : descriptor.draggable
        ? panGesture
        : tapGesture
  const enterFromX = (descriptor.enterFrom?.x ?? 0) * metrics.scale
  const enterFromY = (descriptor.enterFrom?.y ?? 0) * metrics.scale
  const enterFromRotation = descriptor.enterFrom?.rotation ?? 0
  const enterFromScale = descriptor.enterFrom?.scale ?? 1
  const exitToX = (descriptor.exitTo?.x ?? 0) * metrics.scale
  const exitToY = (descriptor.exitTo?.y ?? 0) * metrics.scale
  const exitToRotation = descriptor.exitTo?.rotation ?? 0
  const exitToScale = descriptor.exitTo?.scale ?? 1
  const enteringAnimation = () => {
    'worklet'
    const delay = descriptor.enterDelay ?? 0

    return {
      initialValues: {
        opacity: 0,
        transform: [
          { translateX: enterFromX },
          { translateY: enterFromY },
          { scale: enterFromScale },
          { rotate: `${enterFromRotation}deg` },
        ],
      },
      animations: {
        opacity: withDelay(delay, withSpring(1)),
        transform: [
          { translateX: withDelay(delay, withSpring(0)) },
          { translateY: withDelay(delay, withSpring(0)) },
          { scale: withDelay(delay, withSpring(1)) },
          { rotate: withDelay(delay, withSpring('0deg')) },
        ],
      },
    }
  }
  const exitingAnimation = () => {
    'worklet'

    return {
      initialValues: {
        opacity: 1,
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }, { rotate: '0deg' }],
      },
      animations: {
        opacity: withSpring(0),
        transform: [
          { translateX: withSpring(exitToX) },
          { translateY: withSpring(exitToY) },
          { scale: withSpring(exitToScale) },
          { rotate: withSpring(`${exitToRotation}deg`) },
        ],
      },
    }
  }
  const resolvedEntering =
    descriptor.entering === false ? undefined : (descriptor.entering ?? enteringAnimation)
  const resolvedExiting =
    descriptor.exiting === false
      ? undefined
      : (descriptor.exiting ?? (descriptor.exitTo ? exitingAnimation : FadeOut.springify()))

  const visualNode = (
    <AnimatedBox
      position="absolute"
      left={0}
      top={0}
      overflow="visible"
      style={animatedStyle}
      accessible={Boolean(onPress)}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={descriptor.accessibilityLabel}
      onAccessibilityTap={onPress}
      pointerEvents={descriptor.pointerEvents}
    >
      <AnimatedBox
        key={descriptor.contentIdentity}
        collapsable={false}
        style={{ position: 'absolute', inset: 0 }}
        pointerEvents={descriptor.pointerEvents}
        overflow="visible"
        entering={
          reduceMotion || descriptor.contentEntering === false
            ? undefined
            : (descriptor.contentEntering ?? FadeIn.springify())
        }
        exiting={
          reduceMotion || descriptor.contentExiting === false
            ? undefined
            : (descriptor.contentExiting ?? FadeOut.springify())
        }
      >
        {descriptor.children}
      </AnimatedBox>
    </AnimatedBox>
  )
  const interactiveNode =
    descriptor.draggable || onPress ? (
      <GestureDetector gesture={interactionGesture}>{visualNode}</GestureDetector>
    ) : (
      visualNode
    )

  return (
    <AnimatedBox
      collapsable={false}
      position="absolute"
      left={initialFrame.x * metrics.scale}
      top={initialFrame.y * metrics.scale}
      width={initialFrame.width * metrics.scale}
      height={initialFrame.height * metrics.scale}
      overflow="visible"
      zIndex={descriptor.frame.zIndex ?? 4}
      style={orbitLayerStyle}
      entering={reduceMotion ? undefined : resolvedEntering}
      exiting={reduceMotion ? undefined : resolvedExiting}
      pointerEvents={descriptor.pointerEvents === 'none' ? 'none' : 'box-none'}
    >
      {interactiveNode}
    </AnimatedBox>
  )
}

const defaultAnchors: Record<string, SceneNodeAnchor> = {
  center: { x: 0.5, y: 0.5 },
  top: { x: 0.5, y: 0 },
  topLeft: { x: 0, y: 0 },
  topRight: { x: 1, y: 0 },
  right: { x: 1, y: 0.5 },
  bottomRight: { x: 1, y: 1 },
  bottom: { x: 0.5, y: 1 },
  bottomLeft: { x: 0, y: 1 },
  left: { x: 0, y: 0.5 },
}

const resolveEndpoint = (endpoint: SceneConnectionEndpoint, nodes: Map<string, NodeDescriptor>) => {
  const nodeId = endpointNodeId(endpoint)
  const anchorName = typeof endpoint === 'string' ? 'center' : (endpoint.anchor ?? 'center')
  const node = nodes.get(nodeId)
  const anchor = node?.frame.anchors?.[anchorName] ?? defaultAnchors[anchorName]

  return { nodeId, anchor: anchor ?? defaultAnchors.center }
}

const ConnectionRenderer = ({
  connection,
  defaultColor,
  nodes,
  geometries,
  metrics,
  reduceMotion,
}: ConnectionRendererProps) => {
  const from = resolveEndpoint(connection.from, nodes)
  const to = resolveEndpoint(connection.to, nodes)
  const fromGeometry = geometries.get(from.nodeId)
  const toGeometry = geometries.get(to.nodeId)
  const transitionOpacity = useSharedValue(1)
  const previousTransitionKey = useRef(connection.transitionKey)

  useEffect(() => {
    if (previousTransitionKey.current === connection.transitionKey) return

    previousTransitionKey.current = connection.transitionKey
    if (reduceMotion) {
      transitionOpacity.set(1)
      return
    }

    transitionOpacity.set(
      withDelay(connection.transitionDelay ?? 0, withSequence(withSpring(0.18), withSpring(1)))
    )
  }, [connection.transitionDelay, connection.transitionKey, reduceMotion, transitionOpacity])

  const transitionStyle = useAnimatedStyle(() => ({ opacity: transitionOpacity.get() }))

  const animatedProps = useAnimatedProps<PathProps>(() => {
    const point = (geometry: NodeGeometry, anchor: SceneNodeAnchor) => {
      'worklet'

      const centerX = geometry.x.get() + geometry.dragX.get() + geometry.width.get() / 2
      const centerY = geometry.y.get() + geometry.dragY.get() + geometry.height.get() / 2
      const localX = (anchor.x - 0.5) * geometry.width.get() * geometry.scale.get()
      const localY = (anchor.y - 0.5) * geometry.height.get() * geometry.scale.get()
      const radians = (geometry.rotation.get() * Math.PI) / 180

      return {
        x: centerX + localX * Math.cos(radians) - localY * Math.sin(radians),
        y: centerY + localX * Math.sin(radians) + localY * Math.cos(radians),
      }
    }

    if (!fromGeometry || !toGeometry) return { d: '' }

    const start = point(fromGeometry, from.anchor)
    const end = point(toGeometry, to.anchor)
    const x1 = start.x * metrics.scale
    const y1 = start.y * metrics.scale
    const x2 = end.x * metrics.scale
    const y2 = end.y * metrics.scale

    if (
      !Number.isFinite(x1) ||
      !Number.isFinite(y1) ||
      !Number.isFinite(x2) ||
      !Number.isFinite(y2)
    ) {
      return { d: '' }
    }

    if (connection.curve?.type === 'quadratic') {
      const bend = Math.max(-1, Math.min(1, connection.curve.bend ?? 0.25))
      const controlX = (x1 + x2) / 2 - (y2 - y1) * bend
      const controlY = (y1 + y2) / 2 + (x2 - x1) * bend

      return { d: `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}` }
    }

    return { d: `M ${x1} ${y1} L ${x2} ${y2}` }
  })

  if (!fromGeometry || !toGeometry) return null

  const resolvedExiting =
    connection.exiting === false ? undefined : (connection.exiting ?? FadeOut.springify())

  return (
    <AnimatedBox
      collapsable={false}
      position="absolute"
      left={0}
      top={0}
      width={metrics.width}
      height={metrics.height}
      entering={reduceMotion ? undefined : FadeIn.springify().delay(connection.enterDelay ?? 0)}
      exiting={reduceMotion ? undefined : resolvedExiting}
      pointerEvents="none"
    >
      <AnimatedBox absoluteFill style={transitionStyle} pointerEvents="none">
        <Svg width={metrics.width} height={metrics.height}>
          <AnimatedPath
            animatedProps={animatedProps}
            fill="none"
            stroke={connection.color ?? defaultColor}
            strokeOpacity={connection.opacity ?? 0.35}
            strokeWidth={(connection.width ?? 1.5) * metrics.scale}
          />
        </Svg>
      </AnimatedBox>
    </AnimatedBox>
  )
}

/**
 * Reconciles declarative scene graphs while keeping keyed node containers
 * outside the scene-specific React subtree. Direct, non-marker children keep
 * the normal mount/unmount lifecycle of their scene.
 */
export const SceneGraph = ({
  activeSceneId,
  connectionColor,
  metrics,
  reduceMotion,
  children,
}: SceneGraphProps) => {
  const scenes = compileScenes(children)
  const activeScene = scenes.find(scene => scene.id === activeSceneId)
  const [geometries] = useState(() => new Map<string, NodeGeometry>())
  const [, notifyGeometryChange] = useState(0)
  const orbitProgress = useSharedValue(0)

  if (!activeScene) throw new Error(`Unknown onboarding scene: ${activeSceneId}`)

  const sceneOrbit = activeScene.nodes.find(node => node.orbit)?.orbit
  const orbitDuration = sceneOrbit?.duration
  const orbitStartDelay = sceneOrbit?.startDelay ?? 0
  const nodesById = new Map(activeScene.nodes.map(node => [node.id, node]))

  useEffect(() => {
    cancelAnimation(orbitProgress)
    orbitProgress.set(0)

    if (orbitDuration === undefined || reduceMotion) return

    orbitProgress.set(
      withDelay(
        orbitStartDelay,
        withRepeat(
          withTiming(1, {
            duration: orbitDuration,
            easing: Easing.linear,
          }),
          -1,
          false
        )
      )
    )

    return () => cancelAnimation(orbitProgress)
  }, [activeSceneId, orbitDuration, orbitProgress, orbitStartDelay, reduceMotion])

  return (
    <Box flex={1} overflow="visible" collapsable={false}>
      {activeScene.layers.map(layer => (
        <AnimatedBox
          key={`${activeScene.id}:${layer.key}`}
          collapsable={false}
          position="absolute"
          left={0}
          top={0}
          width={metrics.width}
          height={metrics.height}
          zIndex={layer.zIndex}
          overflow="visible"
          entering={reduceMotion ? undefined : FadeIn.springify()}
          exiting={reduceMotion ? undefined : FadeOut.springify()}
          pointerEvents="box-none"
        >
          {layer.children}
        </AnimatedBox>
      ))}

      <Box
        position="absolute"
        left={0}
        top={0}
        width={metrics.width}
        height={metrics.height}
        zIndex={2}
        pointerEvents="none"
      >
        {activeScene.connections.map(connection => (
          <ConnectionRenderer
            key={connection.key}
            connection={connection}
            defaultColor={connectionColor}
            nodes={nodesById}
            geometries={geometries}
            metrics={metrics}
            reduceMotion={reduceMotion}
          />
        ))}
      </Box>

      {activeScene.nodes.map(node => (
        <NodeRenderer
          key={node.id}
          descriptor={node}
          orbitProgress={orbitProgress}
          metrics={metrics}
          reduceMotion={reduceMotion}
          geometries={geometries}
          notifyGeometryChange={notifyGeometryChange}
        />
      ))}
    </Box>
  )
}
