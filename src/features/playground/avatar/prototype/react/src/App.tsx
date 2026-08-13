import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react'
import { motionValue, type MotionValue } from 'motion'
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { ArrowLeft, Pause, Pencil, Play, Plus, RotateCcw, Square, Trash2 } from 'lucide-react'

import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Field, FieldTitle } from './components/ui/field'
import { Input } from './components/ui/input'
import { Separator } from './components/ui/separator'
import { Switch } from './components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip'
import { StudioLanguageProvider, useStudioLanguage, type StudioLanguage } from './i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './components/ui/alert-dialog'

import {
  bodyPrimitiveTypes,
  createBodyNode,
  duplicateBodyNode,
  MAX_BODY_NODES,
  type BodyNode,
} from './body'
import {
  applyAvatarEyeDefaults,
  createAvatar,
  defaultAvatarEyes,
  loadAvatarLibrary,
  loadGlobalExpressions,
  persistAvatarLibrary,
  persistGlobalExpressions,
  type StudioAvatar,
  type AvatarColors,
  type AvatarEyeDefaults,
} from './avatars'
import {
  expressionFields,
  poseFromExpression,
  renderAvatar,
  renderBodyNodeEditor,
  renderEyeEditor,
  rotateBodyNodeAroundLocalAxis,
  rotateExpressionAroundAxis,
  rotateExpressionAroundCamera,
  rotateExpressionWithArcball,
  rotationRing,
  translateBodyNodeAlongLocalAxis,
  type AvatarPose,
  type Expression,
  type Point3,
} from './geometry'
import {
  defaultExpression,
  getStatePlaybackConfig,
  stateGroups,
  stateNotes,
  statePools,
} from './presets'
import { surfaceLabels, surfacePresets, type SurfaceConfig } from './surfaces'

type Mode = 'manual' | 'expressions' | 'states'
type Side = 'Left' | 'Right'
type NumericProps = {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (value: number) => void
  onActiveChange?: (active: boolean) => void
}
type Highlight = 'head' | 'left' | 'right' | 'both' | null

const BODY_RENDER_PATH_SLOTS = MAX_BODY_NODES + 2
const RETARGET_BLEND_MS = 120
const INSPECTOR_FRAME_MS = 1000 / 24
const emptyBodyNodes: BodyNode[] = []
const previewGeometryCache = new WeakMap<
  Expression,
  WeakMap<
    SurfaceConfig,
    WeakMap<BodyNode[], { positionKey: string; geometry: ReturnType<typeof renderAvatar> }>
  >
>()

const poseWithAvatarEyes = (expression: Expression, eyes: AvatarEyeDefaults) =>
  poseFromExpression(applyAvatarEyeDefaults(expression, eyes))

const getPreviewGeometry = (
  expression: Expression,
  surface: SurfaceConfig,
  bodyNodes: BodyNode[],
  eyes: AvatarEyeDefaults = defaultAvatarEyes
) => {
  let surfaceCache = previewGeometryCache.get(expression)
  if (!surfaceCache) {
    surfaceCache = new WeakMap()
    previewGeometryCache.set(expression, surfaceCache)
  }
  let bodyCache = surfaceCache.get(surface)
  if (!bodyCache) {
    bodyCache = new WeakMap()
    surfaceCache.set(surface, bodyCache)
  }
  const positionKey = JSON.stringify(eyes)
  const cached = bodyCache.get(bodyNodes)
  if (cached?.positionKey === positionKey) return cached.geometry
  const geometry = renderAvatar(poseWithAvatarEyes(expression, eyes), surface, 1, {
    includeWire: false,
    bodyNodes,
  })
  bodyCache.set(bodyNodes, { positionKey, geometry })
  return geometry
}

const bounded = (value: number, min?: number, max?: number) =>
  Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value))

const formatSeconds = (milliseconds: number, language: StudioLanguage) =>
  `${new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(milliseconds / 1000)} s`

const resolveColors = (expression: Expression, colors: AvatarColors): AvatarColors => ({
  body: expression.bodyColor ?? colors.body,
  eyes: expression.eyeColor ?? colors.eyes,
})

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useStudioLanguage()
  const translatedLabel = t(label)
  return (
    <Field className="color-field">
      <FieldTitle>{translatedLabel}</FieldTitle>
      <span className="color-control">
        <Input
          aria-label={`${translatedLabel} · ${t('sélecteur')}`}
          className="color-swatch"
          type="color"
          value={value}
          onChange={event => onChange(event.currentTarget.value)}
        />
        <Input
          aria-label={`${translatedLabel} · ${t('hexadécimal')}`}
          className="color-value"
          key={value}
          defaultValue={value.toUpperCase()}
          spellCheck={false}
          onChange={event => {
            const next = event.currentTarget.value.toUpperCase()
            if (/^#[0-9A-F]{6}$/.test(next)) onChange(next.toLowerCase())
          }}
          onBlur={event => {
            if (!/^#[0-9A-F]{6}$/.test(event.currentTarget.value.toUpperCase())) {
              event.currentTarget.value = value.toUpperCase()
            }
          }}
        />
      </span>
    </Field>
  )
}

function NumericField({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit = '',
  onChange,
  onActiveChange,
}: NumericProps) {
  const { t } = useStudioLanguage()
  const translatedLabel = t(label)
  const dragRef = useRef<{ x: number; value: number } | null>(null)

  const startScrub = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    onActiveChange?.(true)
    dragRef.current = { x: event.clientX, value }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const scrub = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const speed = event.shiftKey ? 10 : event.altKey ? 0.1 : 1
    const next = dragRef.current.value + (event.clientX - dragRef.current.x) * step * speed
    onChange(bounded(next, min, max))
  }

  const stopScrub = () => {
    dragRef.current = null
    onActiveChange?.(false)
  }

  return (
    <Field className="numeric-field" orientation="horizontal">
      <Button
        className="scrub-label"
        variant="ghost"
        size="sm"
        type="button"
        title={t('Glisser horizontalement pour modifier')}
        onPointerDown={startScrub}
        onPointerMove={scrub}
        onPointerUp={stopScrub}
        onPointerCancel={stopScrub}
      >
        <span>{translatedLabel}</span>
        <span className="scrub-icon" aria-hidden="true">
          ↔
        </span>
      </Button>
      <label className="number-shell">
        <Input
          type="number"
          aria-label={translatedLabel}
          min={min}
          max={max}
          step={step}
          value={Number(value.toFixed(step < 0.1 ? 2 : 1))}
          onFocus={() => onActiveChange?.(true)}
          onBlur={() => onActiveChange?.(false)}
          onChange={event => {
            const next = event.currentTarget.valueAsNumber
            if (Number.isFinite(next)) onChange(bounded(next, min, max))
          }}
        />
        <span>{unit}</span>
      </label>
    </Field>
  )
}

function LinkButton({
  linked,
  onClick,
  label,
}: {
  linked: boolean
  onClick: () => void
  label: string
}) {
  const { t } = useStudioLanguage()
  return (
    <Button
      type="button"
      className="link-button"
      variant="outline"
      size="icon-sm"
      aria-pressed={linked}
      aria-label={t(label)}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
      </svg>
    </Button>
  )
}

