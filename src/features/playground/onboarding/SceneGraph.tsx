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
import {
  createAnimatedComponent,
  FadeIn,
  FadeOut,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Line, type LineProps } from 'react-native-svg'

import Box, { AnimatedBox } from '~common/ui/Box'
import type { OnboardingStageMetrics } from './OnboardingStage'

export type SceneLayoutMode = 'auto' | 'position' | 'resize' | 'scale'

export type SceneNodeAnchor = {
  x: number
  y: number
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

type SceneProps = {
  id: string
  children: ReactNode
}

type SceneNodeProps = {
  id: string
  frame: SceneNodeFrame
  layout?: SceneLayoutMode
  children: ReactElement
}

type SceneConnectionProps = {
  from: SceneConnectionEndpoint
  to: SceneConnectionEndpoint
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
  width: SharedValue<number>
  height: SharedValue<number>
  scale: SharedValue<number>
  rotation: SharedValue<number>
}

type NodeRendererProps = {
  descriptor: NodeDescriptor
  isExiting: boolean
  metrics: OnboardingStageMetrics
  reduceMotion: boolean
  geometries: React.MutableRefObject<Map<string, NodeGeometry>>
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

const AnimatedLine = createAnimatedComponent(Line)
const NODE_EXIT_DURATION = 220
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

const getContentIdentity = (content: ReactElement) => {
  const type = content.type

  if (typeof type === 'string') return `host:${type}`

  if (!contentTypeIds.has(type)) {
    nextContentTypeId += 1
    contentTypeIds.set(type, nextContentTypeId)
  }

  return `component:${contentTypeIds.get(type)}`
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
      nodes.push({ ...props, contentIdentity: getContentIdentity(props.children) })
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

const withSceneTiming = (value: number, reduceMotion: boolean) =>
  reduceMotion ? value : withTiming(value, { duration: 560 })

const NodeRenderer = ({
  descriptor,
  isExiting,
  metrics,
  reduceMotion,
  geometries,
  notifyGeometryChange,
}: NodeRendererProps) => {
  const initialFrame = useRef(descriptor.frame).current
  const x = useSharedValue(initialFrame.x)
  const y = useSharedValue(initialFrame.y)
  const width = useSharedValue(initialFrame.width)
  const height = useSharedValue(initialFrame.height)
  const scale = useSharedValue(initialFrame.scale ?? 1)
  const rotation = useSharedValue(initialFrame.rotation ?? 0)
  const opacity = useSharedValue(initialFrame.opacity ?? 1)

  useLayoutEffect(() => {
    const geometryRegistry = geometries.current
    const geometry = { x, y, width, height, scale, rotation }
    geometryRegistry.set(descriptor.id, geometry)
    notifyGeometryChange(version => version + 1)

    return () => {
      if (geometryRegistry.get(descriptor.id) === geometry) {
        geometryRegistry.delete(descriptor.id)
        notifyGeometryChange(version => version + 1)
      }
    }
  }, [descriptor.id, geometries, height, notifyGeometryChange, rotation, scale, width, x, y])

  useEffect(() => {
    const mode = descriptor.layout ?? 'auto'
    const shouldResize =
      mode === 'resize' ||
      (mode === 'auto' &&
        (descriptor.frame.width !== initialFrame.width ||
          descriptor.frame.height !== initialFrame.height))

    x.set(withSceneTiming(descriptor.frame.x, reduceMotion))
    y.set(withSceneTiming(descriptor.frame.y, reduceMotion))
    width.set(
      withSceneTiming(shouldResize ? descriptor.frame.width : initialFrame.width, reduceMotion)
    )
    height.set(
      withSceneTiming(shouldResize ? descriptor.frame.height : initialFrame.height, reduceMotion)
    )
    scale.set(
      withSceneTiming(
        mode === 'position' || shouldResize ? 1 : (descriptor.frame.scale ?? 1),
        reduceMotion
      )
    )
    rotation.set(withSceneTiming(descriptor.frame.rotation ?? 0, reduceMotion))
    opacity.set(
      isExiting
        ? reduceMotion
          ? 0
          : withTiming(0, { duration: NODE_EXIT_DURATION })
        : withSceneTiming(descriptor.frame.opacity ?? 1, reduceMotion)
    )
  }, [
    descriptor.frame,
    descriptor.layout,
    height,
    initialFrame,
    isExiting,
    opacity,
    reduceMotion,
    rotation,
    scale,
    width,
    x,
    y,
  ])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    width: width.get() * metrics.scale,
    height: height.get() * metrics.scale,
    transform: [
      { translateX: (x.get() - initialFrame.x) * metrics.scale },
      { translateY: (y.get() - initialFrame.y) * metrics.scale },
      { rotate: `${rotation.get()}deg` },
      { scale: scale.get() },
    ],
  }))

  return (
    <AnimatedBox
      position="absolute"
      left={initialFrame.x * metrics.scale}
      top={initialFrame.y * metrics.scale}
      width={initialFrame.width * metrics.scale}
      height={initialFrame.height * metrics.scale}
      overflow="visible"
      zIndex={descriptor.frame.zIndex ?? 4}
      entering={isExiting || reduceMotion ? undefined : FadeIn.duration(280)}
    >
      <AnimatedBox position="absolute" left={0} top={0} style={animatedStyle}>
        <AnimatedBox
          key={descriptor.contentIdentity}
          entering={reduceMotion ? undefined : FadeIn.duration(260)}
          exiting={reduceMotion ? undefined : FadeOut.duration(220)}
          style={{ position: 'absolute', inset: 0 }}
        >
          {descriptor.children}
        </AnimatedBox>
      </AnimatedBox>
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

  const animatedProps = useAnimatedProps<LineProps>(() => {
    const point = (geometry: NodeGeometry, anchor: SceneNodeAnchor) => {
      'worklet'

      const centerX = geometry.x.get() + geometry.width.get() / 2
      const centerY = geometry.y.get() + geometry.height.get() / 2
      const localX = (anchor.x - 0.5) * geometry.width.get() * geometry.scale.get()
      const localY = (anchor.y - 0.5) * geometry.height.get() * geometry.scale.get()
      const radians = (geometry.rotation.get() * Math.PI) / 180

      return {
        x: centerX + localX * Math.cos(radians) - localY * Math.sin(radians),
        y: centerY + localX * Math.sin(radians) + localY * Math.cos(radians),
      }
    }

    if (!fromGeometry || !toGeometry) return { x1: 0, y1: 0, x2: 0, y2: 0 }

    const start = point(fromGeometry, from.anchor)
    const end = point(toGeometry, to.anchor)

    return {
      x1: start.x * metrics.scale,
      y1: start.y * metrics.scale,
      x2: end.x * metrics.scale,
      y2: end.y * metrics.scale,
    }
  })

  if (!fromGeometry || !toGeometry) return null

  return (
    <AnimatedBox
      position="absolute"
      left={0}
      top={0}
      width={metrics.width}
      height={metrics.height}
      entering={reduceMotion ? undefined : FadeIn.duration(360)}
      exiting={reduceMotion ? undefined : FadeOut.duration(180)}
      pointerEvents="none"
    >
      <Svg width={metrics.width} height={metrics.height}>
        <AnimatedLine
          animatedProps={animatedProps}
          stroke={connection.color ?? defaultColor}
          strokeOpacity={connection.opacity ?? 0.35}
          strokeWidth={(connection.width ?? 1.5) * metrics.scale}
        />
      </Svg>
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
  const geometries = useRef(new Map<string, NodeGeometry>())
  const [, notifyGeometryChange] = useState(0)
  const lastCommittedNodes = useRef(activeScene?.nodes ?? [])
  const [transition, setTransition] = useState<{
    sceneId: string
    exitingNodes: NodeDescriptor[]
  }>({ sceneId: activeSceneId, exitingNodes: [] })

  if (!activeScene) throw new Error(`Unknown onboarding scene: ${activeSceneId}`)

  if (transition.sceneId !== activeSceneId) {
    const incomingIds = new Set(activeScene.nodes.map(node => node.id))
    setTransition({
      sceneId: activeSceneId,
      exitingNodes: lastCommittedNodes.current.filter(node => !incomingIds.has(node.id)),
    })
  }

  useLayoutEffect(() => {
    lastCommittedNodes.current = activeScene.nodes
  }, [activeScene.nodes])

  useEffect(() => {
    if (transition.exitingNodes.length === 0) return

    const timeout = setTimeout(
      () => setTransition(current => ({ ...current, exitingNodes: [] })),
      reduceMotion ? 0 : NODE_EXIT_DURATION + 16
    )

    return () => clearTimeout(timeout)
  }, [reduceMotion, transition.exitingNodes])

  const nodesById = new Map(activeScene.nodes.map(node => [node.id, node]))
  const exitingNodes =
    transition.sceneId === activeSceneId ? transition.exitingNodes : lastCommittedNodes.current
  const renderedNodes = [
    ...activeScene.nodes.map(node => ({ node, isExiting: false })),
    ...exitingNodes.map(node => ({ node, isExiting: true })),
  ]

  return (
    <Box flex={1} overflow="visible">
      {activeScene.layers.map(layer => (
        <AnimatedBox
          key={`${activeScene.id}:${layer.key}`}
          position="absolute"
          left={0}
          top={0}
          width={metrics.width}
          height={metrics.height}
          zIndex={layer.zIndex}
          overflow="visible"
          entering={reduceMotion ? undefined : FadeIn.duration(260)}
          exiting={reduceMotion ? undefined : FadeOut.duration(220)}
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
            geometries={geometries.current}
            metrics={metrics}
            reduceMotion={reduceMotion}
          />
        ))}
      </Box>

      {renderedNodes.map(({ node, isExiting }) => (
        <NodeRenderer
          key={node.id}
          descriptor={node}
          isExiting={isExiting}
          metrics={metrics}
          reduceMotion={reduceMotion}
          geometries={geometries}
          notifyGeometryChange={notifyGeometryChange}
        />
      ))}
    </Box>
  )
}