function RotationGizmo({
  expression,
  onChange,
  onActiveChange,
  onReset,
}: {
  expression: Expression
  onChange: (next: Expression) => void
  onActiveChange: (active: boolean) => void
  onReset: () => void
}) {
  const { t } = useStudioLanguage()
  const drag = useRef<
    | {
        type: 'axis'
        axis: 'x' | 'y' | 'z'
        startPoint: readonly [number, number]
        tangent: readonly [number, number]
        expression: Expression
      }
    | { type: 'view'; startAngle: number; expression: Expression }
    | null
  >(null)
  const pose = poseFromExpression(expression)
  const rings = {
    x: rotationRing(pose, 'x'),
    y: rotationRing(pose, 'y'),
    z: rotationRing(pose, 'z'),
  }
  const toLocal = (event: React.PointerEvent<SVGElement>): readonly [number, number] => {
    const rectangle = event.currentTarget.ownerSVGElement!.getBoundingClientRect()
    return [
      ((event.clientX - rectangle.left) / rectangle.width) * 86 - 43,
      ((event.clientY - rectangle.top) / rectangle.height) * 86 - 43,
    ]
  }
  const ringPath = (points: Point3[]) =>
    `M${points[0][0]} ${points[0][1]}${points
      .slice(1)
      .map(point => `L${point[0]} ${point[1]}`)
      .join('')}Z`
  const unitVector = (from: Point3, to: Point3): readonly [number, number] => {
    const x = to[0] - from[0]
    const y = to[1] - from[1]
    const length = Math.hypot(x, y) || 1
    return [x / length, y / length]
  }
  const startAxis = (axis: 'x' | 'y' | 'z', event: React.PointerEvent<SVGElement>) => {
    event.stopPropagation()
    onActiveChange(true)
    const point = toLocal(event)
    const ring = rings[axis]
    let closestIndex = 0
    let closestDistance = Number.POSITIVE_INFINITY
    ring.slice(0, -1).forEach((ringPoint, index) => {
      const distance = Math.hypot(ringPoint[0] - point[0], ringPoint[1] - point[1])
      if (distance < closestDistance) {
        closestIndex = index
        closestDistance = distance
      }
    })
    const previous = ring[(closestIndex - 1 + ring.length - 1) % (ring.length - 1)]
    const next = ring[(closestIndex + 1) % (ring.length - 1)]
    drag.current = {
      type: 'axis',
      axis,
      startPoint: point,
      tangent: unitVector(previous, next),
      expression,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startView = (event: React.PointerEvent<SVGElement>) => {
    event.stopPropagation()
    onActiveChange(true)
    const point = toLocal(event)
    drag.current = { type: 'view', startAngle: Math.atan2(point[1], point[0]), expression }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: React.PointerEvent<SVGElement>) => {
    if (!drag.current) return
    const point = toLocal(event)
    if (drag.current.type === 'view') {
      const currentAngle = Math.atan2(point[1], point[0])
      const delta = Math.atan2(
        Math.sin(currentAngle - drag.current.startAngle),
        Math.cos(currentAngle - drag.current.startAngle)
      )
      onChange(rotateExpressionAroundCamera(drag.current.expression, delta))
      return
    }
    const signedDistance =
      (point[0] - drag.current.startPoint[0]) * drag.current.tangent[0] +
      (point[1] - drag.current.startPoint[1]) * drag.current.tangent[1]
    onChange(
      rotateExpressionAroundAxis(drag.current.expression, drag.current.axis, signedDistance * 1.5)
    )
  }
  const stop = () => {
    drag.current = null
    onActiveChange(false)
  }
  return (
    <div className="gizmo-cluster">
      <svg className="gizmo" viewBox="-43 -43 86 86" aria-label={t('Gizmo de rotation')}>
        <circle
          className="gizmo-orbit gizmo-camera"
          cx="0"
          cy="0"
          r="38"
          onPointerDown={startView}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
        <path
          className="gizmo-orbit gizmo-y"
          d={ringPath(rings.y)}
          onPointerDown={event => startAxis('y', event)}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
        <path
          className="gizmo-orbit gizmo-x"
          d={ringPath(rings.x)}
          onPointerDown={event => startAxis('x', event)}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
        <path
          className="gizmo-orbit gizmo-z"
          d={ringPath(rings.z)}
          onPointerDown={event => startAxis('z', event)}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
      </svg>
      <Button
        className="gizmo-reset"
        variant="secondary"
        size="icon-sm"
        aria-label={t('Réinitialiser la rotation de la tête')}
        onClick={onReset}
      >
        <RotateCcw />
      </Button>
    </div>
  )
}

type TransformAxis = 'x' | 'y' | 'z'

function BodyNodeGizmo({
  svgRef,
  pose,
  node,
  onPreview,
  onCommit,
}: {
  svgRef: React.RefObject<SVGSVGElement | null>
  pose: AvatarPose
  node: BodyNode
  onPreview: (next: BodyNode) => void
  onCommit: (next: BodyNode) => void
}) {
  const { t } = useStudioLanguage()
  const geometry = renderBodyNodeEditor(pose, node)
  const [activeControl, setActiveControl] = useState<
    { mode: 'translate' | 'rotate'; axis: TransformAxis } | undefined
  >(undefined)
  const drag = useRef<
    | {
        mode: 'translate' | 'rotate'
        axis: TransformAxis
        startPoint: readonly [number, number]
        direction: readonly [number, number]
        scale: number
        node: BodyNode
      }
    | undefined
  >(undefined)
  const latestNode = useRef(node)
  const previewFrame = useRef<number | undefined>(undefined)
  const axes: TransformAxis[] = ['x', 'y', 'z']
  const toSvg = (event: React.PointerEvent<SVGElement>): readonly [number, number] => {
    const rectangle = svgRef.current!.getBoundingClientRect()
    return [
      ((event.clientX - rectangle.left) / rectangle.width) * 300 - 150,
      ((event.clientY - rectangle.top) / rectangle.height) * 300 - 150,
    ]
  }
  const directionBetween = (from: Point3, to: Point3): readonly [number, number] => {
    const x = to[0] - from[0]
    const y = to[1] - from[1]
    const length = Math.hypot(x, y) || 1
    return [x / length, y / length]
  }
  const ringPath = (points: Point3[]) =>
    `M${points.map(point => `${point[0]} ${point[1]}`).join('L')}Z`
  const startTranslate = (axis: TransformAxis, event: React.PointerEvent<SVGElement>) => {
    event.stopPropagation()
    const endpoint = geometry.axes[axis]
    const length = Math.max(
      Math.hypot(endpoint[0] - geometry.center[0], endpoint[1] - geometry.center[1]),
      1
    )
    drag.current = {
      mode: 'translate',
      axis,
      startPoint: toSvg(event),
      direction: directionBetween(geometry.center, endpoint),
      scale: 34 / length,
      node,
    }
    setActiveControl({ mode: 'translate', axis })
    latestNode.current = node
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startRotate = (axis: TransformAxis, event: React.PointerEvent<SVGElement>) => {
    event.stopPropagation()
    const point = toSvg(event)
    const ring = geometry.rings[axis]
    let closestIndex = 0
    let closestDistance = Infinity
    ring.slice(0, -1).forEach((ringPoint, index) => {
      const distance = Math.hypot(ringPoint[0] - point[0], ringPoint[1] - point[1])
      if (distance < closestDistance) {
        closestIndex = index
        closestDistance = distance
      }
    })
    const previous = ring[(closestIndex - 1 + ring.length - 1) % (ring.length - 1)]
    const next = ring[(closestIndex + 1) % (ring.length - 1)]
    const radius = Math.max(
      Math.hypot(
        ring[closestIndex][0] - geometry.center[0],
        ring[closestIndex][1] - geometry.center[1]
      ),
      8
    )
    drag.current = {
      mode: 'rotate',
      axis,
      startPoint: point,
      direction: directionBetween(previous, next),
      scale: 180 / Math.PI / radius,
      node,
    }
    setActiveControl({ mode: 'rotate', axis })
    latestNode.current = node
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: React.PointerEvent<SVGElement>) => {
    if (!drag.current) return
    const interaction = drag.current
    const point = toSvg(event)
    const deltaX = point[0] - interaction.startPoint[0]
    const deltaY = point[1] - interaction.startPoint[1]
    const delta =
      (deltaX * interaction.direction[0] + deltaY * interaction.direction[1]) * interaction.scale
    const next =
      interaction.mode === 'translate'
        ? translateBodyNodeAlongLocalAxis(interaction.node, interaction.axis, delta)
        : rotateBodyNodeAroundLocalAxis(interaction.node, interaction.axis, delta)
    latestNode.current = next
    if (previewFrame.current !== undefined) return
    previewFrame.current = requestAnimationFrame(() => {
      previewFrame.current = undefined
      onPreview(latestNode.current)
    })
  }
  const stop = () => {
    if (previewFrame.current !== undefined) cancelAnimationFrame(previewFrame.current)
    previewFrame.current = undefined
    onCommit(latestNode.current)
    drag.current = undefined
    setActiveControl(undefined)
  }
  const resetTransform = (event: React.MouseEvent<SVGGElement>) => {
    event.stopPropagation()
    const resetNode: BodyNode = { ...node, position: [0, 0, 0], rotation: [0, 0, 0] }
    latestNode.current = resetNode
    onCommit(resetNode)
  }

  useEffect(
    () => () => {
      if (previewFrame.current !== undefined) cancelAnimationFrame(previewFrame.current)
    },
    []
  )

  return (
    <g className="body-node-gizmo" aria-label={`${t('Transformer')} ${t(node.name)}`}>
      {axes.map(axis => (
        <g key={`ring-${axis}`}>
          <path
            className="body-gizmo-hitbox body-gizmo-ring-hitbox"
            d={ringPath(geometry.rings[axis])}
            onPointerDown={event => startRotate(axis, event)}
            onPointerMove={move}
            onPointerUp={stop}
            onPointerCancel={stop}
          />
          <path
            className={`body-gizmo-ring gizmo-${axis}${activeControl?.mode === 'rotate' && activeControl.axis === axis ? ' is-active' : ''}`}
            d={ringPath(geometry.rings[axis])}
            pointerEvents="none"
          />
        </g>
      ))}
      {axes.map(axis => (
        <g key={`axis-${axis}`}>
          <path
            className="body-gizmo-hitbox body-gizmo-axis-hitbox"
            d={`M${geometry.center[0]} ${geometry.center[1]}L${geometry.axes[axis][0]} ${geometry.axes[axis][1]}`}
            onPointerDown={event => startTranslate(axis, event)}
            onPointerMove={move}
            onPointerUp={stop}
            onPointerCancel={stop}
          />
          <path
            className={`body-gizmo-axis gizmo-${axis}${activeControl?.mode === 'translate' && activeControl.axis === axis ? ' is-active' : ''}`}
            d={`M${geometry.center[0]} ${geometry.center[1]}L${geometry.axes[axis][0]} ${geometry.axes[axis][1]}`}
            pointerEvents="none"
          />
          <circle
            className={`body-gizmo-handle gizmo-${axis}`}
            cx={geometry.axes[axis][0]}
            cy={geometry.axes[axis][1]}
            r="3.5"
            pointerEvents="none"
          />
          <text
            className={`body-gizmo-label body-gizmo-label-${axis}`}
            x={geometry.axes[axis][0]}
            y={geometry.axes[axis][1] - 5}
          >
            {axis.toUpperCase()}
          </text>
        </g>
      ))}
      <circle className="body-gizmo-origin" cx={geometry.center[0]} cy={geometry.center[1]} r="3" />
      <g
        className="body-gizmo-reset"
        role="button"
        tabIndex={0}
        aria-label={t(`Réinitialiser la position et la rotation de ${node.name}`)}
        transform={`translate(${bounded(geometry.center[0] + 32, -140, 140)} ${bounded(geometry.center[1] - 32, -140, 140)})`}
        onClick={resetTransform}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          const resetNode: BodyNode = { ...node, position: [0, 0, 0], rotation: [0, 0, 0] }
          latestNode.current = resetNode
          onCommit(resetNode)
        }}
      >
        <circle r="6.5" />
        <text y="2.5">↺</text>
      </g>
    </g>
  )
}

function AvatarCanvas({
  expression,
  avatarEyes,
  surface,
  wirePaths,
  showWire,
  backPaths,
  frontPaths,
  backNodeIds,
  frontNodeIds,
  bodyEditing,
  selectedBodyNodeId,
  selectedBodyNode,
  selectedSide,
  headPath,
  leftPath,
  rightPath,
  leftOpacity,
  rightOpacity,
  linked,
  highlight,
  onHighlightChange,
  onBodyNodeSelect,
  onBodyNodePreview,
  onBodyNodeChange,
  onEyeSelect,
  onChange,
  onEyeChange,
}: {
  expression: Expression
  avatarEyes: AvatarEyeDefaults
  surface: SurfaceConfig
  wirePaths: MotionValue<string>[]
  showWire: boolean
  backPaths: MotionValue<string>[]
  frontPaths: MotionValue<string>[]
  backNodeIds: { current: (string | null)[] }
  frontNodeIds: { current: (string | null)[] }
  bodyEditing: boolean
  selectedBodyNodeId: 'primary' | string | null
  selectedBodyNode: BodyNode | null
  selectedSide: -1 | 1 | null
  headPath: MotionValue<string>
  leftPath: MotionValue<string>
  rightPath: MotionValue<string>
  leftOpacity: MotionValue<number>
  rightOpacity: MotionValue<number>
  linked: { width: boolean; height: boolean; size: boolean }
  highlight: Highlight
  onHighlightChange: (highlight: Highlight) => void
  onBodyNodeSelect: (id: 'primary' | string | null) => void
  onBodyNodePreview: (next: BodyNode) => void
  onBodyNodeChange: (next: BodyNode) => void
  onEyeSelect: (side: -1 | 1) => void
  onChange: (next: Expression) => void
  onEyeChange?: (next: Expression) => void
}) {
  const { t } = useStudioLanguage()
  const svgRef = useRef<SVGSVGElement>(null)
  const [activeDragType, setActiveDragType] = useState<
    'arcball' | 'width' | 'height' | 'size' | 'spacing' | 'rotate' | null
  >(null)
  const drag = useRef<
    | {
        type: 'arcball'
        startPoint: readonly [number, number]
        expression: Expression
      }
    | {
        type: 'width' | 'height' | 'size' | 'spacing' | 'rotate'
        side: -1 | 1
        startPoint: readonly [number, number]
        expression: Expression
        center: Point3
        widthAxis: readonly [number, number]
        heightAxis: readonly [number, number]
        spacingAxis: readonly [number, number]
        startPointerAngle: number
        startDistance: number
      }
    | null
  >(null)
  const editor =
    selectedSide === null
      ? null
      : renderEyeEditor(poseWithAvatarEyes(expression, avatarEyes), surface, selectedSide)
  const selectedBodyPath = (() => {
    if (!bodyEditing || !selectedBodyNodeId) return null
    if (selectedBodyNodeId === 'primary') return headPath
    const backIndex = backNodeIds.current.indexOf(selectedBodyNodeId)
    if (backIndex >= 0) return backPaths[backIndex]
    const frontIndex = frontNodeIds.current.indexOf(selectedBodyNodeId)
    return frontIndex >= 0 ? frontPaths[frontIndex] : null
  })()

  const toSvg = (event: React.PointerEvent<SVGElement>): readonly [number, number] => {
    const rectangle = svgRef.current!.getBoundingClientRect()
    return [
      ((event.clientX - rectangle.left) / rectangle.width) * 300 - 150,
      ((event.clientY - rectangle.top) / rectangle.height) * 300 - 150,
    ]
  }
  const unitVector = (from: Point3, to: Point3): readonly [number, number] => {
    const x = to[0] - from[0]
    const y = to[1] - from[1]
    const length = Math.hypot(x, y) || 1
    return [x / length, y / length]
  }
  const startDrag = (event: React.PointerEvent<SVGElement>) => {
    onBodyNodeSelect('primary')
    onHighlightChange('head')
    drag.current = {
      type: 'arcball',
      startPoint: toSvg(event),
      expression,
    }
    setActiveDragType('arcball')
    svgRef.current!.setPointerCapture(event.pointerId)
  }
  const selectBodyPath = (
    event: React.PointerEvent<SVGPathElement>,
    nodeId: string | null | undefined
  ) => {
    if (!nodeId || !bodyEditing) {
      startDrag(event)
      return
    }
    event.stopPropagation()
    onBodyNodeSelect(nodeId)
  }
  const selectEye = (side: -1 | 1, event: React.PointerEvent<SVGPathElement>) => {
    event.stopPropagation()
    onBodyNodeSelect(null)
    onEyeSelect(side)
  }
  const startHandle = (
    type: 'width' | 'height' | 'size' | 'spacing' | 'rotate',
    event: React.PointerEvent<SVGElement>
  ) => {
    event.stopPropagation()
    if (selectedSide === null || !editor) return
    onHighlightChange(selectedSide < 0 ? 'left' : 'right')
    const point = toSvg(event)
    const editableExpression = bodyEditing
      ? applyAvatarEyeDefaults(expression, avatarEyes)
      : expression
    const leftEditor = renderEyeEditor(poseWithAvatarEyes(expression, avatarEyes), surface, -1)
    const rightEditor = renderEyeEditor(poseWithAvatarEyes(expression, avatarEyes), surface, 1)
    drag.current = {
      type,
      side: selectedSide,
      startPoint: point,
      expression: editableExpression,
      center: editor.center,
      widthAxis: unitVector(editor.center, editor.widthHandle),
      heightAxis: unitVector(editor.center, editor.heightHandle),
      spacingAxis: unitVector(leftEditor.center, rightEditor.center),
      startPointerAngle: Math.atan2(point[1] - editor.center[1], point[0] - editor.center[0]),
      startDistance: Math.max(
        Math.hypot(point[0] - editor.center[0], point[1] - editor.center[1]),
        1
      ),
    }
    setActiveDragType(type)
    svgRef.current!.setPointerCapture(event.pointerId)
  }
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const point = toSvg(event)
    if (drag.current.type === 'arcball') {
      onChange(rotateExpressionWithArcball(drag.current.expression, drag.current.startPoint, point))
      return
    }
    const interaction = drag.current
    const suffix = interaction.side < 0 ? 'Left' : 'Right'
    const otherSuffix = interaction.side < 0 ? 'Right' : 'Left'
    const deltaX = point[0] - interaction.startPoint[0]
    const deltaY = point[1] - interaction.startPoint[1]
    const along = (axis: readonly [number, number]) => deltaX * axis[0] + deltaY * axis[1]
    const next = { ...interaction.expression }
    if (interaction.type === 'width') {
      const value = bounded(
        interaction.expression[`width${suffix}`] + along(interaction.widthAxis) * 2,
        10,
        100
      )
      next[`width${suffix}`] = value
      if (linked.width) next[`width${otherSuffix}`] = value
    } else if (interaction.type === 'height') {
      const value = bounded(
        interaction.expression[`height${suffix}`] + along(interaction.heightAxis) * 2,
        10,
        100
      )
      next[`height${suffix}`] = value
      if (linked.height) next[`height${otherSuffix}`] = value
    } else if (interaction.type === 'size') {
      const distance = Math.hypot(
        point[0] - interaction.center[0],
        point[1] - interaction.center[1]
      )
      const factor = distance / interaction.startDistance
      next[`width${suffix}`] = bounded(interaction.expression[`width${suffix}`] * factor, 10, 110)
      next[`height${suffix}`] = bounded(interaction.expression[`height${suffix}`] * factor, 10, 110)
      if (linked.size) {
        next[`width${otherSuffix}`] = bounded(
          interaction.expression[`width${otherSuffix}`] * factor,
          10,
          110
        )
        next[`height${otherSuffix}`] = bounded(
          interaction.expression[`height${otherSuffix}`] * factor,
          10,
          110
        )
      }
    } else if (interaction.type === 'spacing') {
      const startSpacing = interaction.expression.spacing
      const spacing = bounded(startSpacing + along(interaction.spacingAxis), 0, 150)
      next.spacing = spacing
    } else {
      const currentAngle = Math.atan2(
        point[1] - interaction.center[1],
        point[0] - interaction.center[0]
      )
      const deltaAngle = Math.atan2(
        Math.sin(currentAngle - interaction.startPointerAngle),
        Math.cos(currentAngle - interaction.startPointerAngle)
      )
      next[interaction.side < 0 ? 'leftAngle' : 'rightAngle'] =
        interaction.expression[interaction.side < 0 ? 'leftAngle' : 'rightAngle'] +
        (deltaAngle * 180) / Math.PI
    }
    ;(onEyeChange ?? onChange)(next)
  }
  return (
    <div className="avatar-wrap">
      <svg
        ref={svgRef}
        className="avatar"
        viewBox="-150 -150 300 300"
        role="img"
        aria-label={t('Avatar procédural')}
        onPointerMove={move}
        onPointerUp={() => {
          drag.current = null
          setActiveDragType(null)
          onHighlightChange(null)
        }}
        onPointerCancel={() => {
          drag.current = null
          setActiveDragType(null)
          onHighlightChange(null)
        }}
      >
        <defs>
          <clipPath id="avatar-head-clip">
            <motion.path d={headPath} />
          </clipPath>
        </defs>
        {backPaths.map((pathValue, index) => (
          <motion.path
            className={`avatar-head ${highlight === 'head' ? 'cyan-outline' : ''}`}
            d={pathValue}
            key={index}
            onPointerDown={event => selectBodyPath(event, backNodeIds.current[index])}
          />
        ))}
        <motion.path
          className={`avatar-head ${highlight === 'head' ? 'cyan-outline' : ''}`}
          d={headPath}
          onPointerDown={event => {
            onBodyNodeSelect('primary')
            startDrag(event)
          }}
        />
        <g clipPath="url(#avatar-head-clip)">
          {(showWire || highlight === 'head') &&
            wirePaths.map((pathValue, index) => (
              <motion.path className="wire" d={pathValue} key={index} />
            ))}
          <motion.path
            className={`avatar-eye ${selectedSide === -1 || highlight === 'left' || highlight === 'both' ? 'cyan-outline' : ''}`}
            d={leftPath}
            opacity={leftOpacity}
            onPointerDown={event => selectEye(-1, event)}
          />
          <motion.path
            className={`avatar-eye ${selectedSide === 1 || highlight === 'right' || highlight === 'both' ? 'cyan-outline' : ''}`}
            d={rightPath}
            opacity={rightOpacity}
            onPointerDown={event => selectEye(1, event)}
          />
        </g>
        {frontPaths.map((pathValue, index) => (
          <motion.path
            className={`avatar-head ${highlight === 'head' ? 'cyan-outline' : ''}`}
            d={pathValue}
            key={index}
            onPointerDown={event => selectBodyPath(event, frontNodeIds.current[index])}
          />
        ))}
        {selectedBodyPath && (
          <motion.path className="selection-outline body-selection-outline" d={selectedBodyPath} />
        )}
        {bodyEditing && selectedBodyNode && (
          <BodyNodeGizmo
            svgRef={svgRef}
            pose={poseWithAvatarEyes(expression, avatarEyes)}
            node={selectedBodyNode}
            onPreview={onBodyNodePreview}
            onCommit={onBodyNodeChange}
          />
        )}
        {editor?.visible && (
          <g className="eye-editor">
            {activeDragType !== null && activeDragType !== 'arcball' && (
              <path className="selection-outline" d={editor.selectionPath} />
            )}
            <path className="editor-guide" d={editor.widthGuide} />
            <path className="editor-guide" d={editor.heightGuide} />
            <path className="editor-guide" d={editor.rotationGuide} />
            <path className="editor-guide" d={editor.spacingGuide} />
            <EditorCircle point={editor.widthHandle} label="L" type="width" onStart={startHandle} />
            <EditorCircle
              point={editor.heightHandle}
              label="H"
              type="height"
              onStart={startHandle}
            />
            <EditorCircle
              point={editor.rotateHandle}
              label="R"
              type="rotate"
              onStart={startHandle}
            />
            <EditorSquare point={editor.sizeHandle} label="S" type="size" onStart={startHandle} />
            <EditorSquare
              point={editor.spacingHandle}
              label="E"
              type="spacing"
              onStart={startHandle}
            />
          </g>
        )}
      </svg>
      <RotationGizmo
        expression={expression}
        onChange={onChange}
        onActiveChange={active => onHighlightChange(active ? 'head' : null)}
        onReset={() => onChange({ ...expression, headX: 0, headY: 0, headZ: 0 })}
      />
      <div className="axis-key">
        <i className="x" />X <i className="y" />Y <i className="z" />Z
      </div>
    </div>
  )
}

type EyeHandle = 'width' | 'height' | 'size' | 'spacing' | 'rotate'
type HandleStart = (type: EyeHandle, event: React.PointerEvent<SVGElement>) => void

function EditorCircle({
  point,
  label,
  type,
  onStart,
}: {
  point: Point3
  label: string
  type: EyeHandle
  onStart: HandleStart
}) {
  return (
    <g
      className="editor-control"
      data-eye-handle={type}
      onPointerDown={event => onStart(type, event)}
    >
      <circle className="editor-handle" cx={point[0]} cy={point[1]} r="5.5" />
      <text className="editor-label" x={point[0]} y={point[1] + 2.6}>
        {label}
      </text>
    </g>
  )
}

function EditorSquare({
  point,
  label,
  type,
  onStart,
}: {
  point: Point3
  label: string
  type: EyeHandle
  onStart: HandleStart
}) {
  return (
    <g
      className="editor-control"
      data-eye-handle={type}
      onPointerDown={event => onStart(type, event)}
    >
      <rect
        className="editor-handle"
        x={point[0] - 5}
        y={point[1] - 5}
        width="10"
        height="10"
        rx="2"
      />
      <text className="editor-label" x={point[0]} y={point[1] + 2.6}>
        {label}
      </text>
    </g>
  )
}

function SurfaceThumbnail({ surface }: { surface: SurfaceConfig }) {
  const geometry = getPreviewGeometry(defaultExpression, surface, emptyBodyNodes)
  return (
    <svg viewBox="-150 -150 300 300" aria-hidden="true">
      {geometry.backPaths.map((pathValue, index) => (
        <path d={pathValue} key={index} />
      ))}
      <path d={geometry.headPath} />
    </svg>
  )
}

function ExpressionPreview({
  expression,
  surface,
  bodyNodes,
  colors,
  avatarEyes,
  id,
}: {
  expression: Expression
  surface: SurfaceConfig
  bodyNodes: BodyNode[]
  colors: AvatarColors
  avatarEyes: AvatarEyeDefaults
  id: string
}) {
  const geometry = getPreviewGeometry(expression, surface, bodyNodes, avatarEyes)
  const resolvedColors = resolveColors(expression, colors)
  const clipId = `preview-${id}`
  return (
    <svg viewBox="-150 -150 300 300" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={geometry.headPath} />
        </clipPath>
      </defs>
      {geometry.backPaths.map((pathValue, index) => (
        <path
          className="preview-head"
          d={pathValue}
          key={index}
          style={{ fill: resolvedColors.body }}
        />
      ))}
      <path className="preview-head" d={geometry.headPath} style={{ fill: resolvedColors.body }} />
      <g clipPath={`url(#${clipId})`}>
        <path
          className="preview-eye"
          d={geometry.leftPath}
          opacity={geometry.leftVisible ? 1 : 0}
          style={{ fill: resolvedColors.eyes }}
        />
        <path
          className="preview-eye"
          d={geometry.rightPath}
          opacity={geometry.rightVisible ? 1 : 0}
          style={{ fill: resolvedColors.eyes }}
        />
      </g>
      {geometry.frontPaths.map((pathValue, index) => (
        <path
          className="preview-head"
          d={pathValue}
          key={`front-${index}`}
          style={{ fill: resolvedColors.body }}
        />
      ))}
    </svg>
  )
}

function ExpressionCard({
  expression,
  index,
  active,
  surface,
  bodyNodes,
  colors,
  avatarEyes,
  previewId,
  onSelect,
  onEdit,
}: {
  expression: Expression
  index: number
  active: boolean
  surface: SurfaceConfig
  bodyNodes: BodyNode[]
  colors: AvatarColors
  avatarEyes: AvatarEyeDefaults
  previewId: string
  onSelect: () => void
  onEdit?: () => void
}) {
  return (
    <Button
      className="expression-card"
      variant="outline"
      aria-pressed={active}
      type="button"
      onClick={onSelect}
      onDoubleClick={onEdit}
    >
      <ExpressionPreview
        expression={expression}
        surface={surface}
        bodyNodes={bodyNodes}
        colors={colors}
        avatarEyes={avatarEyes}
        id={previewId}
      />
      <span>{String(index).padStart(2, '0')}</span>
    </Button>
  )
}

function ExpressionWorkspace({
  editing,
  avatarColors,
  backButtonRef,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: {
  editing: { index: number | null; draft: Expression }
  avatarColors: AvatarColors
  backButtonRef: RefObject<HTMLButtonElement | null>
  onChange: (draft: Expression) => void
  onCancel: () => void
  onSave: () => void
  onDelete: () => void
}) {
  const { t } = useStudioLanguage()
  const [linked, setLinked] = useState({ width: true, height: true, size: true })
  const update = (changes: Partial<Expression>) => onChange({ ...editing.draft, ...changes })
  const updateDimension = (side: Side, dimension: 'width' | 'height', value: number) => {
    const key = `${dimension}${side}` as 'widthLeft' | 'widthRight' | 'heightLeft' | 'heightRight'
    const other = `${dimension}${side === 'Left' ? 'Right' : 'Left'}` as typeof key
    update({ [key]: value, ...(linked[dimension] ? { [other]: value } : {}) })
  }
  const updateSize = (side: Side, value: number) => {
    const widthKey = `width${side}` as 'widthLeft' | 'widthRight'
    const heightKey = `height${side}` as 'heightLeft' | 'heightRight'
    const factor = value / (Math.max(editing.draft[widthKey], editing.draft[heightKey]) || 1)
    const changes: Partial<Expression> = {
      [widthKey]: bounded(editing.draft[widthKey] * factor, 10, 110),
      [heightKey]: bounded(editing.draft[heightKey] * factor, 10, 110),
    }
    if (linked.size) {
      const otherSide = side === 'Left' ? 'Right' : 'Left'
      const otherWidth = `width${otherSide}` as 'widthLeft' | 'widthRight'
      const otherHeight = `height${otherSide}` as 'heightLeft' | 'heightRight'
      changes[otherWidth] = bounded(editing.draft[otherWidth] * factor, 10, 110)
      changes[otherHeight] = bounded(editing.draft[otherHeight] * factor, 10, 110)
    }
    update(changes)
  }

  return (
    <>
      <header className="workspace-header">
        <Button
          ref={backButtonRef}
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label={t('Retour aux expressions')}
        >
          <ArrowLeft />
        </Button>
        <div className="workspace-heading">
          <p className="eyebrow">{t('Preset en mémoire')}</p>
          <h1>
            {editing.index === null
              ? t('Nouvelle expression')
              : t(`Modifier l’expression ${String(editing.index).padStart(2, '0')}`)}
          </h1>
          <p>{t('L’avatar à gauche affiche cette expression en direct.')}</p>
        </div>
      </header>
      <div className="workspace-scroll">
        <div className="dialog-fields">
          <ControlSection
            title="Corps"
            subtitle="Apparence et orientation générale de l’avatar."
            compact
          >
            <Card className="dialog-group">
              <h3>{t('Couleur du corps')}</h3>
              <ColorField
                label="Corps"
                value={editing.draft.bodyColor ?? avatarColors.body}
                onChange={bodyColor => update({ bodyColor })}
              />
            </Card>
            <Card className="dialog-group">
              <h3>{t('Rotation de la tête')}</h3>
              {(['headX', 'headY', 'headZ'] as const).map(field => (
                <NumericField
                  key={field}
                  label={`Rotation ${field.at(-1)?.toUpperCase()}`}
                  value={editing.draft[field]}
                  unit="°"
                  onChange={value => update({ [field]: value })}
                />
              ))}
            </Card>
          </ControlSection>
          <ControlSection
            title="Yeux"
            subtitle="Forme, placement et orientation propres au regard."
            compact
          >
            <Card className="dialog-group">
              <h3>{t('Couleur des yeux')}</h3>
              <ColorField
                label="Yeux"
                value={editing.draft.eyeColor ?? avatarColors.eyes}
                onChange={eyeColor => update({ eyeColor })}
              />
            </Card>
            {(['width', 'height', 'size'] as const).map(dimension => (
              <Card className="dialog-group" key={dimension}>
                <div className="panel-inline-title">
                  <h3>
                    {t(
                      { width: 'Largeur', height: 'Hauteur', size: 'Taille proportionnelle' }[
                        dimension
                      ]
                    )}
                  </h3>
                  <LinkButton
                    linked={linked[dimension]}
                    label={`Lier ${dimension}`}
                    onClick={() =>
                      setLinked(current => ({ ...current, [dimension]: !current[dimension] }))
                    }
                  />
                </div>
                <div className="eye-columns">
                  {(['Left', 'Right'] as Side[]).map(side => {
                    const width = editing.draft[`width${side}`]
                    const height = editing.draft[`height${side}`]
                    const value =
                      dimension === 'width'
                        ? width
                        : dimension === 'height'
                          ? height
                          : Math.max(width, height)
                    return (
                      <NumericField
                        key={side}
                        label={side === 'Left' ? 'Œil gauche' : 'Œil droit'}
                        value={value}
                        min={10}
                        max={dimension === 'size' ? 110 : 100}
                        unit="u"
                        onChange={next =>
                          dimension === 'size'
                            ? updateSize(side, next)
                            : updateDimension(side, dimension, next)
                        }
                      />
                    )
                  })}
                </div>
              </Card>
            ))}
            <Card className="dialog-group">
              <h3>{t('Position et espacement')}</h3>
              <div className="eye-columns">
                {(['Left', 'Right'] as Side[]).map(side => (
                  <div className="eye-column" key={side}>
                    <h3>{t(side === 'Left' ? 'Œil gauche' : 'Œil droit')}</h3>
                    <NumericField
                      label="Horizontale"
                      value={editing.draft[`positionX${side}`]}
                      unit="u"
                      onChange={value => update({ [`positionX${side}`]: value })}
                    />
                    <NumericField
                      label="Verticale"
                      value={editing.draft[`positionY${side}`]}
                      unit="u"
                      onChange={value => update({ [`positionY${side}`]: value })}
                    />
                  </div>
                ))}
              </div>
              <div className="position-spacing">
                <NumericField
                  label="Espacement"
                  value={editing.draft.spacing}
                  min={0}
                  max={150}
                  unit="u"
                  onChange={value => update({ spacing: value })}
                />
              </div>
            </Card>
            <Card className="dialog-group">
              <h3>{t('Rotation locale')}</h3>
              <div className="eye-columns">
                <NumericField
                  label="Œil gauche"
                  value={editing.draft.leftAngle}
                  unit="°"
                  onChange={value => update({ leftAngle: value })}
                />
                <NumericField
                  label="Œil droit"
                  value={editing.draft.rightAngle}
                  unit="°"
                  onChange={value => update({ rightAngle: value })}
                />
              </div>
            </Card>
          </ControlSection>
          <ControlSection
            title="Projection"
            subtitle="Perspective appliquée à la surface active."
            compact
          >
            <Card className="dialog-group">
              <NumericField
                label="Perspective"
                value={editing.draft.perspective}
                step={0.01}
                unit="×"
                onChange={value => update({ perspective: value })}
              />
            </Card>
          </ControlSection>
        </div>
      </div>
      <footer className="workspace-footer">
        {editing.index !== null && (
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 />
            {t('Supprimer')}
          </Button>
        )}
        <div className="dialog-actions-main">
          <Button onClick={onSave}>{t('Enregistrer')}</Button>
        </div>
      </footer>
    </>
  )
}

function StudioApp() {
  const { language, setLanguage, t } = useStudioLanguage()
  const [mode, setMode] = useState<Mode>('manual')
  const [initialLibrary] = useState(loadAvatarLibrary)
  const [avatars, setAvatars] = useState(initialLibrary.avatars)
  const [activeAvatarId, setActiveAvatarId] = useState(initialLibrary.activeAvatarId)
  const initialAvatar =
    initialLibrary.avatars.find(avatar => avatar.id === initialLibrary.activeAvatarId) ??
    initialLibrary.avatars[0]
  const [surface, setSurface] = useState(initialAvatar.body.primary)
  const [bodyNodes, setBodyNodes] = useState(initialAvatar.body.nodes)
  const [selectedBodyNodeId, setSelectedBodyNodeId] = useState<'primary' | string | null>('primary')
  const [selectedEyeSide, setSelectedEyeSide] = useState<-1 | 1 | null>(null)
  const [expressions, setExpressions] = useState(loadGlobalExpressions)
  const [bodyEditing, setBodyEditing] = useState(false)
  const workspaceBackButtonRef = useRef<HTMLButtonElement>(null)
  const [focusAvatarName, setFocusAvatarName] = useState(false)
  const [expression, setExpression] = useState<Expression>({ ...defaultExpression })
  const [displayColors, setDisplayColors] = useState<AvatarColors>(() =>
    resolveColors(defaultExpression, initialAvatar.colors)
  )
  const [deleteAvatarOpen, setDeleteAvatarOpen] = useState(false)
  const [deleteExpressionOpen, setDeleteExpressionOpen] = useState(false)
  const [activeExpression, setActiveExpression] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ index: number | null; draft: Expression } | null>(null)
  const [showWire, setShowWire] = useState(false)
  const [springSpeed, setSpringSpeed] = useState(7)
  const [linked, setLinked] = useState({
    width: true,
    height: true,
    size: true,
    position: true,
  })
  const [highlight, setHighlight] = useState<Highlight>(null)
  const [selectedState, setSelectedState] = useState('idle')
  const [activeState, setActiveState] = useState<string | null>(null)
  const [statePlaying, setStatePlaying] = useState(false)
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statePosition = useRef(0)
  const stateNextDueAt = useRef<number | null>(null)
  const stateRemainingDelay = useRef(0)
  const reduceMotion = useReducedMotion()

  const avatarsRef = useRef(avatars)
  const activeAvatarIdRef = useRef(activeAvatarId)
  const surfaceRef = useRef(surface)
  const bodyNodesRef = useRef(bodyNodes)
  const showWireRef = useRef(showWire)
  const highlightRef = useRef(highlight)
  const [initialRender] = useState(() => {
    const pose = poseFromExpression(defaultExpression)
    return {
      pose,
      geometry: renderAvatar(
        poseWithAvatarEyes(defaultExpression, initialAvatar.eyes),
        surface,
        1,
        { bodyNodes }
      ),
    }
  })
  const { pose: initialPose, geometry: initialGeometry } = initialRender
  const displayedPose = useRef<AvatarPose>(initialPose)
  const transitionFrame = useRef<number | null>(null)
  const transitionTarget = useRef<Expression>({ ...defaultExpression })
  const canonicalTarget = useRef<Expression>({ ...defaultExpression })
  const retargetFrom = useRef<Expression | null>(null)
  const retargetTo = useRef<Expression | null>(null)
  const retargetStartedAt = useRef<number | null>(null)
  const [transitionVelocity] = useState(
    () =>
      Object.fromEntries(expressionFields.map(field => [field, 0])) as Record<
        (typeof expressionFields)[number],
        number
      >
  )
  const lastTransitionTime = useRef<number | null>(null)
  const lastInspectorFrame = useRef(0)
  const springSpeedRef = useRef(springSpeed)
  const blinkControls = useRef<ReturnType<typeof animate> | null>(null)
  const blinkValue = useMotionValue(1)
  const headPath = useMotionValue(initialGeometry.headPath)
  const backNodeIds = useRef(initialGeometry.backNodeIds)
  const frontNodeIds = useRef(initialGeometry.frontNodeIds)
  const [backPaths] = useState(() =>
    Array.from({ length: BODY_RENDER_PATH_SLOTS }, (_, index) =>
      motionValue(initialGeometry.backPaths[index] ?? '')
    )
  )
  const [frontPaths] = useState(() =>
    Array.from({ length: BODY_RENDER_PATH_SLOTS }, (_, index) =>
      motionValue(initialGeometry.frontPaths[index] ?? '')
    )
  )
  const leftPath = useMotionValue(initialGeometry.leftPath)
  const rightPath = useMotionValue(initialGeometry.rightPath)
  const leftOpacity = useMotionValue(initialGeometry.leftVisible ? 1 : 0)
  const rightOpacity = useMotionValue(initialGeometry.rightVisible ? 1 : 0)
  const [wirePaths] = useState(() =>
    initialGeometry.wirePaths.map(pathValue => motionValue(pathValue))
  )

  const paintPose = (pose: AvatarPose, blink?: number) => {
    displayedPose.current = pose
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    const renderPose = avatar
      ? poseWithAvatarEyes(pose.expression, avatar.eyes ?? defaultAvatarEyes)
      : pose
    const geometry = renderAvatar(renderPose, surfaceRef.current, blink ?? blinkValue.get(), {
      includeWire: showWireRef.current || highlightRef.current === 'head',
      bodyNodes: bodyNodesRef.current,
    })
    headPath.set(geometry.headPath)
    backNodeIds.current = geometry.backNodeIds
    frontNodeIds.current = geometry.frontNodeIds
    backPaths.forEach((pathValue, index) => pathValue.set(geometry.backPaths[index] ?? ''))
    frontPaths.forEach((pathValue, index) => pathValue.set(geometry.frontPaths[index] ?? ''))
    leftPath.set(geometry.leftPath)
    rightPath.set(geometry.rightPath)
    leftOpacity.set(geometry.leftVisible ? 1 : 0)
    rightOpacity.set(geometry.rightVisible ? 1 : 0)
    geometry.wirePaths.forEach((pathValue, index) => wirePaths[index].set(pathValue))
  }

  useMotionValueEvent(blinkValue, 'change', latest => paintPose(displayedPose.current, latest))

  useEffect(
    () => () => {
      if (transitionFrame.current !== null) cancelAnimationFrame(transitionFrame.current)
      blinkControls.current?.stop()
      if (stateTimer.current) clearTimeout(stateTimer.current)
      if (blinkTimer.current) clearTimeout(blinkTimer.current)
    },
    []
  )

  const stopTransition = (resetVelocity: boolean) => {
    if (transitionFrame.current !== null) cancelAnimationFrame(transitionFrame.current)
    transitionFrame.current = null
    lastTransitionTime.current = null
    retargetFrom.current = null
    retargetTo.current = null
    retargetStartedAt.current = null
    lastInspectorFrame.current = 0
    if (resetVelocity) {
      expressionFields.forEach(field => {
        transitionVelocity[field] = 0
      })
    }
  }

  const updateImmediate = (next: Expression) => {
    stopTransition(true)
    const pose = poseFromExpression(next)
    transitionTarget.current = next
    canonicalTarget.current = next
    setExpression(next)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(next, avatar.colors))
    setActiveExpression(null)
    paintPose(pose)
  }

  const transitionToExpression = (next: Expression, index: number | null = null) => {
    setActiveExpression(index)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(next, avatar.colors))
    if (reduceMotion) {
      updateImmediate(next)
      return
    }
    const current = displayedPose.current.expression
    const nearestAngle = (target: number, from: number) => {
      let resolved = target
      while (resolved - from > 180) resolved -= 360
      while (resolved - from < -180) resolved += 360
      return resolved
    }
    canonicalTarget.current = next
    const resolvedTarget = {
      ...next,
      headX: nearestAngle(next.headX, current.headX),
      headY: nearestAngle(next.headY, current.headY),
      headZ: nearestAngle(next.headZ, current.headZ),
      leftAngle: nearestAngle(next.leftAngle, current.leftAngle),
      rightAngle: nearestAngle(next.rightAngle, current.rightAngle),
    }

    if (transitionFrame.current !== null) {
      retargetFrom.current = { ...transitionTarget.current }
      retargetTo.current = resolvedTarget
      retargetStartedAt.current = -1
      return
    }
    transitionTarget.current = resolvedTarget
    const tick = (time: number) => {
      const previousTime = lastTransitionTime.current ?? time
      const deltaTime = Math.min(Math.max((time - previousTime) / 1000, 1 / 240), 1 / 30)
      lastTransitionTime.current = time
      const stiffness = 70 + springSpeedRef.current * 24
      const damping = 17 + springSpeedRef.current * 1.7
      const mass = 0.85
      const currentExpression = displayedPose.current.expression
      if (retargetStartedAt.current !== null && retargetFrom.current && retargetTo.current) {
        if (retargetStartedAt.current < 0) retargetStartedAt.current = time
        const linearProgress = Math.min((time - retargetStartedAt.current) / RETARGET_BLEND_MS, 1)
        const smoothProgress =
          linearProgress ** 3 * (linearProgress * (linearProgress * 6 - 15) + 10)
        const blendedTarget = { ...retargetTo.current }
        expressionFields.forEach(field => {
          blendedTarget[field] =
            retargetFrom.current![field] +
            (retargetTo.current![field] - retargetFrom.current![field]) * smoothProgress
        })
        transitionTarget.current = blendedTarget
        if (linearProgress === 1) {
          transitionTarget.current = retargetTo.current
          retargetFrom.current = null
          retargetTo.current = null
          retargetStartedAt.current = null
        }
      }
      const target = transitionTarget.current
      let settled = true
      const animated = { ...currentExpression }

      expressionFields.forEach(field => {
        const displacement = target[field] - currentExpression[field]
        const acceleration = (stiffness * displacement - damping * transitionVelocity[field]) / mass
        const velocity = transitionVelocity[field] + acceleration * deltaTime
        const value = currentExpression[field] + velocity * deltaTime
        transitionVelocity[field] = velocity
        animated[field] = value
        const tolerance = field === 'perspective' ? 0.0001 : 0.005
        if (Math.abs(displacement) > tolerance || Math.abs(velocity) > tolerance) settled = false
      })

      if (settled) {
        const finalExpression = canonicalTarget.current
        stopTransition(true)
        setExpression(finalExpression)
        paintPose(poseFromExpression(finalExpression))
        return
      }

      paintPose(poseFromExpression(animated))
      if (time - lastInspectorFrame.current >= INSPECTOR_FRAME_MS) {
        lastInspectorFrame.current = time
        setExpression(animated)
      }
      transitionFrame.current = requestAnimationFrame(tick)
    }
    transitionFrame.current = requestAnimationFrame(tick)
  }

  const blink = () => {
    blinkControls.current?.stop()
    blinkValue.jump(1)
    const blinkDuration = getStatePlaybackConfig(activeState ?? selectedState).blink.durationMs
    blinkControls.current = animate(blinkValue, [1, 0, 1], {
      duration: reduceMotion ? 0 : blinkDuration / 1000,
      times: [0, 0.42, 1],
      ease: ['easeIn', 'easeOut'],
    })
  }

  const updateDimension = (side: Side, dimension: 'width' | 'height', value: number) => {
    const key = `${dimension}${side}` as 'widthLeft' | 'widthRight' | 'heightLeft' | 'heightRight'
    const other = `${dimension}${side === 'Left' ? 'Right' : 'Left'}` as typeof key
    updateImmediate({
      ...expression,
      [key]: value,
      ...(linked[dimension] ? { [other]: value } : {}),
    })
  }

  const updateSize = (side: Side, value: number) => {
    const widthKey = `width${side}` as 'widthLeft' | 'widthRight'
    const heightKey = `height${side}` as 'heightLeft' | 'heightRight'
    const size = Math.max(expression[widthKey], expression[heightKey]) || 1
    const factor = value / size
    const next = {
      ...expression,
      [widthKey]: bounded(expression[widthKey] * factor, 10, 110),
      [heightKey]: bounded(expression[heightKey] * factor, 10, 110),
    }
    if (linked.size) {
      const otherSide = side === 'Left' ? 'Right' : 'Left'
      const otherWidth = `width${otherSide}` as 'widthLeft' | 'widthRight'
      const otherHeight = `height${otherSide}` as 'heightLeft' | 'heightRight'
      next[otherWidth] = bounded(expression[otherWidth] * factor, 10, 110)
      next[otherHeight] = bounded(expression[otherHeight] * factor, 10, 110)
    }
    updateImmediate(next)
  }

  const updateSpacing = (value: number) => {
    updateImmediate({ ...expression, spacing: value })
  }

  const updateActiveAvatar = (update: (avatar: StudioAvatar) => StudioAvatar) => {
    const next = avatarsRef.current.map(avatar =>
      avatar.id === activeAvatarIdRef.current ? update(avatar) : avatar
    )
    avatarsRef.current = next
    setAvatars(next)
    persistAvatarLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: next })
  }

  const selectBodyNode = (id: 'primary' | string | null) => {
    setSelectedBodyNodeId(id)
    if (id) setSelectedEyeSide(null)
  }

  const updateSurface = (next: SurfaceConfig) => {
    surfaceRef.current = next
    setSurface(next)
    updateActiveAvatar(avatar => ({
      ...avatar,
      body: { primary: next, nodes: bodyNodesRef.current },
    }))
    paintPose(displayedPose.current)
  }

  const updateBodyNodes = (next: BodyNode[]) => {
    bodyNodesRef.current = next
    setBodyNodes(next)
    updateActiveAvatar(avatar => ({
      ...avatar,
      body: { primary: surfaceRef.current, nodes: next },
    }))
    paintPose(displayedPose.current)
  }

  const updateAvatarColors = (changes: Partial<AvatarColors>) => {
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (!avatar) return
    const colors = { ...avatar.colors, ...changes }
    updateActiveAvatar(current => ({ ...current, colors }))
    setDisplayColors(resolveColors(expression, colors))
  }

  const updateAvatarEyes = (changes: Partial<AvatarEyeDefaults>) => {
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (!avatar) return
    const eyes = { ...(avatar.eyes ?? defaultAvatarEyes), ...changes }
    updateActiveAvatar(current => ({ ...current, eyes }))
    paintPose(displayedPose.current)
  }

  const activateAvatar = (id: string, editBody = false, preserveMode = false) => {
    const avatar = avatarsRef.current.find(item => item.id === id)
    if (!avatar) return
    const currentStateExpression = displayedPose.current.expression
    stopTransition(true)
    activeAvatarIdRef.current = id
    surfaceRef.current = avatar.body.primary
    bodyNodesRef.current = avatar.body.nodes
    setActiveAvatarId(id)
    setSurface(avatar.body.primary)
    setBodyNodes(avatar.body.nodes)
    selectBodyNode('primary')
    setActiveExpression(null)
    setEditing(null)
    setBodyEditing(editBody)
    if (!preserveMode || editBody) setMode('manual')
    const nextExpression = activeState ? currentStateExpression : { ...defaultExpression }
    setExpression(nextExpression)
    setDisplayColors(resolveColors(nextExpression, avatar.colors))
    canonicalTarget.current = nextExpression
    transitionTarget.current = nextExpression
    paintPose(poseFromExpression(nextExpression))
    persistAvatarLibrary({ activeAvatarId: id, avatars: avatarsRef.current })
  }

  const createNewAvatar = () => {
    const avatar = createAvatar('Unknown')
    const next = [...avatarsRef.current, avatar]
    avatarsRef.current = next
    setAvatars(next)
    setFocusAvatarName(true)
    persistAvatarLibrary({ activeAvatarId: avatar.id, avatars: next })
    activateAvatar(avatar.id, true)
  }

  const renameActiveAvatar = (name: string) => {
    updateActiveAvatar(avatar => ({ ...avatar, name }))
  }

  const deleteActiveAvatar = () => {
    if (avatarsRef.current.length <= 1) return
    const remaining = avatarsRef.current.filter(avatar => avatar.id !== activeAvatarIdRef.current)
    avatarsRef.current = remaining
    setAvatars(remaining)
    persistAvatarLibrary({ activeAvatarId: remaining[0].id, avatars: remaining })
    setDeleteAvatarOpen(false)
    activateAvatar(remaining[0].id)
  }

  const addBodyNode = (type: (typeof bodyPrimitiveTypes)[number]) => {
    if (bodyNodesRef.current.length >= MAX_BODY_NODES) return
    const node = createBodyNode(type, bodyNodesRef.current.length)
    updateBodyNodes([...bodyNodesRef.current, node])
    selectBodyNode(node.id)
  }

  const updateSelectedBodyNode = (update: (node: BodyNode) => BodyNode) => {
    if (selectedBodyNodeId === 'primary') return
    updateBodyNodes(
      bodyNodesRef.current.map(node => (node.id === selectedBodyNodeId ? update(node) : node))
    )
  }

  const commitBodyNode = (nextNode: BodyNode) => {
    updateBodyNodes(bodyNodesRef.current.map(node => (node.id === nextNode.id ? nextNode : node)))
  }

  const previewSelectedBodyNode = (nextNode: BodyNode) => {
    const next = bodyNodesRef.current.map(node => (node.id === nextNode.id ? nextNode : node))
    bodyNodesRef.current = next
    setBodyNodes(next)
    paintPose(displayedPose.current)
  }

  const deleteSelectedBodyNode = () => {
    if (selectedBodyNodeId === 'primary') return
    updateBodyNodes(bodyNodesRef.current.filter(node => node.id !== selectedBodyNodeId))
    selectBodyNode('primary')
  }

  const duplicateSelectedBodyNode = () => {
    if (selectedBodyNodeId === 'primary' || bodyNodesRef.current.length >= MAX_BODY_NODES) return
    const source = bodyNodesRef.current.find(node => node.id === selectedBodyNodeId)
    if (!source) return
    const duplicate = duplicateBodyNode(source)
    updateBodyNodes([...bodyNodesRef.current, duplicate])
    selectBodyNode(duplicate.id)
  }

  const updateHighlight = (next: Highlight) => {
    highlightRef.current = next
    setHighlight(next)
    if (next === 'head') paintPose(displayedPose.current)
  }

  const updateWireVisibility = (next: boolean) => {
    showWireRef.current = next
    setShowWire(next)
    if (next) paintPose(displayedPose.current)
  }

  const clearStateTimers = () => {
    if (stateTimer.current) clearTimeout(stateTimer.current)
    if (blinkTimer.current) clearTimeout(blinkTimer.current)
    stateTimer.current = null
    blinkTimer.current = null
    stateNextDueAt.current = null
  }

  const pauseState = () => {
    if (stateNextDueAt.current !== null) {
      stateRemainingDelay.current = Math.max(stateNextDueAt.current - performance.now(), 0)
    }
    clearStateTimers()
    setStatePlaying(false)
  }

  const stopState = () => {
    clearStateTimers()
    statePosition.current = 0
    stateRemainingDelay.current = 0
    stopTransition(true)
    blinkControls.current?.stop()
    setStatePlaying(false)
    setActiveState(null)
  }

  const launchState = (name: string, resume = false) => {
    clearStateTimers()
    const pool = statePools[name]
    if (!pool?.length) {
      stopState()
      return
    }
    if (!resume || activeState !== name) statePosition.current = 0
    setSelectedState(name)
    setActiveState(name)
    setStatePlaying(true)
    const playback = getStatePlaybackConfig(name)
    const cycleDelay = playback.expressionIntervalMs
    const scheduleCycle = (delay: number) => {
      stateRemainingDelay.current = delay
      stateNextDueAt.current = performance.now() + delay
      stateTimer.current = setTimeout(cycle, delay)
    }
    const cycle = () => {
      stateNextDueAt.current = null
      const index = pool[statePosition.current % pool.length]
      transitionToExpression(expressions[index], index)
      statePosition.current += 1
      scheduleCycle(cycleDelay)
    }
    const blinkLoop = () => {
      blink()
      const { minIntervalMs, maxIntervalMs } = playback.blink
      blinkTimer.current = setTimeout(
        blinkLoop,
        minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs)
      )
    }
    if (resume) scheduleCycle(stateRemainingDelay.current || cycleDelay)
    else cycle()
    blinkTimer.current = setTimeout(blinkLoop, playback.blink.initialDelayMs)
  }

  const toggleStatePlayback = () => {
    if (!activeState) return
    if (statePlaying) pauseState()
    else launchState(activeState, true)
  }

  const saveEditing = () => {
    if (!editing) return
    const index = editing.index ?? expressions.length
    const next =
      editing.index === null
        ? [...expressions, { ...editing.draft }]
        : expressions.map((item, itemIndex) =>
            itemIndex === editing.index ? { ...editing.draft } : item
          )
    setExpressions(next)
    persistGlobalExpressions(next)
    setEditing(null)
    transitionToExpression(editing.draft, index)
  }

  const previewExpressionDraft = (draft: Expression) => {
    setEditing(current => (current ? { ...current, draft } : current))
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(draft, avatar.colors))
    paintPose(poseFromExpression(draft))
  }

  const openExpressionEditor = (index: number | null, draft: Expression) => {
    stopState()
    setBodyEditing(false)
    setMode('expressions')
    setEditing({ index, draft: { ...draft } })
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(draft, avatar.colors))
    paintPose(poseFromExpression(draft))
  }

  const cancelExpressionEditing = () => {
    setEditing(null)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(expression, avatar.colors))
    paintPose(poseFromExpression(expression))
  }

  const deleteEditing = () => {
    if (editing?.index === null || editing?.index === undefined) return
    const next = expressions.filter((_, index) => index !== editing.index)
    const fallback = next[Math.min(editing.index, next.length - 1)] ?? defaultExpression
    setExpressions(next)
    persistGlobalExpressions(next)
    setActiveExpression(null)
    setEditing(null)
    setDeleteExpressionOpen(false)
    setExpression(fallback)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(fallback, avatar.colors))
    paintPose(poseFromExpression(fallback))
  }

  const selectedBodyNode =
    selectedBodyNodeId === 'primary'
      ? null
      : (bodyNodes.find(node => node.id === selectedBodyNodeId) ?? null)

  const updateNodeVector = (property: 'position' | 'rotation', index: 0 | 1 | 2, value: number) => {
    updateSelectedBodyNode(node => {
      const vector = [...node[property]] as [number, number, number]
      vector[index] = value
      return { ...node, [property]: vector }
    })
  }
  const activeAvatar = avatars.find(avatar => avatar.id === activeAvatarId) ?? avatars[0]
  const activeAvatarEyes = activeAvatar.eyes ?? defaultAvatarEyes
  const canvasExpression = editing?.draft ?? expression
  const canvasColors = editing ? resolveColors(editing.draft, activeAvatar.colors) : displayColors
  const editorPageOpen = bodyEditing || editing !== null

  useEffect(() => {
    if (!editorPageOpen || focusAvatarName) return
    const frame = requestAnimationFrame(() => workspaceBackButtonRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [editorPageOpen, focusAvatarName])

  const selectedStatePlayback = getStatePlaybackConfig(selectedState)
  const updateAvatarEyeDimension = (side: Side, dimension: 'width' | 'height', value: number) => {
    const field = `${dimension}${side}` as keyof AvatarEyeDefaults
    const other = `${dimension}${side === 'Left' ? 'Right' : 'Left'}` as keyof AvatarEyeDefaults
    updateAvatarEyes({ [field]: value, ...(linked[dimension] ? { [other]: value } : {}) })
  }
  const updateAvatarEyeSize = (side: Side, value: number) => {
    const widthField = `width${side}` as 'widthLeft' | 'widthRight'
    const heightField = `height${side}` as 'heightLeft' | 'heightRight'
    const factor = value / Math.max(activeAvatarEyes[widthField], activeAvatarEyes[heightField], 1)
    const changes: Partial<AvatarEyeDefaults> = {
      [widthField]: bounded(activeAvatarEyes[widthField] * factor, 10, 110),
      [heightField]: bounded(activeAvatarEyes[heightField] * factor, 10, 110),
    }
    if (linked.size) {
      const otherSide = side === 'Left' ? 'Right' : 'Left'
      const otherWidth = `width${otherSide}` as 'widthLeft' | 'widthRight'
      const otherHeight = `height${otherSide}` as 'heightLeft' | 'heightRight'
      changes[otherWidth] = bounded(activeAvatarEyes[otherWidth] * factor, 10, 110)
      changes[otherHeight] = bounded(activeAvatarEyes[otherHeight] * factor, 10, 110)
    }
    updateAvatarEyes(changes)
  }
  const updateAvatarEyePosition = (side: Side, axis: 'X' | 'Y', value: number) => {
    const field = `position${axis}${side}` as keyof AvatarEyeDefaults
    const other = `position${axis}${side === 'Left' ? 'Right' : 'Left'}` as keyof AvatarEyeDefaults
    updateAvatarEyes({ [field]: value, ...(linked.position ? { [other]: value } : {}) })
  }
  const persistEditedEyeExpression = (next: Expression) => {
    updateAvatarEyes({
      widthLeft: next.widthLeft,
      widthRight: next.widthRight,
      heightLeft: next.heightLeft,
      heightRight: next.heightRight,
      spacing: next.spacing,
      positionXLeft: next.positionXLeft,
      positionXRight: next.positionXRight,
      positionYLeft: next.positionYLeft,
      positionYRight: next.positionYRight,
      leftAngle: next.leftAngle,
      rightAngle: next.rightAngle,
    })
  }

  return (
    <div className="studio" lang={language}>
      <section
        className="stage-column"
        style={
          {
            '--avatar-body-color': canvasColors.body,
            '--avatar-eye-color': canvasColors.eyes,
          } as CSSProperties
        }
      >
        <div className="brand">
          <span className="brand-mark" />
          Bible Strong <em>Avatar Lab</em>
        </div>
        <label className="language-picker">
          <span aria-hidden="true">{language === 'en' ? '🇬🇧' : '🇫🇷'}</span>
          <select
            aria-label={t('Langue de l’interface')}
            value={language}
            onChange={event => setLanguage(event.currentTarget.value as StudioLanguage)}
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </label>
        <AvatarCanvas
          expression={canvasExpression}
          avatarEyes={activeAvatarEyes}
          surface={surface}
          wirePaths={wirePaths}
          showWire={showWire}
          backPaths={backPaths}
          frontPaths={frontPaths}
          backNodeIds={backNodeIds}
          frontNodeIds={frontNodeIds}
          bodyEditing={bodyEditing}
          selectedBodyNodeId={selectedBodyNodeId}
          selectedBodyNode={selectedBodyNode}
          selectedSide={selectedEyeSide}
          headPath={headPath}
          leftPath={leftPath}
          rightPath={rightPath}
          leftOpacity={leftOpacity}
          rightOpacity={rightOpacity}
          linked={linked}
          highlight={highlight}
          onHighlightChange={updateHighlight}
          onBodyNodeSelect={selectBodyNode}
          onBodyNodePreview={previewSelectedBodyNode}
          onBodyNodeChange={commitBodyNode}
          onEyeSelect={setSelectedEyeSide}
          onChange={editing ? previewExpressionDraft : updateImmediate}
          onEyeChange={
            editing ? previewExpressionDraft : bodyEditing ? persistEditedEyeExpression : undefined
          }
        />
        <p className="stage-help">
          {t(
            'Glisse sur la surface pour orienter la tête. Les anneaux du gizmo contrôlent X, Y et Z.'
          )}
        </p>
      </section>

      <main
        className={`inspector ${editing ? 'expression-workspace-active' : bodyEditing ? 'body-workspace' : 'studio-workspace'}`}
      >
        {editing && (
          <motion.div
            key={`expression-${editing.index ?? 'new'}`}
            className="workspace-page expression-workspace"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <ExpressionWorkspace
              editing={editing}
              avatarColors={activeAvatar.colors}
              backButtonRef={workspaceBackButtonRef}
              onChange={previewExpressionDraft}
              onCancel={cancelExpressionEditing}
              onSave={saveEditing}
              onDelete={() => setDeleteExpressionOpen(true)}
            />
          </motion.div>
        )}
        {!editing &&
          (bodyEditing ? (
            <header className="workspace-header body-workspace-header">
              <Button
                ref={workspaceBackButtonRef}
                variant="ghost"
                size="icon"
                onClick={() => setBodyEditing(false)}
                aria-label={t('Retour au studio')}
              >
                <ArrowLeft />
              </Button>
              <div className="workspace-heading">
                <p className="eyebrow">{t('Construction du corps')}</p>
                <Input
                  className="avatar-name-input"
                  aria-label={t('Nom de l’avatar')}
                  autoFocus={focusAvatarName}
                  value={activeAvatar.name}
                  onChange={event => renameActiveAvatar(event.currentTarget.value)}
                  onFocus={event => {
                    if (focusAvatarName) event.currentTarget.select()
                  }}
                  onBlur={event => {
                    if (!event.currentTarget.value.trim()) renameActiveAvatar('Unknown')
                    setFocusAvatarName(false)
                  }}
                />
                <p>
                  {t('Choisis la forme principale puis assemble les primitives autour d’elle.')}
                </p>
              </div>
              <div className="workspace-header-actions">
                <StatePlayer
                  name={activeState}
                  playing={statePlaying}
                  onToggle={toggleStatePlayback}
                  onStop={stopState}
                />
              </div>
            </header>
          ) : (
            <>
              <header className="inspector-header">
                <h1>Avatar Studio</h1>
                <StatePlayer
                  name={activeState}
                  playing={statePlaying}
                  onToggle={toggleStatePlayback}
                  onStop={stopState}
                />
              </header>
              <section className="avatar-shelf" aria-label={t('Choisir un avatar')}>
                <div className="avatar-shelf-heading">
                  <strong>Avatars</strong>
                  <span>{t('Double-clic pour modifier')}</span>
                </div>
                <div className="avatar-grid">
                  {avatars.map(avatar => (
                    <Button
                      className="avatar-card"
                      variant="outline"
                      aria-pressed={activeAvatarId === avatar.id}
                      type="button"
                      key={avatar.id}
                      onClick={() => activateAvatar(avatar.id, false, true)}
                      onDoubleClick={() => {
                        setFocusAvatarName(false)
                        activateAvatar(avatar.id, true)
                      }}
                    >
                      <ExpressionPreview
                        expression={expressions[0] ?? defaultExpression}
                        surface={avatar.body.primary}
                        bodyNodes={avatar.body.nodes}
                        colors={avatar.colors}
                        avatarEyes={avatar.eyes ?? defaultAvatarEyes}
                        id={`avatar-${avatar.id}`}
                      />
                      <span>{avatar.name}</span>
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    className="avatar-add"
                    onClick={createNewAvatar}
                    aria-label={t('Nouvel avatar')}
                  >
                    <Plus />
                  </Button>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          className="avatar-edit"
                          variant="secondary"
                          size="icon"
                          aria-label={`${t('Modifier')} ${activeAvatar.name}`}
                          onClick={() => {
                            setFocusAvatarName(false)
                            activateAvatar(activeAvatar.id, true)
                          }}
                        />
                      }
                    >
                      <Pencil />
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('Modifier')} {activeAvatar.name}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </section>
              <Tabs value={mode} onValueChange={value => setMode(value as Mode)}>
                <TabsList className="tabs" aria-label={t('Mode d’édition')}>
                  <TabsTrigger value="manual">{t('Pose')}</TabsTrigger>
                  <TabsTrigger value="expressions">{t('Expressions')}</TabsTrigger>
                  <TabsTrigger value="states">{t('États')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </>
          ))}

        {!editing && mode === 'manual' && (
          <div className="panel-stack">
            {bodyEditing && (
              <>
                <ControlSection
                  title="Corps"
                  subtitle="Construction, forme et couleur de la tête de l’avatar."
                >
                  <InspectorCard className="body-panel">
                    <PanelTitle
                      level={3}
                      title="Construction du corps"
                      subtitle="Une forme principale porte les yeux. Les autres primitives se placent autour d’elle."
                    />
                    <div className="body-tree">
                      <Button
                        variant="outline"
                        type="button"
                        aria-pressed={selectedBodyNodeId === 'primary'}
                        onClick={() => selectBodyNode('primary')}
                      >
                        <span className="body-node-icon">●</span>
                        <span>
                          <strong>{t('Forme principale')}</strong>
                          <small>
                            {t(surfaceLabels[surface.type])} · {t('porte les yeux')}
                          </small>
                        </span>
                      </Button>
                      {bodyNodes.map(node => (
                        <Button
                          variant="outline"
                          type="button"
                          key={node.id}
                          aria-pressed={selectedBodyNodeId === node.id}
                          onClick={() => selectBodyNode(node.id)}
                        >
                          <span className="body-node-icon">◇</span>
                          <span>
                            <strong>{t(node.name)}</strong>
                            <small>{t(surfaceLabels[node.surface.type])}</small>
                          </span>
                        </Button>
                      ))}
                    </div>
                    <div className="body-add">
                      <span>
                        {t('Ajouter une forme')} · {bodyNodes.length}/{MAX_BODY_NODES}
                      </span>
                      <div>
                        {bodyPrimitiveTypes.map(type => (
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            key={type}
                            disabled={bodyNodes.length >= MAX_BODY_NODES}
                            onClick={() => addBodyNode(type)}
                          >
                            + {t(surfaceLabels[type])}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {selectedBodyNode && (
                      <div className="body-node-editor">
                        <div className="body-node-actions">
                          <strong>{selectedBodyNode.name}</strong>
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              type="button"
                              disabled={bodyNodes.length >= MAX_BODY_NODES}
                              onClick={duplicateSelectedBodyNode}
                            >
                              {t('Dupliquer')}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              type="button"
                              onClick={deleteSelectedBodyNode}
                            >
                              {t('Supprimer')}
                            </Button>
                          </div>
                        </div>
                        <p className="body-gizmo-help">
                          <Badge variant="outline">{t('Gizmo local')}</Badge>
                          {t(
                            'Glisse un axe pour déplacer la forme, ou un anneau pour la faire tourner.'
                          )}
                        </p>
                        <div className="surface-fields">
                          {(['width', 'height', 'depth'] as const).map(dimension => (
                            <NumericField
                              key={dimension}
                              label={
                                { width: 'Largeur', height: 'Hauteur', depth: 'Profondeur' }[
                                  dimension
                                ]
                              }
                              value={selectedBodyNode.surface[dimension]}
                              min={10}
                              max={300}
                              unit="u"
                              onChange={value =>
                                updateSelectedBodyNode(node => ({
                                  ...node,
                                  surface: { ...node.surface, [dimension]: value },
                                }))
                              }
                            />
                          ))}
                          {(selectedBodyNode.surface.type === 'cube' ||
                            selectedBodyNode.surface.type === 'diamond' ||
                            selectedBodyNode.surface.type === 'cylinder') && (
                            <NumericField
                              label="Rondeur"
                              value={selectedBodyNode.surface.roundness}
                              min={0}
                              max={2}
                              step={0.01}
                              onChange={roundness =>
                                updateSelectedBodyNode(node => ({
                                  ...node,
                                  surface: { ...node.surface, roundness },
                                }))
                              }
                            />
                          )}
                          {(selectedBodyNode.surface.type === 'cylinder' ||
                            selectedBodyNode.surface.type === 'cone') && (
                            <NumericField
                              label="Rondeur globale"
                              value={selectedBodyNode.surface.morphRoundness ?? 0}
                              min={0}
                              max={2}
                              step={0.01}
                              onChange={morphRoundness =>
                                updateSelectedBodyNode(node => ({
                                  ...node,
                                  surface: { ...node.surface, morphRoundness },
                                }))
                              }
                            />
                          )}
                          {selectedBodyNode.surface.type === 'cone' && (
                            <>
                              <NumericField
                                label="Rondeur pointe"
                                value={selectedBodyNode.surface.tipRoundness ?? 0}
                                min={0}
                                max={2}
                                step={0.01}
                                onChange={tipRoundness =>
                                  updateSelectedBodyNode(node => ({
                                    ...node,
                                    surface: { ...node.surface, tipRoundness },
                                  }))
                                }
                              />
                              <NumericField
                                label="Rondeur base"
                                value={selectedBodyNode.surface.baseRoundness ?? 0}
                                min={0}
                                max={2}
                                step={0.01}
                                onChange={baseRoundness =>
                                  updateSelectedBodyNode(node => ({
                                    ...node,
                                    surface: { ...node.surface, baseRoundness },
                                  }))
                                }
                              />
                            </>
                          )}
                        </div>
                        <div className="body-transform-grid">
                          <div>
                            <h3>{t('Position locale')}</h3>
                            {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                              <NumericField
                                key={axis}
                                label={axis}
                                value={selectedBodyNode.position[index]}
                                unit="u"
                                onChange={value =>
                                  updateNodeVector('position', index as 0 | 1 | 2, value)
                                }
                              />
                            ))}
                          </div>
                          <div>
                            <h3>{t('Rotation locale')}</h3>
                            {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                              <NumericField
                                key={axis}
                                label={axis}
                                value={selectedBodyNode.rotation[index]}
                                unit="°"
                                onChange={value =>
                                  updateNodeVector('rotation', index as 0 | 1 | 2, value)
                                }
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </InspectorCard>
                  <InspectorCard className="surface-panel">
                    <PanelTitle
                      level={3}
                      title="Forme principale"
                      subtitle="Cette surface est la référence du visage et porte les yeux."
                    />
                    <div className="surface-grid">
                      {bodyPrimitiveTypes.map(type => {
                        const previewSurface =
                          type === surface.type ? surface : surfacePresets[type]
                        return (
                          <Button
                            className="surface-card"
                            variant="outline"
                            type="button"
                            key={type}
                            aria-pressed={surface.type === type}
                            onClick={() => {
                              selectBodyNode('primary')
                              if (type !== surface.type) {
                                updateSurface({ ...surfacePresets[type] })
                              }
                            }}
                          >
                            <SurfaceThumbnail surface={previewSurface} />
                            <span>{t(surfaceLabels[type])}</span>
                          </Button>
                        )
                      })}
                    </div>
                    <div className="surface-fields">
                      <NumericField
                        label="Largeur"
                        value={surface.width}
                        min={120}
                        max={300}
                        unit="u"
                        onChange={width => updateSurface({ ...surface, width })}
                      />
                      <NumericField
                        label="Hauteur"
                        value={surface.height}
                        min={120}
                        max={300}
                        unit="u"
                        onChange={height => updateSurface({ ...surface, height })}
                      />
                      <NumericField
                        label="Profondeur"
                        value={surface.depth}
                        min={100}
                        max={300}
                        unit="u"
                        onChange={depth => updateSurface({ ...surface, depth })}
                      />
                      {(surface.type === 'cube' || surface.type === 'diamond') && (
                        <NumericField
                          label="Rondeur"
                          value={surface.roundness}
                          min={0}
                          max={2}
                          step={0.01}
                          onActiveChange={active => updateHighlight(active ? 'head' : null)}
                          onChange={roundness => updateSurface({ ...surface, roundness })}
                        />
                      )}
                      {surface.type === 'cylinder' && (
                        <NumericField
                          label="Rondeur des arêtes"
                          value={surface.roundness}
                          min={0}
                          max={2}
                          step={0.01}
                          onActiveChange={active => updateHighlight(active ? 'head' : null)}
                          onChange={roundness => updateSurface({ ...surface, roundness })}
                        />
                      )}
                      {(surface.type === 'cylinder' || surface.type === 'cone') && (
                        <NumericField
                          label="Rondeur globale"
                          value={surface.morphRoundness ?? 0}
                          min={0}
                          max={2}
                          step={0.01}
                          onActiveChange={active => updateHighlight(active ? 'head' : null)}
                          onChange={morphRoundness => updateSurface({ ...surface, morphRoundness })}
                        />
                      )}
                      {surface.type === 'cone' && (
                        <>
                          <NumericField
                            label="Rondeur pointe"
                            value={surface.tipRoundness ?? 0}
                            min={0}
                            max={2}
                            step={0.01}
                            onActiveChange={active => updateHighlight(active ? 'head' : null)}
                            onChange={tipRoundness => updateSurface({ ...surface, tipRoundness })}
                          />
                          <NumericField
                            label="Rondeur base"
                            value={surface.baseRoundness ?? 0}
                            min={0}
                            max={2}
                            step={0.01}
                            onActiveChange={active => updateHighlight(active ? 'head' : null)}
                            onChange={baseRoundness => updateSurface({ ...surface, baseRoundness })}
                          />
                        </>
                      )}
                    </div>
                  </InspectorCard>
                  <InspectorCard className="color-panel">
                    <PanelTitle
                      level={3}
                      title="Couleur du corps"
                      subtitle="Couleur de base utilisée par les poses et les expressions."
                    />
                    <ColorField
                      label="Corps"
                      value={activeAvatar.colors.body}
                      onChange={body => updateAvatarColors({ body })}
                    />
                  </InspectorCard>
                </ControlSection>
                <ControlSection
                  title="Yeux"
                  subtitle="Forme, placement, orientation et couleur du regard par défaut."
                >
                  <p className="section-description">
                    {t(
                      'Définis l’identité du regard de cet avatar. Les poses s’ajoutent ensuite à cette base.'
                    )}
                  </p>
                  {(['width', 'height', 'size'] as const).map(dimension => (
                    <InspectorCard className="compact" key={`avatar-${dimension}`}>
                      <div className="panel-inline-title">
                        <h3>
                          {t(
                            {
                              width: 'Largeur',
                              height: 'Hauteur',
                              size: 'Taille proportionnelle',
                            }[dimension]
                          )}
                        </h3>
                        <LinkButton
                          linked={linked[dimension]}
                          label={`Lier ${dimension}`}
                          onClick={() =>
                            setLinked(current => ({
                              ...current,
                              [dimension]: !current[dimension],
                            }))
                          }
                        />
                      </div>
                      <div className="eye-columns">
                        {(['Left', 'Right'] as Side[]).map(side => {
                          const width = activeAvatarEyes[`width${side}`]
                          const height = activeAvatarEyes[`height${side}`]
                          const value =
                            dimension === 'width'
                              ? width
                              : dimension === 'height'
                                ? height
                                : Math.max(width, height)
                          return (
                            <NumericField
                              key={side}
                              label={side === 'Left' ? 'Œil gauche' : 'Œil droit'}
                              value={value}
                              min={10}
                              max={dimension === 'size' ? 110 : 100}
                              unit="u"
                              onActiveChange={active =>
                                updateHighlight(
                                  active
                                    ? linked[dimension]
                                      ? 'both'
                                      : side === 'Left'
                                        ? 'left'
                                        : 'right'
                                    : null
                                )
                              }
                              onChange={next =>
                                dimension === 'size'
                                  ? updateAvatarEyeSize(side, next)
                                  : updateAvatarEyeDimension(side, dimension, next)
                              }
                            />
                          )
                        })}
                      </div>
                    </InspectorCard>
                  ))}
                  <InspectorCard>
                    <div className="panel-inline-title">
                      <div>
                        <h3>{t('Position et espacement')}</h3>
                        <p className="panel-inline-subtitle">
                          {t('Coordonnées propres à l’avatar, indépendantes des poses.')}
                        </p>
                      </div>
                      <LinkButton
                        linked={linked.position}
                        label="Lier la position des yeux"
                        onClick={() =>
                          setLinked(current => ({ ...current, position: !current.position }))
                        }
                      />
                    </div>
                    <div className="eye-columns">
                      {(['Left', 'Right'] as Side[]).map(side => (
                        <div className="eye-column" key={side}>
                          <h3>{t(side === 'Left' ? 'Œil gauche' : 'Œil droit')}</h3>
                          <NumericField
                            label="Horizontale"
                            value={activeAvatarEyes[`positionX${side}`]}
                            unit="u"
                            onActiveChange={active =>
                              updateHighlight(
                                active
                                  ? linked.position
                                    ? 'both'
                                    : side === 'Left'
                                      ? 'left'
                                      : 'right'
                                  : null
                              )
                            }
                            onChange={value => updateAvatarEyePosition(side, 'X', value)}
                          />
                          <NumericField
                            label="Verticale"
                            value={activeAvatarEyes[`positionY${side}`]}
                            unit="u"
                            onActiveChange={active =>
                              updateHighlight(
                                active
                                  ? linked.position
                                    ? 'both'
                                    : side === 'Left'
                                      ? 'left'
                                      : 'right'
                                  : null
                              )
                            }
                            onChange={value => updateAvatarEyePosition(side, 'Y', value)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="position-spacing">
                      <NumericField
                        label="Espacement"
                        value={activeAvatarEyes.spacing}
                        min={0}
                        max={150}
                        unit="u"
                        onActiveChange={active => updateHighlight(active ? 'both' : null)}
                        onChange={spacing => updateAvatarEyes({ spacing })}
                      />
                    </div>
                  </InspectorCard>
                  <InspectorCard>
                    <PanelTitle
                      level={3}
                      title="Rotation locale"
                      subtitle="Inclinaison par défaut propre à chaque œil."
                    />
                    <div className="eye-columns">
                      <NumericField
                        label="Œil gauche"
                        value={activeAvatarEyes.leftAngle}
                        unit="°"
                        onActiveChange={active => updateHighlight(active ? 'left' : null)}
                        onChange={leftAngle => updateAvatarEyes({ leftAngle })}
                      />
                      <NumericField
                        label="Œil droit"
                        value={activeAvatarEyes.rightAngle}
                        unit="°"
                        onActiveChange={active => updateHighlight(active ? 'right' : null)}
                        onChange={rightAngle => updateAvatarEyes({ rightAngle })}
                      />
                    </div>
                  </InspectorCard>
                  <InspectorCard className="color-panel">
                    <PanelTitle
                      level={3}
                      title="Couleur des yeux"
                      subtitle="Couleur de base utilisée par les poses et les expressions."
                    />
                    <ColorField
                      label="Yeux"
                      value={activeAvatar.colors.eyes}
                      onChange={eyes => updateAvatarColors({ eyes })}
                    />
                  </InspectorCard>
                </ControlSection>
              </>
            )}
            {!bodyEditing && (
              <>
                <ControlSection
                  title="Corps"
                  subtitle="Orientation et apparence générale de la pose."
                >
                  <InspectorCard className="color-panel">
                    <PanelTitle
                      level={3}
                      title="Couleur du corps"
                      subtitle="La pose peut remplacer temporairement la couleur de l’avatar."
                    />
                    <ColorField
                      label="Corps"
                      value={expression.bodyColor ?? activeAvatar.colors.body}
                      onChange={bodyColor => updateImmediate({ ...expression, bodyColor })}
                    />
                    {expression.bodyColor && (
                      <Button
                        className="inherit-colors"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = { ...expression }
                          delete next.bodyColor
                          updateImmediate(next)
                        }}
                      >
                        {t('Reprendre la couleur de l’avatar')}
                      </Button>
                    )}
                  </InspectorCard>
                  <InspectorCard>
                    <PanelTitle
                      level={3}
                      title="Rotation de la tête"
                      subtitle="Les libellés ↔ sont scrubbables, comme dans Figma."
                    />
                    <NumericField
                      label="Rotation X"
                      value={expression.headX}
                      unit="°"
                      onActiveChange={active => updateHighlight(active ? 'head' : null)}
                      onChange={value => updateImmediate({ ...expression, headX: value })}
                    />
                    <NumericField
                      label="Rotation Y"
                      value={expression.headY}
                      unit="°"
                      onActiveChange={active => updateHighlight(active ? 'head' : null)}
                      onChange={value => updateImmediate({ ...expression, headY: value })}
                    />
                    <NumericField
                      label="Rotation Z"
                      value={expression.headZ}
                      unit="°"
                      onActiveChange={active => updateHighlight(active ? 'head' : null)}
                      onChange={value => updateImmediate({ ...expression, headZ: value })}
                    />
                  </InspectorCard>
                </ControlSection>
                <ControlSection
                  title="Yeux"
                  subtitle="Forme, placement, orientation et couleur du regard."
                >
                  <InspectorCard className="color-panel">
                    <PanelTitle
                      level={3}
                      title="Couleur des yeux"
                      subtitle="La pose peut remplacer temporairement la couleur de l’avatar."
                    />
                    <ColorField
                      label="Yeux"
                      value={expression.eyeColor ?? activeAvatar.colors.eyes}
                      onChange={eyeColor => updateImmediate({ ...expression, eyeColor })}
                    />
                    {expression.eyeColor && (
                      <Button
                        className="inherit-colors"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = { ...expression }
                          delete next.eyeColor
                          updateImmediate(next)
                        }}
                      >
                        {t('Reprendre la couleur de l’avatar')}
                      </Button>
                    )}
                  </InspectorCard>
                  {(['width', 'height', 'size'] as const).map(dimension => (
                    <InspectorCard className="compact" key={dimension}>
                      <div className="panel-inline-title">
                        <h3>
                          {t(
                            {
                              width: 'Largeur',
                              height: 'Hauteur',
                              size: 'Taille proportionnelle',
                            }[dimension]
                          )}
                        </h3>
                        <LinkButton
                          linked={linked[dimension]}
                          label={`Lier ${dimension}`}
                          onClick={() =>
                            setLinked(current => ({
                              ...current,
                              [dimension]: !current[dimension],
                            }))
                          }
                        />
                      </div>
                      <div className="eye-columns">
                        {(['Left', 'Right'] as Side[]).map(side => {
                          const width = expression[`width${side}`]
                          const height = expression[`height${side}`]
                          const value =
                            dimension === 'width'
                              ? width
                              : dimension === 'height'
                                ? height
                                : Math.max(width, height)
                          return (
                            <NumericField
                              key={side}
                              label={side === 'Left' ? 'Œil gauche' : 'Œil droit'}
                              value={value}
                              min={10}
                              max={dimension === 'size' ? 110 : 100}
                              unit="u"
                              onActiveChange={active =>
                                updateHighlight(
                                  active
                                    ? linked[dimension]
                                      ? 'both'
                                      : side === 'Left'
                                        ? 'left'
                                        : 'right'
                                    : null
                                )
                              }
                              onChange={next =>
                                dimension === 'size'
                                  ? updateSize(side, next)
                                  : updateDimension(side, dimension, next)
                              }
                            />
                          )
                        })}
                      </div>
                    </InspectorCard>
                  ))}
                  <InspectorCard>
                    <PanelTitle
                      level={3}
                      title="Position et espacement"
                      subtitle="Coordonnées communes projetées sur la forme choisie."
                    />
                    <div className="eye-columns">
                      <div className="eye-column">
                        <h3>{t('Œil gauche')}</h3>
                        <NumericField
                          label="Horizontale"
                          value={expression.positionXLeft}
                          unit="u"
                          onActiveChange={active => updateHighlight(active ? 'left' : null)}
                          onChange={value =>
                            updateImmediate({ ...expression, positionXLeft: value })
                          }
                        />
                        <NumericField
                          label="Verticale"
                          value={expression.positionYLeft}
                          unit="u"
                          onActiveChange={active => updateHighlight(active ? 'left' : null)}
                          onChange={value =>
                            updateImmediate({ ...expression, positionYLeft: value })
                          }
                        />
                      </div>
                      <div className="eye-column">
                        <h3>{t('Œil droit')}</h3>
                        <NumericField
                          label="Horizontale"
                          value={expression.positionXRight}
                          unit="u"
                          onActiveChange={active => updateHighlight(active ? 'right' : null)}
                          onChange={value =>
                            updateImmediate({ ...expression, positionXRight: value })
                          }
                        />
                        <NumericField
                          label="Verticale"
                          value={expression.positionYRight}
                          unit="u"
                          onActiveChange={active => updateHighlight(active ? 'right' : null)}
                          onChange={value =>
                            updateImmediate({ ...expression, positionYRight: value })
                          }
                        />
                      </div>
                    </div>
                    <div className="position-spacing">
                      <NumericField
                        label="Espacement"
                        value={expression.spacing}
                        min={0}
                        max={150}
                        unit="u"
                        onActiveChange={active => updateHighlight(active ? 'both' : null)}
                        onChange={updateSpacing}
                      />
                    </div>
                  </InspectorCard>
                  <InspectorCard>
                    <PanelTitle
                      level={3}
                      title="Rotation locale"
                      subtitle="Inclinaison propre à chaque œil."
                    />
                    <div className="eye-columns">
                      <NumericField
                        label="Œil gauche"
                        value={expression.leftAngle}
                        unit="°"
                        onActiveChange={active => updateHighlight(active ? 'left' : null)}
                        onChange={value => updateImmediate({ ...expression, leftAngle: value })}
                      />
                      <NumericField
                        label="Œil droit"
                        value={expression.rightAngle}
                        unit="°"
                        onActiveChange={active => updateHighlight(active ? 'right' : null)}
                        onChange={value => updateImmediate({ ...expression, rightAngle: value })}
                      />
                    </div>
                  </InspectorCard>
                </ControlSection>
                <ControlSection
                  title="Projection"
                  subtitle="Perspective et repères appliqués à la surface active."
                >
                  <InspectorCard>
                    <PanelTitle
                      level={3}
                      title="Perspective"
                      subtitle="Profondeur simulée du visage."
                    />
                    <NumericField
                      label="Perspective"
                      value={expression.perspective}
                      step={0.01}
                      unit="×"
                      onChange={value => updateImmediate({ ...expression, perspective: value })}
                    />
                    <div className="switch">
                      <span>{t('Afficher le maillage')}</span>
                      <Switch
                        checked={showWire}
                        onCheckedChange={updateWireVisibility}
                        aria-label={t('Afficher le maillage')}
                      />
                    </div>
                    <Button
                      className="reset"
                      variant="outline"
                      type="button"
                      onClick={() => transitionToExpression({ ...defaultExpression })}
                    >
                      {t('Réinitialiser')}
                    </Button>
                  </InspectorCard>
                </ControlSection>
              </>
            )}
          </div>
        )}

        {!editing && bodyEditing && (
          <footer className="workspace-footer">
            <Button
              variant="destructive"
              disabled={avatars.length <= 1}
              onClick={() => setDeleteAvatarOpen(true)}
            >
              <Trash2 />
              {t('Supprimer')}
            </Button>
            <Button onClick={() => setBodyEditing(false)}>{t('Enregistrer')}</Button>
          </footer>
        )}

        {!editing && !bodyEditing && mode === 'expressions' && (
          <div className="panel-stack">
            <InspectorCard>
              <div className="preset-header">
                <div>
                  <p className="eyebrow">{expressions.length} presets</p>
                  <h2>{t('Expressions')}</h2>
                </div>
                <span>{t('Double-clic pour modifier')}</span>
              </div>
              <div className="expression-grid">
                {expressions.map((preset, index) => (
                  <ExpressionCard
                    key={index}
                    expression={preset}
                    index={index}
                    active={activeExpression === index}
                    surface={surface}
                    bodyNodes={bodyNodes}
                    colors={activeAvatar.colors}
                    avatarEyes={activeAvatarEyes}
                    previewId={String(index)}
                    onSelect={() => transitionToExpression(preset, index)}
                    onEdit={() => openExpressionEditor(index, preset)}
                  />
                ))}
                <Button
                  className="expression-add"
                  variant="outline"
                  type="button"
                  onClick={() => openExpressionEditor(null, expression)}
                  aria-label={t('Nouvelle expression')}
                >
                  +
                </Button>
              </div>
            </InspectorCard>
            <InspectorCard>
              <PanelTitle
                title="Mouvement"
                subtitle="Motion interpole les valeurs et notre moteur effectue le slerp quaternion."
              />
              <NumericField
                label="Vitesse du ressort"
                value={springSpeed}
                step={0.5}
                onChange={value => {
                  springSpeedRef.current = value
                  setSpringSpeed(value)
                }}
              />
              <div className="button-row">
                <Button variant="outline" type="button" onClick={blink}>
                  {t('Cligner')}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const index = Math.floor(Math.random() * expressions.length)
                    transitionToExpression(expressions[index], index)
                  }}
                >
                  {t('Expression aléatoire')}
                </Button>
              </div>
            </InspectorCard>
          </div>
        )}

        {!editing && !bodyEditing && mode === 'states' && (
          <div className="panel-stack">
            <InspectorCard>
              <div className="preset-header">
                <div>
                  <p className="eyebrow">{t('Séquences')}</p>
                  <h2>{t('États animés')}</h2>
                </div>
              </div>
              <div className="state-groups">
                {Object.entries(stateGroups).map(([group, states]) => (
                  <div key={group}>
                    <strong>{t(group)}</strong>
                    <div className="state-buttons">
                      {states.map(name => (
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          key={name}
                          aria-pressed={selectedState === name}
                          onClick={() => setSelectedState(name)}
                        >
                          {t(name)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </InspectorCard>
            <InspectorCard className="state-detail">
              <h2>{t(selectedState)}</h2>
              <p>
                {t(
                  stateNotes[selectedState] ??
                    'Cet état enchaîne un pool de presets et des clignements.'
                )}
              </p>
              <div className="state-expression-section">
                <div className="state-section-heading">
                  <div>
                    <h3>{t('Expressions de la séquence')}</h3>
                    <p>{t('Les presets sont joués dans cet ordre, puis la boucle recommence.')}</p>
                  </div>
                  <Badge variant="secondary">{statePools[selectedState].length} expressions</Badge>
                </div>
                <div className="expression-grid state-expression-grid">
                  {statePools[selectedState].map((index, position) => {
                    const preset = expressions[index]
                    if (!preset) return null
                    return (
                      <ExpressionCard
                        key={`${selectedState}-${position}-${index}`}
                        expression={preset}
                        index={index}
                        active={activeExpression === index}
                        surface={surface}
                        bodyNodes={bodyNodes}
                        colors={activeAvatar.colors}
                        avatarEyes={activeAvatarEyes}
                        previewId={`state-${selectedState}-${position}-${index}`}
                        onSelect={() => transitionToExpression(preset, index)}
                      />
                    )
                  })}
                </div>
              </div>
              <div className="state-blink-section">
                <div className="state-section-heading">
                  <div>
                    <h3>{t('Logique de clignement')}</h3>
                    <p>
                      {t('Le rythme reste naturel grâce à un intervalle légèrement aléatoire.')}
                    </p>
                  </div>
                </div>
                <div className="state-logic-grid">
                  <div>
                    <span>{t('Premier clignement')}</span>
                    <strong>
                      {formatSeconds(selectedStatePlayback.blink.initialDelayMs, language)}
                    </strong>
                    <small>{t('après le lancement')}</small>
                  </div>
                  <div>
                    <span>{t('Intervalle')}</span>
                    <strong>
                      {formatSeconds(selectedStatePlayback.blink.minIntervalMs, language)}–
                      {formatSeconds(selectedStatePlayback.blink.maxIntervalMs, language)}
                    </strong>
                    <small>{t('tirage aléatoire')}</small>
                  </div>
                  <div>
                    <span>{t('Durée')}</span>
                    <strong>{selectedStatePlayback.blink.durationMs} ms</strong>
                    <small>{t('fermeture et ouverture')}</small>
                  </div>
                  <div>
                    <span>{t('Changement d’expression')}</span>
                    <strong>
                      {formatSeconds(selectedStatePlayback.expressionIntervalMs, language)}
                    </strong>
                    <small>{t('cadence de la séquence')}</small>
                  </div>
                </div>
              </div>
              <div className="button-row">
                <Button type="button" onClick={() => launchState(selectedState)}>
                  {t(activeState === selectedState ? 'Relancer' : 'Lancer')}
                </Button>
                {activeState === selectedState && (
                  <Button variant="outline" type="button" onClick={toggleStatePlayback}>
                    {t(statePlaying ? 'Pause' : 'Reprendre')}
                  </Button>
                )}
              </div>
            </InspectorCard>
          </div>
        )}
      </main>
      <AlertDialog open={deleteAvatarOpen} onOpenChange={setDeleteAvatarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(`Supprimer ${activeAvatar.name} ?`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Le corps et les couleurs de cet avatar seront définitivement supprimés. Les expressions globales seront conservées.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteActiveAvatar}>{t('Supprimer')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleteExpressionOpen} onOpenChange={setDeleteExpressionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Supprimer cette expression ?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Cette action retirera définitivement le preset de la bibliothèque globale.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteEditing}>{t('Supprimer')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ControlSection({
  title,
  subtitle,
  compact = false,
  children,
}: {
  title: string
  subtitle: string
  compact?: boolean
  children: React.ReactNode
}) {
  const { t } = useStudioLanguage()
  return (
    <section className={`control-section${compact ? ' control-section-compact' : ''}`}>
      <header className="control-section-header">
        <h2>{t(title)}</h2>
        <p>{t(subtitle)}</p>
      </header>
      <Separator className="control-section-separator" />
      <div className="control-section-content">{children}</div>
    </section>
  )
}

function InspectorCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return <Card className={`panel${className ? ` ${className}` : ''}`} {...props} />
}

function StatePlayer({
  name,
  playing,
  onToggle,
  onStop,
}: {
  name: string | null
  playing: boolean
  onToggle: () => void
  onStop: () => void
}) {
  const { t } = useStudioLanguage()
  if (!name) return null
  return (
    <div className="state-player" aria-label={t(`État en cours : ${name}`)}>
      <span className={playing ? 'is-playing' : 'is-paused'}>
        <i />
        <span>
          <small>{t(playing ? 'En lecture' : 'En pause')}</small>
          <strong>{t(name)}</strong>
        </span>
      </span>
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label={t(playing ? `Mettre ${name} en pause` : `Reprendre ${name}`)}
        onClick={onToggle}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t(`Arrêter ${name}`)} onClick={onStop}>
        <Square />
      </Button>
    </div>
  )
}

function PanelTitle({
  title,
  subtitle,
  level = 2,
}: {
  title: string
  subtitle: string
  level?: 2 | 3
}) {
  const { t } = useStudioLanguage()
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <CardHeader className="panel-title">
      <CardTitle as={Heading}>{t(title)}</CardTitle>
      <CardDescription>{t(subtitle)}</CardDescription>
    </CardHeader>
  )
}

export default function App() {
  return (
    <StudioLanguageProvider>
      <StudioApp />
    </StudioLanguageProvider>
  )
}
