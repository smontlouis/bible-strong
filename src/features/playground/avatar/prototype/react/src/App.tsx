import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react'
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileCode2,
  GripVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react'

import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Field, FieldTitle } from './components/ui/field'
import { Input } from './components/ui/input'
import { Separator } from './components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select'
import { Switch } from './components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './components/ui/context-menu'
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
  translateBodyNodeInCameraPlane,
  translateBodyNodeAlongLocalAxis,
  type AvatarPose,
  type Expression,
  type Point3,
} from './geometry'
import { defaultExpression } from './presets'
import {
  createSequence,
  createSequenceStep,
  duplicateSequence,
  findExpressionIndex,
  getSequenceSpring,
  groupSequences,
  readSequenceClock,
  remapSequencesAfterExpressionDelete,
  type AvatarSequence,
  type SequenceStep,
} from './sequences'
import { ambientBodyOffset, applyAmbientMotion, hasAmbientMotion } from './ambientMotion'
import { surfaceLabels, surfacePresets, type SurfaceConfig } from './surfaces'
import {
  createStudioDocumentStore,
  loadStudioDocument,
  type StatePlaybackSelection,
} from './studioDocument'
import {
  advancePlaybackTimeline,
  beginPlayback,
  createPlaybackTimeline,
  pausePlaybackTimeline,
  schedulePlaybackBlink,
  schedulePlaybackStep,
  stopPlaybackTimeline,
} from './playback'
import {
  createRenderedColors,
  createRenderedScene,
  findBodyNodePath,
  paintRenderedColors,
  paintRenderedOffset,
  paintRenderedScene,
  type RenderedScene,
} from './renderedScene'
import { scaleEye, updateEyeDimension, updateEyePosition } from './expressionEditing'
import {
  beginManipulation,
  finishManipulation,
  previewManipulation,
  type ManipulationSession,
} from './manipulationSession'
import {
  avatarExportFileName,
  createAvatarExportPayload,
  generateJavaScriptAvatarPackage,
  generateReactAvatarComponent,
} from './exporter'

type Mode = 'manual' | 'expressions' | 'states' | 'export'
type ExportFormat = 'react' | 'javascript'
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

const RETARGET_BLEND_MS = 120
const INSPECTOR_FRAME_MS = 1000 / 24
const AMBIENT_FRAME_MS = 1000 / 30
const createExpressionId = () => `expression-${crypto.randomUUID()}`
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

const useEscapeToCancel = (cancel: () => void) => {
  const cancelEvent = useEffectEvent(cancel)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelEvent()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

const scaleSurface = (
  surface: SurfaceConfig,
  size: number,
  minimums: Pick<SurfaceConfig, 'width' | 'height' | 'depth'>
) => {
  const currentSize = Math.max(surface.width, surface.height, surface.depth) || 1
  const factor = size / currentSize
  return {
    ...surface,
    width: bounded(surface.width * factor, minimums.width, 300),
    height: bounded(surface.height * factor, minimums.height, 300),
    depth: bounded(surface.depth * factor, minimums.depth, 300),
  }
}

const formatSeconds = (milliseconds: number, language: StudioLanguage) =>
  `${new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(milliseconds / 1000)} s`

const parseHexColor = (color: string) => {
  const value = color.replace('#', '')
  return [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16))
}

const interpolateHexColor = (from: string, to: string, progress: number) => {
  const fromChannels = parseHexColor(from)
  const toChannels = parseHexColor(to)
  return `#${fromChannels
    .map((channel, index) =>
      Math.round(channel + (toChannels[index] - channel) * progress)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

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

function AmbientMotionField<Motion extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: Motion
  options: { value: Motion; label: string }[]
  onChange: (value: Motion) => void
}) {
  const { t } = useStudioLanguage()
  return (
    <Field className="ambient-motion-field" orientation="horizontal">
      <FieldTitle>{t(label)}</FieldTitle>
      <Select
        value={value}
        items={options.map(option => ({ value: option.value, label: t(option.label) }))}
        onValueChange={next => next && onChange(next as Motion)}
      >
        <SelectTrigger aria-label={t(label)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  const editingRef = useRef(false)
  const [draftValue, setDraftValue] = useState(() =>
    String(Number(value.toFixed(step < 0.1 ? 2 : 1)))
  )

  useEffect(() => {
    if (!editingRef.current) {
      setDraftValue(String(Number(value.toFixed(step < 0.1 ? 2 : 1))))
    }
  }, [step, value])

  const commitDraftValue = (rawValue: string) => {
    const parsedValue = Number(rawValue.replace(',', '.'))
    const nextValue =
      Number.isFinite(parsedValue) && rawValue.trim() !== ''
        ? bounded(parsedValue, min, max)
        : value

    setDraftValue(String(Number(nextValue.toFixed(step < 0.1 ? 2 : 1))))
    onChange(nextValue)
  }

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
          value={draftValue}
          onFocus={() => {
            editingRef.current = true
            onActiveChange?.(true)
          }}
          onBlur={event => {
            editingRef.current = false
            commitDraftValue(event.currentTarget.value)
            onActiveChange?.(false)
          }}
          onChange={event => setDraftValue(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur()
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
  const cancel = () => {
    if (drag.current) onChange(drag.current.expression)
    stop()
  }
  useEscapeToCancel(cancel)
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
          onPointerCancel={cancel}
        />
        <path
          className="gizmo-orbit gizmo-y"
          d={ringPath(rings.y)}
          onPointerDown={event => startAxis('y', event)}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={cancel}
        />
        <path
          className="gizmo-orbit gizmo-x"
          d={ringPath(rings.x)}
          onPointerDown={event => startAxis('x', event)}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={cancel}
        />
        <path
          className="gizmo-orbit gizmo-z"
          d={ringPath(rings.z)}
          onPointerDown={event => startAxis('z', event)}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={cancel}
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
    { mode: 'translate' | 'rotate'; axis: TransformAxis } | { mode: 'plane' } | undefined
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
    | {
        mode: 'plane'
        startPoint: readonly [number, number]
        node: BodyNode
      }
    | undefined
  >(undefined)
  const latestNode = useRef(node)
  const manipulation = useRef<ManipulationSession<BodyNode> | null>(null)
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
    manipulation.current = beginManipulation(node)
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
    manipulation.current = beginManipulation(node)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startPlaneTranslate = (event: React.PointerEvent<SVGElement>) => {
    event.stopPropagation()
    drag.current = { mode: 'plane', startPoint: toSvg(event), node }
    setActiveControl({ mode: 'plane' })
    latestNode.current = node
    manipulation.current = beginManipulation(node)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: React.PointerEvent<SVGElement>) => {
    if (!drag.current) return
    const interaction = drag.current
    const point = toSvg(event)
    const deltaX = point[0] - interaction.startPoint[0]
    const deltaY = point[1] - interaction.startPoint[1]
    const next = (() => {
      if (interaction.mode === 'plane') {
        return translateBodyNodeInCameraPlane(interaction.node, pose, deltaX, deltaY)
      }
      const delta =
        (deltaX * interaction.direction[0] + deltaY * interaction.direction[1]) * interaction.scale
      return interaction.mode === 'translate'
        ? translateBodyNodeAlongLocalAxis(interaction.node, interaction.axis, delta)
        : rotateBodyNodeAroundLocalAxis(interaction.node, interaction.axis, delta)
    })()
    latestNode.current = next
    if (manipulation.current) {
      previewManipulation(manipulation.current, next)
    }
    if (previewFrame.current !== undefined) return
    previewFrame.current = requestAnimationFrame(() => {
      previewFrame.current = undefined
      onPreview(latestNode.current)
    })
  }
  const stop = () => {
    if (previewFrame.current !== undefined) cancelAnimationFrame(previewFrame.current)
    previewFrame.current = undefined
    if (manipulation.current) {
      finishManipulation(manipulation.current, 'commit', { preview: onPreview, commit: onCommit })
    }
    manipulation.current = null
    drag.current = undefined
    setActiveControl(undefined)
  }
  const cancel = () => {
    if (previewFrame.current !== undefined) cancelAnimationFrame(previewFrame.current)
    previewFrame.current = undefined
    if (manipulation.current) {
      finishManipulation(manipulation.current, 'cancel', { preview: onPreview, commit: onCommit })
    }
    manipulation.current = null
    drag.current = undefined
    setActiveControl(undefined)
  }
  useEscapeToCancel(cancel)
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
            onPointerCancel={cancel}
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
            onPointerCancel={cancel}
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
      <circle
        className="body-gizmo-plane-hitbox"
        cx={geometry.center[0]}
        cy={geometry.center[1]}
        r="11"
        aria-label={t('Déplacer dans le plan de la caméra')}
        onPointerDown={startPlaneTranslate}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={cancel}
      />
      <circle
        className={`body-gizmo-origin${activeControl?.mode === 'plane' ? ' is-active' : ''}`}
        cx={geometry.center[0]}
        cy={geometry.center[1]}
        r="4"
        pointerEvents="none"
      />
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
  scene,
  showWire,
  bodyEditing,
  selectedBodyNodeId,
  selectedBodyNode,
  selectedSide,
  linked,
  highlight,
  onHighlightChange,
  onBodyNodeSelect,
  onBodyNodePreview,
  onBodyNodeChange,
  onEyeSelect,
  onPreview,
  onChange,
  onReset,
  onEyeChange,
}: {
  expression: Expression
  avatarEyes: AvatarEyeDefaults
  surface: SurfaceConfig
  scene: RenderedScene
  showWire: boolean
  bodyEditing: boolean
  selectedBodyNodeId: 'primary' | string | null
  selectedBodyNode: BodyNode | null
  selectedSide: -1 | 1 | null
  linked: { width: boolean; height: boolean; size: boolean }
  highlight: Highlight
  onHighlightChange: (highlight: Highlight) => void
  onBodyNodeSelect: (id: 'primary' | string | null) => void
  onBodyNodePreview: (next: BodyNode) => void
  onBodyNodeChange: (next: BodyNode) => void
  onEyeSelect: (side: -1 | 1) => void
  onPreview: (next: Expression) => void
  onChange: (next: Expression) => void
  onReset: (next: Expression) => void
  onEyeChange?: (next: Expression) => void
}) {
  const { t } = useStudioLanguage()
  const {
    wirePaths,
    backPaths,
    frontPaths,
    backNodeIds,
    frontNodeIds,
    headPath,
    leftPath,
    rightPath,
    leftOpacity,
    rightOpacity,
    offsetX,
    offsetY,
  } = scene
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
  const canvasManipulation = useRef<ManipulationSession<Expression> | null>(null)
  const editor =
    selectedSide === null
      ? null
      : renderEyeEditor(poseWithAvatarEyes(expression, avatarEyes), surface, selectedSide)
  const selectedBodyPath = (() => {
    if (!bodyEditing || !selectedBodyNodeId) return null
    return findBodyNodePath(scene, selectedBodyNodeId)
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
    canvasManipulation.current = beginManipulation(expression)
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
    canvasManipulation.current = beginManipulation(editableExpression)
    setActiveDragType(type)
    svgRef.current!.setPointerCapture(event.pointerId)
  }
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const point = toSvg(event)
    if (drag.current.type === 'arcball') {
      const next = rotateExpressionWithArcball(
        drag.current.expression,
        drag.current.startPoint,
        point
      )
      if (canvasManipulation.current) {
        previewManipulation(canvasManipulation.current, next, onPreview)
      }
      return
    }
    const interaction = drag.current
    const suffix = interaction.side < 0 ? 'Left' : 'Right'
    const deltaX = point[0] - interaction.startPoint[0]
    const deltaY = point[1] - interaction.startPoint[1]
    const along = (axis: readonly [number, number]) => deltaX * axis[0] + deltaY * axis[1]
    let next = { ...interaction.expression }
    const side = interaction.side < 0 ? 'Left' : 'Right'
    if (interaction.type === 'width') {
      const value = bounded(
        interaction.expression[`width${suffix}`] + along(interaction.widthAxis) * 2,
        10,
        100
      )
      next = updateEyeDimension(interaction.expression, side, 'width', value, linked.width)
    } else if (interaction.type === 'height') {
      const value = bounded(
        interaction.expression[`height${suffix}`] + along(interaction.heightAxis) * 2,
        10,
        100
      )
      next = updateEyeDimension(interaction.expression, side, 'height', value, linked.height)
    } else if (interaction.type === 'size') {
      const distance = Math.hypot(
        point[0] - interaction.center[0],
        point[1] - interaction.center[1]
      )
      const factor = distance / interaction.startDistance
      const targetSize =
        Math.max(
          interaction.expression[`width${suffix}`],
          interaction.expression[`height${suffix}`]
        ) * factor
      next = scaleEye(interaction.expression, side, targetSize, linked.size)
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
    if (canvasManipulation.current) {
      previewManipulation(canvasManipulation.current, next, onPreview)
    }
  }
  const commitDrag = () => {
    const interaction = drag.current
    const session = canvasManipulation.current
    if (interaction && session) {
      finishManipulation(session, 'commit', {
        preview: onPreview,
        commit: interaction.type === 'arcball' ? onChange : (onEyeChange ?? onChange),
      })
    }
    canvasManipulation.current = null
    drag.current = null
    setActiveDragType(null)
    onHighlightChange(null)
  }
  const cancelDrag = () => {
    const interaction = drag.current
    const session = canvasManipulation.current
    if (interaction && session) {
      finishManipulation(session, 'cancel', { preview: onPreview, commit: onChange })
    }
    canvasManipulation.current = null
    drag.current = null
    setActiveDragType(null)
    onHighlightChange(null)
  }
  useEscapeToCancel(cancelDrag)
  return (
    <div className="avatar-wrap">
      <svg
        ref={svgRef}
        className="avatar"
        viewBox="-150 -150 300 300"
        role="img"
        aria-label={t('Avatar procédural')}
        onPointerMove={move}
        onPointerUp={commitDrag}
        onPointerCancel={cancelDrag}
      >
        <defs>
          <clipPath id="avatar-head-clip">
            <motion.path d={headPath} />
          </clipPath>
        </defs>
        <motion.g style={{ x: offsetX, y: offsetY }}>
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
        </motion.g>
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
        onReset={() => onReset({ ...expression, headX: 0, headY: 0, headZ: 0 })}
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
  onDuplicate,
  onDelete,
  draggable,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDrop,
  onDragEnd,
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
  onDuplicate?: () => void
  onDelete?: () => void
  draggable?: boolean
  onDragStart?: (event: React.DragEvent<HTMLButtonElement>) => void
  onDragEnter?: () => void
  onDragOver?: (event: React.DragEvent<HTMLButtonElement>) => void
  onDrop?: (event: React.DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
}) {
  const { t } = useStudioLanguage()
  const card = (
    <Button
      className="expression-card"
      variant="outline"
      aria-pressed={active}
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
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
  if (!onEdit) return card
  return (
    <ContextMenu>
      <ContextMenuTrigger render={card} />
      <ContextMenuContent>
        <ContextMenuItem onClick={onEdit}>
          <Pencil /> {t('Modifier')}
        </ContextMenuItem>
        {onDuplicate && (
          <ContextMenuItem onClick={onDuplicate}>
            <Copy /> {t('Dupliquer')}
          </ContextMenuItem>
        )}
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 /> {t('Supprimer')}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function ExpressionWorkspace({
  editing,
  avatarColors,
  backButtonRef,
  onChange,
  onCancel,
  onSave,
  onDuplicate,
  onDelete,
}: {
  editing: { index: number | null; draft: Expression }
  avatarColors: AvatarColors
  backButtonRef: RefObject<HTMLButtonElement | null>
  onChange: (draft: Expression) => void
  onCancel: () => void
  onSave: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { t } = useStudioLanguage()
  const [linked, setLinked] = useState({
    width: true,
    height: true,
    size: true,
    rotation: true,
  })
  const update = (changes: Partial<Expression>) => onChange({ ...editing.draft, ...changes })
  const updateDimension = (side: Side, dimension: 'width' | 'height', value: number) => {
    onChange(updateEyeDimension(editing.draft, side, dimension, value, linked[dimension]))
  }
  const updateSize = (side: Side, value: number) => {
    onChange(scaleEye(editing.draft, side, value, linked.size))
  }
  const updateRotation = (side: Side, value: number) => {
    onChange({
      ...editing.draft,
      [side === 'Left' ? 'leftAngle' : 'rightAngle']: value,
      ...(linked.rotation ? { [side === 'Left' ? 'rightAngle' : 'leftAngle']: -value } : {}),
    })
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
            <Card className="dialog-group color-panel">
              <h3>{t('Couleur du corps')}</h3>
              <ColorField
                label="Corps"
                value={editing.draft.bodyColor ?? avatarColors.body}
                onChange={bodyColor => update({ bodyColor })}
              />
              {editing.draft.bodyColor && (
                <Button
                  className="inherit-colors"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('Reprendre la couleur de l’avatar')}
                  onClick={() => {
                    const draft = { ...editing.draft }
                    delete draft.bodyColor
                    onChange(draft)
                  }}
                >
                  <RotateCcw />
                </Button>
              )}
            </Card>
            <Card className="dialog-group">
              <h3>{t('Mouvement perpétuel')}</h3>
              <AmbientMotionField
                label="Corps"
                value={editing.draft.bodyMotion}
                options={[
                  { value: 'none', label: 'Aucun mouvement' },
                  { value: 'slowDrift', label: 'Dérive lente' },
                  { value: 'shake', label: 'Tremblement' },
                ]}
                onChange={bodyMotion => update({ bodyMotion })}
              />
              <p className="field-help">
                {t('Ajoute une légère présence ou un tremblement continu au corps.')}
              </p>
            </Card>
            <Card className="dialog-group color-panel">
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
            <Card className="dialog-group color-panel">
              <h3>{t('Couleur des yeux')}</h3>
              <ColorField
                label="Yeux"
                value={editing.draft.eyeColor ?? avatarColors.eyes}
                onChange={eyeColor => update({ eyeColor })}
              />
              {editing.draft.eyeColor && (
                <Button
                  className="inherit-colors"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('Reprendre la couleur de l’avatar')}
                  onClick={() => {
                    const draft = { ...editing.draft }
                    delete draft.eyeColor
                    onChange(draft)
                  }}
                >
                  <RotateCcw />
                </Button>
              )}
            </Card>
            <Card className="dialog-group">
              <h3>{t('Mouvement perpétuel')}</h3>
              <AmbientMotionField
                label="Yeux"
                value={editing.draft.eyeMotion}
                options={[
                  { value: 'none', label: 'Aucun mouvement' },
                  { value: 'microSaccades', label: 'Micro-ajustements' },
                  { value: 'shake', label: 'Tremblement' },
                ]}
                onChange={eyeMotion => update({ eyeMotion })}
              />
              <p className="field-help">
                {t('Anime le regard par petites saccades naturelles ou par tremblement.')}
              </p>
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
              <div className="panel-inline-title">
                <h3>{t('Rotation locale')}</h3>
                <LinkButton
                  linked={linked.rotation}
                  label="Lier les rotations"
                  onClick={() =>
                    setLinked(current => ({ ...current, rotation: !current.rotation }))
                  }
                />
              </div>
              <div className="eye-columns">
                <NumericField
                  label="Œil gauche"
                  value={editing.draft.leftAngle}
                  unit="°"
                  onChange={value => updateRotation('Left', value)}
                />
                <NumericField
                  label="Œil droit"
                  value={editing.draft.rightAngle}
                  unit="°"
                  onChange={value => updateRotation('Right', value)}
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
        <div className="workspace-footer-secondary">
          {editing.index !== null && (
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 />
              {t('Supprimer')}
            </Button>
          )}
          <Button variant="outline" onClick={onDuplicate}>
            <Copy />
            {t('Dupliquer')}
          </Button>
        </div>
        <div className="dialog-actions-main">
          <Button onClick={onSave}>{t('Enregistrer')}</Button>
        </div>
      </footer>
    </>
  )
}

function SequenceWorkspace({
  editing,
  expressions,
  surface,
  bodyNodes,
  colors,
  avatarEyes,
  selectedStepId,
  backButtonRef,
  reduceMotion,
  onSelectedStepChange,
  onChange,
  onPreviewStep,
  onEditExpression,
  onPlay,
  onPause,
  onStop,
  playing,
  active,
  onCancel,
  onSave,
  onDuplicate,
  onDelete,
}: {
  editing: { sourceId: string | null; draft: AvatarSequence }
  expressions: Expression[]
  surface: SurfaceConfig
  bodyNodes: BodyNode[]
  colors: AvatarColors
  avatarEyes: AvatarEyeDefaults
  selectedStepId: string | null
  backButtonRef: RefObject<HTMLButtonElement | null>
  reduceMotion: boolean
  onSelectedStepChange: (id: string | null) => void
  onChange: (draft: AvatarSequence) => void
  onPreviewStep: (step: SequenceStep) => void
  onEditExpression: (index: number, expression: Expression) => void
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  playing: boolean
  active: boolean
  onCancel: () => void
  onSave: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { t } = useStudioLanguage()
  const draggedStepId = useRef<string | null>(null)
  const selectedStep =
    editing.draft.steps.find(step => step.id === selectedStepId) ?? editing.draft.steps[0]

  const updateStep = (changes: Partial<SequenceStep>) => {
    if (!selectedStep) return
    onChange({
      ...editing.draft,
      steps: editing.draft.steps.map(step =>
        step.id === selectedStep.id ? { ...step, ...changes } : step
      ),
    })
  }

  const moveStep = (targetId: string) => {
    const draggedId = draggedStepId.current
    if (!draggedId || draggedId === targetId) return
    const dragged = editing.draft.steps.find(step => step.id === draggedId)
    const targetIndex = editing.draft.steps.findIndex(step => step.id === targetId)
    if (!dragged || targetIndex < 0) return
    const next = editing.draft.steps.filter(step => step.id !== draggedId)
    next.splice(targetIndex, 0, dragged)
    onChange({ ...editing.draft, steps: next })
  }

  return (
    <>
      <header className="workspace-header">
        <Button
          ref={backButtonRef}
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label={t('Retour aux animations')}
        >
          <ArrowLeft />
        </Button>
        <div className="workspace-heading">
          <p className="eyebrow">{t('Éditeur d’animation')}</p>
          <h1>{editing.sourceId ? t('Modifier l’animation') : t('Nouvelle animation')}</h1>
          <p>{t('Compose les expressions, leur cadence et les clignements de cette animation.')}</p>
        </div>
        <div className="workspace-header-actions">
          <Button
            variant="outline"
            size="icon"
            onClick={active && playing ? onPause : onPlay}
            aria-label={t(
              active && playing ? 'Pause' : active ? 'Reprendre' : 'Prévisualiser l’animation'
            )}
          >
            {active && playing ? <Pause /> : <Play fill="currentColor" />}
          </Button>
          {active && (
            <Button
              variant="outline"
              size="icon"
              onClick={onStop}
              aria-label={t('Arrêter l’animation')}
            >
              <Square fill="currentColor" />
            </Button>
          )}
        </div>
      </header>

      <div className="workspace-scroll sequence-workspace-scroll">
        <ControlSection
          title="Identité"
          subtitle="Nom, catégorie et comportement de lecture de l’animation."
          compact
        >
          <InspectorCard>
            <Field>
              <FieldTitle>{t('Nom')}</FieldTitle>
              <Input
                value={editing.draft.name}
                onChange={event => onChange({ ...editing.draft, name: event.currentTarget.value })}
              />
            </Field>
            <Field>
              <FieldTitle>{t('Catégorie')}</FieldTitle>
              <Select
                value={editing.draft.group}
                items={[
                  { value: 'Cycle de vie', label: t('Cycle de vie') },
                  { value: 'Réactions', label: t('Réactions') },
                  { value: 'Custom', label: t('Custom') },
                ]}
                onValueChange={value => value && onChange({ ...editing.draft, group: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cycle de vie">{t('Cycle de vie')}</SelectItem>
                  <SelectItem value="Réactions">{t('Réactions')}</SelectItem>
                  <SelectItem value="Custom">{t('Custom')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldTitle>{t('Description')}</FieldTitle>
              <Input
                value={editing.draft.description}
                onChange={event =>
                  onChange({ ...editing.draft, description: event.currentTarget.value })
                }
              />
            </Field>
            <Field>
              <FieldTitle>{t('Mode de lecture')}</FieldTitle>
              <Select
                value={editing.draft.playbackMode}
                items={[
                  { value: 'loop', label: t('Boucle') },
                  { value: 'once', label: t('Une fois') },
                  { value: 'pingPong', label: t('Aller-retour') },
                ]}
                onValueChange={value =>
                  value &&
                  onChange({
                    ...editing.draft,
                    playbackMode: value as AvatarSequence['playbackMode'],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loop">{t('Boucle')}</SelectItem>
                  <SelectItem value="once">{t('Une fois')}</SelectItem>
                  <SelectItem value="pingPong">{t('Aller-retour')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </InspectorCard>
        </ControlSection>

        <ControlSection
          title="Timeline"
          subtitle="Glisse les étapes pour les réordonner, puis sélectionne-en une pour régler sa cadence."
          compact
        >
          <InspectorCard>
            {editing.draft.steps.length ? (
              <div className="sequence-timeline">
                {editing.draft.steps.map((step, position) => {
                  const expressionIndex = findExpressionIndex(expressions, step.expressionId)
                  const preset = expressions[expressionIndex]
                  if (!preset) return null
                  const card = (
                    <Button
                      variant="outline"
                      type="button"
                      aria-pressed={selectedStep?.id === step.id}
                      onClick={() => {
                        onSelectedStepChange(step.id)
                        onPreviewStep(step)
                      }}
                      onDoubleClick={() => onEditExpression(expressionIndex, preset)}
                    >
                      <GripVertical className="sequence-grip" />
                      <ExpressionPreview
                        expression={preset}
                        surface={surface}
                        bodyNodes={bodyNodes}
                        colors={colors}
                        avatarEyes={avatarEyes}
                        id={`sequence-${editing.draft.id}-${step.id}`}
                      />
                      <span>{String(expressionIndex).padStart(2, '0')}</span>
                      <small>{position + 1}</small>
                    </Button>
                  )
                  return (
                    <motion.div
                      className="sequence-step"
                      data-selected={selectedStep?.id === step.id || undefined}
                      key={step.id}
                      layout="position"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 500, damping: 40 }
                      }
                      draggable
                      onDragStart={() => {
                        draggedStepId.current = step.id
                        onSelectedStepChange(step.id)
                      }}
                      onDragEnter={() => moveStep(step.id)}
                      onDragOver={event => event.preventDefault()}
                      onDragEnd={() => {
                        draggedStepId.current = null
                      }}
                    >
                      <ContextMenu>
                        <ContextMenuTrigger render={card} />
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => onEditExpression(expressionIndex, preset)}
                          >
                            <Pencil /> {t('Modifier')}
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <p className="sequence-empty">{t('Ajoute une expression pour commencer.')}</p>
            )}

            {selectedStep ? (
              <div className="sequence-step-settings">
                <div className="state-section-heading">
                  <div>
                    <h3>{t('Étape sélectionnée')}</h3>
                    <p>{t('Durée visible avant de passer à l’expression suivante.')}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => {
                      const next = editing.draft.steps.filter(step => step.id !== selectedStep.id)
                      onChange({ ...editing.draft, steps: next })
                      onSelectedStepChange(next[0]?.id ?? null)
                    }}
                    aria-label={t('Supprimer cette étape')}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <NumericField
                  label="Temps d’affichage"
                  value={selectedStep.holdMs}
                  min={100}
                  max={60000}
                  step={100}
                  unit="ms"
                  onChange={holdMs => updateStep({ holdMs })}
                />
                <NumericField
                  label="Durée de transition"
                  value={selectedStep.transitionMs}
                  min={0}
                  max={5000}
                  step={50}
                  unit="ms"
                  onChange={transitionMs => updateStep({ transitionMs })}
                />
                <Field className="sequence-transition-field" orientation="horizontal">
                  <FieldTitle>{t('Transition')}</FieldTitle>
                  <Select
                    value={selectedStep.transition}
                    items={[
                      { value: 'spring', label: t('Ressort') },
                      { value: 'smooth', label: t('Douce') },
                      { value: 'snappy', label: t('Rapide') },
                    ]}
                    onValueChange={value =>
                      value && updateStep({ transition: value as SequenceStep['transition'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spring">{t('Ressort')}</SelectItem>
                      <SelectItem value="smooth">{t('Douce')}</SelectItem>
                      <SelectItem value="snappy">{t('Rapide')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            ) : null}
          </InspectorCard>

          <InspectorCard>
            <PanelTitle
              level={3}
              title="Ajouter une expression"
              subtitle="Sélectionne un preset pour l’ajouter à la fin de la timeline."
            />
            <div className="expression-grid sequence-expression-library">
              {expressions.map((preset, index) => (
                <Button
                  className="expression-card"
                  variant="outline"
                  type="button"
                  key={index}
                  onClick={() => {
                    const step = createSequenceStep(preset.id)
                    onChange({ ...editing.draft, steps: [...editing.draft.steps, step] })
                    onSelectedStepChange(step.id)
                    onPreviewStep(step)
                  }}
                >
                  <ExpressionPreview
                    expression={preset}
                    surface={surface}
                    bodyNodes={bodyNodes}
                    colors={colors}
                    avatarEyes={avatarEyes}
                    id={`sequence-library-${index}`}
                  />
                  <span>{String(index).padStart(2, '0')}</span>
                </Button>
              ))}
            </div>
          </InspectorCard>
        </ControlSection>

        <ControlSection
          title="Clignements"
          subtitle="Le blink fonctionne indépendamment des changements d’expression."
          compact
        >
          <InspectorCard>
            <div className="switch">
              <span>{t('Activer les clignements')}</span>
              <Switch
                checked={editing.draft.blink.enabled}
                onCheckedChange={enabled =>
                  onChange({
                    ...editing.draft,
                    blink: { ...editing.draft.blink, enabled },
                  })
                }
              />
            </div>
            <NumericField
              label="Premier clignement"
              value={editing.draft.blink.initialDelayMs}
              min={0}
              max={60000}
              step={100}
              unit="ms"
              onChange={initialDelayMs =>
                onChange({
                  ...editing.draft,
                  blink: { ...editing.draft.blink, initialDelayMs },
                })
              }
            />
            <div className="eye-columns">
              <NumericField
                label="Intervalle minimum"
                value={editing.draft.blink.minIntervalMs}
                min={100}
                max={60000}
                step={100}
                unit="ms"
                onChange={minIntervalMs =>
                  onChange({
                    ...editing.draft,
                    blink: {
                      ...editing.draft.blink,
                      minIntervalMs,
                      maxIntervalMs: Math.max(minIntervalMs, editing.draft.blink.maxIntervalMs),
                    },
                  })
                }
              />
              <NumericField
                label="Intervalle maximum"
                value={editing.draft.blink.maxIntervalMs}
                min={editing.draft.blink.minIntervalMs}
                max={60000}
                step={100}
                unit="ms"
                onChange={maxIntervalMs =>
                  onChange({
                    ...editing.draft,
                    blink: { ...editing.draft.blink, maxIntervalMs },
                  })
                }
              />
            </div>
            <NumericField
              label="Durée du clignement"
              value={editing.draft.blink.durationMs}
              min={40}
              max={3000}
              step={20}
              unit="ms"
              onChange={durationMs =>
                onChange({
                  ...editing.draft,
                  blink: { ...editing.draft.blink, durationMs },
                })
              }
            />
          </InspectorCard>
        </ControlSection>
      </div>

      <footer className="workspace-footer">
        <div className="workspace-footer-secondary">
          {editing.sourceId && (
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 /> {t('Supprimer')}
            </Button>
          )}
          <Button variant="outline" onClick={onDuplicate}>
            <Copy /> {t('Dupliquer')}
          </Button>
        </div>
        <Button
          disabled={!editing.draft.steps.length || !editing.draft.name.trim()}
          onClick={onSave}
        >
          {t('Enregistrer')}
        </Button>
      </footer>
    </>
  )
}

function StudioApp() {
  const { language, setLanguage, t } = useStudioLanguage()
  const [mode, setMode] = useState<Mode>('manual')
  const [initialDocument] = useState(loadStudioDocument)
  const [documentStore] = useState(() => createStudioDocumentStore(initialDocument))
  const initialLibrary = initialDocument.library
  const [avatars, setAvatars] = useState(initialLibrary.avatars)
  const [activeAvatarId, setActiveAvatarId] = useState(initialLibrary.activeAvatarId)
  const initialAvatar =
    initialLibrary.avatars.find(avatar => avatar.id === initialLibrary.activeAvatarId) ??
    initialLibrary.avatars[0]
  const [surface, setSurface] = useState(initialAvatar.body.primary)
  const [bodyNodes, setBodyNodes] = useState(initialAvatar.body.nodes)
  const [selectedBodyNodeId, setSelectedBodyNodeId] = useState<'primary' | string | null>('primary')
  const [selectedEyeSide, setSelectedEyeSide] = useState<-1 | 1 | null>(null)
  const [expressions, setExpressions] = useState(initialDocument.expressions)
  const [sequences, setSequences] = useState(initialDocument.sequences)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('react')
  const [exportAnimationIds, setExportAnimationIds] = useState(() =>
    initialDocument.sequences.map(animation => animation.id)
  )
  const initialStatePlayback = initialDocument.playback
  const persistAvatarLibrary = (library: typeof initialDocument.library) =>
    documentStore.update({ library })
  const persistGlobalExpressions = (nextExpressions: Expression[]) =>
    documentStore.update({ expressions: nextExpressions })
  const persistSequences = (nextSequences: AvatarSequence[]) =>
    documentStore.update({ sequences: nextSequences })
  const persistStatePlayback = (playback: StatePlaybackSelection) =>
    documentStore.update({ playback })
  const [bodyEditing, setBodyEditing] = useState(false)
  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  const avatarEditSnapshot = useRef<{
    avatars: StudioAvatar[]
    activeAvatarId: string
  } | null>(null)
  const workspaceBackButtonRef = useRef<HTMLButtonElement>(null)
  const [focusAvatarName, setFocusAvatarName] = useState(false)
  const initialExpression = expressions[0] ?? defaultExpression
  const [expression, setExpression] = useState<Expression>({ ...initialExpression })
  const initialDisplayColors = resolveColors(initialExpression, initialAvatar.colors)
  const [renderedColors] = useState(() => createRenderedColors(initialDisplayColors))
  const setDisplayColors = (next: AvatarColors) => {
    paintRenderedColors(renderedColors, next)
  }
  const [deleteAvatarOpen, setDeleteAvatarOpen] = useState(false)
  const [deleteExpressionOpen, setDeleteExpressionOpen] = useState(false)
  const [deleteSequenceOpen, setDeleteSequenceOpen] = useState(false)
  const [statePlayerExpanded, setStatePlayerExpanded] = useState(false)
  const [activeExpression, setActiveExpression] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ index: number | null; draft: Expression } | null>(null)
  const [showWire, setShowWire] = useState(false)
  const [springSpeed, setSpringSpeed] = useState(7)
  const [linked, setLinked] = useState({
    width: true,
    height: true,
    size: true,
    position: true,
    rotation: true,
  })
  const [highlight, setHighlight] = useState<Highlight>(null)
  const [selectedState, setSelectedState] = useState(() =>
    sequences.some(sequence => sequence.id === initialStatePlayback.stateId)
      ? initialStatePlayback.stateId!
      : sequences.some(sequence => sequence.id === 'idle')
        ? 'idle'
        : (sequences[0]?.id ?? '')
  )
  const [activeState, setActiveState] = useState<string | null>(null)
  const [statePlaying, setStatePlaying] = useState(false)
  const [playbackVisual, setPlaybackVisual] = useState({
    position: null as number | null,
    run: 0,
    durationMs: 0,
  })
  const [sequenceEditing, setSequenceEditing] = useState<{
    sourceId: string | null
    draft: AvatarSequence
  } | null>(null)
  const [selectedSequenceStepId, setSelectedSequenceStepId] = useState<string | null>(null)
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeSequenceRef = useRef<AvatarSequence | null>(null)
  const editorStateSnapshot = useRef<{
    stateId: string
    playing: boolean
    expression: Expression
  } | null>(null)
  const initialStatePlaybackApplied = useRef(false)
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [initialPlaybackTimeline] = useState(createPlaybackTimeline)
  const playbackTimeline = useRef(initialPlaybackTimeline)
  const reduceMotion = useReducedMotion()

  const avatarsRef = useRef(avatars)
  const draggedAvatarId = useRef<string | null>(null)
  const avatarDragOrigin = useRef<StudioAvatar[] | null>(null)
  const avatarDragPreview = useRef(avatars)
  const [draggingAvatarId, setDraggingAvatarId] = useState<string | null>(null)
  const draggedExpressionId = useRef<string | null>(null)
  const expressionDragOrigin = useRef<Expression[] | null>(null)
  const expressionDragPreview = useRef(expressions)
  const [draggingExpressionId, setDraggingExpressionId] = useState<string | null>(null)
  const draggedStateId = useRef<string | null>(null)
  const stateDragOrigin = useRef<AvatarSequence[] | null>(null)
  const stateDragPreview = useRef(sequences)
  const [draggingStateId, setDraggingStateId] = useState<string | null>(null)
  const activeAvatarIdRef = useRef(activeAvatarId)
  const surfaceRef = useRef(surface)
  const bodyNodesRef = useRef(bodyNodes)
  const showWireRef = useRef(showWire)
  const highlightRef = useRef(highlight)
  const [initialRender] = useState(() => {
    const pose = poseFromExpression(initialExpression)
    return {
      pose,
      geometry: renderAvatar(
        poseWithAvatarEyes(initialExpression, initialAvatar.eyes),
        surface,
        1,
        { bodyNodes }
      ),
    }
  })
  const { pose: initialPose, geometry: initialGeometry } = initialRender
  const displayedPose = useRef<AvatarPose>(initialPose)
  const transitionFrame = useRef<number | null>(null)
  const ambientFrame = useRef<number | null>(null)
  const ambientStartedAt = useRef(0)
  const lastAmbientElapsed = useRef(0)
  const lastAmbientFrame = useRef(0)
  const ambientSignature = useRef('none:none')
  const transitionTarget = useRef<Expression>({ ...initialExpression })
  const canonicalTarget = useRef<Expression>({ ...initialExpression })
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
  const sequenceTransitionRef = useRef<Pick<SequenceStep, 'transitionMs' | 'transition'>>({
    transitionMs: 500,
    transition: 'smooth',
  })
  const activeSequenceTransition = useRef<{
    target: Expression
    index: number | null
    settings: Pick<SequenceStep, 'transitionMs' | 'transition'>
    remainingMs: number
  } | null>(null)
  const pausedSequenceTransition = useRef<typeof activeSequenceTransition.current>(null)
  const blinkControls = useRef<ReturnType<typeof animate> | null>(null)
  const blinkAnimating = useRef(false)
  const blinkValue = useMotionValue(1)
  const [renderedScene] = useState(() => createRenderedScene(initialGeometry))

  const paintPose = (pose: AvatarPose, blink?: number, frameTimeMs?: number) => {
    displayedPose.current = pose
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    const signature = `${pose.expression.eyeMotion}:${pose.expression.bodyMotion}`
    if (signature !== ambientSignature.current) {
      ambientSignature.current = signature
      ambientStartedAt.current = -1
      lastAmbientElapsed.current = 0
    }
    if (frameTimeMs !== undefined) {
      if (ambientStartedAt.current < 0) ambientStartedAt.current = frameTimeMs
      lastAmbientElapsed.current = frameTimeMs - ambientStartedAt.current
    }
    const renderedExpression =
      !reduceMotion && hasAmbientMotion(pose.expression)
        ? applyAmbientMotion(pose.expression, lastAmbientElapsed.current)
        : pose.expression
    const renderPose = avatar
      ? poseWithAvatarEyes(renderedExpression, avatar.eyes ?? defaultAvatarEyes)
      : poseFromExpression(renderedExpression)
    const geometry = renderAvatar(renderPose, surfaceRef.current, blink ?? blinkValue.get(), {
      includeWire: showWireRef.current || highlightRef.current === 'head',
      bodyNodes: bodyNodesRef.current,
    })
    paintRenderedScene(renderedScene, geometry)
    paintRenderedOffset(
      renderedScene,
      ambientBodyOffset(pose.expression, lastAmbientElapsed.current)
    )
  }

  useMotionValueEvent(blinkValue, 'change', latest => paintPose(displayedPose.current, latest))

  const paintAmbientFrame = useEffectEvent((time: number) => {
    if (transitionFrame.current === null && time - lastAmbientFrame.current >= AMBIENT_FRAME_MS) {
      lastAmbientFrame.current = time
      paintPose(displayedPose.current, undefined, time)
    }
  })

  const ambientLoopActive = !reduceMotion && hasAmbientMotion(editing?.draft ?? expression)
  useEffect(() => {
    if (!ambientLoopActive) return
    const tick = (time: number) => {
      paintAmbientFrame(time)
      ambientFrame.current = requestAnimationFrame(tick)
    }
    ambientFrame.current = requestAnimationFrame(tick)
    return () => {
      if (ambientFrame.current !== null) cancelAnimationFrame(ambientFrame.current)
    }
  }, [ambientLoopActive])

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

  const updateImmediate = (next: Expression, preservePlayback = false) => {
    if (!preservePlayback && statePlaying) pauseState()
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

  const transitionToExpression = (
    next: Expression,
    index: number | null = null,
    transitionSettings?: Pick<SequenceStep, 'transitionMs' | 'transition'>
  ) => {
    if (!transitionSettings && statePlaying) pauseState()
    sequenceTransitionRef.current = transitionSettings ?? {
      transitionMs: 500,
      transition: 'smooth',
    }
    setActiveExpression(index)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (reduceMotion || transitionSettings?.transitionMs === 0) {
      updateImmediate(next, Boolean(transitionSettings))
      setActiveExpression(index)
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

    if (transitionSettings) {
      stopTransition(true)
      const durationMs = transitionSettings.transitionMs
      const from = { ...current }
      const fromColors = {
        body: renderedColors.body.get(),
        eyes: renderedColors.eyes.get(),
      }
      const targetColors = avatar ? resolveColors(next, avatar.colors) : fromColors
      let startedAt: number | null = null
      activeSequenceTransition.current = {
        target: next,
        index,
        settings: transitionSettings,
        remainingMs: durationMs,
      }
      const tickSequenceTransition = (time: number) => {
        if (startedAt === null) startedAt = time
        const elapsed = time - startedAt
        const progress = Math.min(elapsed / durationMs, 1)
        const eased =
          transitionSettings.transition === 'smooth'
            ? progress * progress * (3 - 2 * progress)
            : transitionSettings.transition === 'snappy'
              ? 1 - (1 - progress) ** 3
              : 1 - Math.exp(-6 * progress) * Math.cos(8 * progress)
        const animated = { ...from, eyeMotion: next.eyeMotion, bodyMotion: next.bodyMotion }
        expressionFields.forEach(field => {
          animated[field] = from[field] + (resolvedTarget[field] - from[field]) * eased
        })
        activeSequenceTransition.current = {
          target: next,
          index,
          settings: transitionSettings,
          remainingMs: Math.max(durationMs - elapsed, 0),
        }
        setDisplayColors({
          body: interpolateHexColor(fromColors.body, targetColors.body, bounded(eased, 0, 1)),
          eyes: interpolateHexColor(fromColors.eyes, targetColors.eyes, bounded(eased, 0, 1)),
        })
        paintPose(poseFromExpression(animated), undefined, time)
        if (
          modeRef.current === 'manual' &&
          time - lastInspectorFrame.current >= INSPECTOR_FRAME_MS
        ) {
          lastInspectorFrame.current = time
          setExpression(animated)
        }
        if (progress < 1) {
          transitionFrame.current = requestAnimationFrame(tickSequenceTransition)
          return
        }
        transitionFrame.current = null
        activeSequenceTransition.current = null
        canonicalTarget.current = next
        transitionTarget.current = next
        setExpression(next)
        setDisplayColors(targetColors)
        paintPose(poseFromExpression(next))
      }
      transitionFrame.current = requestAnimationFrame(tickSequenceTransition)
      return
    }

    if (avatar) {
      const targetColors = resolveColors(next, avatar.colors)
      animate(renderedColors.body, targetColors.body, { duration: 0.35, ease: 'easeInOut' })
      animate(renderedColors.eyes, targetColors.eyes, { duration: 0.35, ease: 'easeInOut' })
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
      const { stiffness, damping } = getSequenceSpring(
        sequenceTransitionRef.current.transition,
        sequenceTransitionRef.current.transitionMs,
        springSpeedRef.current
      )
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
      animated.eyeMotion = target.eyeMotion
      animated.bodyMotion = target.bodyMotion

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

      paintPose(poseFromExpression(animated), undefined, time)
      if (modeRef.current === 'manual' && time - lastInspectorFrame.current >= INSPECTOR_FRAME_MS) {
        lastInspectorFrame.current = time
        setExpression(animated)
      }
      transitionFrame.current = requestAnimationFrame(tick)
    }
    transitionFrame.current = requestAnimationFrame(tick)
  }

  const blink = (durationMs?: number) => {
    blinkControls.current?.stop()
    blinkValue.jump(1)
    blinkAnimating.current = true
    const sequence = sequences.find(item => item.id === (activeState ?? selectedState))
    const blinkDuration = durationMs ?? sequence?.blink.durationMs ?? 280
    blinkControls.current = animate(blinkValue, [1, 0, 1], {
      duration: reduceMotion ? 0 : blinkDuration / 1000,
      times: [0, 0.42, 1],
      ease: ['easeIn', 'easeOut'],
      onComplete: () => {
        blinkAnimating.current = false
      },
    })
  }

  const updateDimension = (side: Side, dimension: 'width' | 'height', value: number) => {
    updateImmediate(updateEyeDimension(expression, side, dimension, value, linked[dimension]))
  }

  const updateSize = (side: Side, value: number) => {
    updateImmediate(scaleEye(expression, side, value, linked.size))
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
    if (!avatarEditSnapshot.current) {
      persistAvatarLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: next })
    }
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
    if (editBody) suspendStateForEditor()
    if (editBody && !avatarEditSnapshot.current) {
      avatarEditSnapshot.current = {
        avatars: avatarsRef.current,
        activeAvatarId: activeAvatarIdRef.current,
      }
    }
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
    const nextExpression = activeState
      ? currentStateExpression
      : { ...(expressions[0] ?? defaultExpression) }
    setExpression(nextExpression)
    setDisplayColors(resolveColors(nextExpression, avatar.colors))
    canonicalTarget.current = nextExpression
    transitionTarget.current = nextExpression
    paintPose(poseFromExpression(nextExpression))
    if (!avatarEditSnapshot.current) {
      persistAvatarLibrary({ activeAvatarId: id, avatars: avatarsRef.current })
    }
  }

  const createNewAvatar = () => {
    avatarEditSnapshot.current = {
      avatars: avatarsRef.current,
      activeAvatarId: activeAvatarIdRef.current,
    }
    const avatar = createAvatar('Unknown')
    const next = [...avatarsRef.current, avatar]
    avatarsRef.current = next
    setAvatars(next)
    setFocusAvatarName(true)
    activateAvatar(avatar.id, true)
  }

  const duplicateAvatar = (source: StudioAvatar, editDuplicate = false) => {
    const snapshotAvatars = avatarEditSnapshot.current?.avatars ?? avatarsRef.current
    const sourceIndex = snapshotAvatars.findIndex(avatar => avatar.id === source.id)
    const baseAvatars = sourceIndex < 0 ? [...snapshotAvatars, source] : snapshotAvatars
    const duplicate: StudioAvatar = {
      ...structuredClone(source),
      id: `avatar-${crypto.randomUUID()}`,
      name: `${source.name} ${t('copie')}`,
    }
    const next = [...baseAvatars, duplicate]
    avatarEditSnapshot.current = null
    avatarsRef.current = next
    setAvatars(next)
    persistAvatarLibrary({ activeAvatarId: duplicate.id, avatars: next })
    activateAvatar(duplicate.id, editDuplicate)
  }

  const previewAvatarMove = (targetId: string) => {
    const draggedId = draggedAvatarId.current
    if (!draggedId || draggedId === targetId) return
    const current = avatarDragPreview.current
    const dragged = current.find(avatar => avatar.id === draggedId)
    const targetIndex = current.findIndex(avatar => avatar.id === targetId)
    if (!dragged || targetIndex < 0) return
    const next = current.filter(avatar => avatar.id !== draggedId)
    next.splice(targetIndex, 0, dragged)
    avatarDragPreview.current = next
    setAvatars(next)
  }

  const commitAvatarMove = (targetId: string) => {
    previewAvatarMove(targetId)
    const next = avatarDragPreview.current
    avatarsRef.current = next
    persistAvatarLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: next })
    avatarDragOrigin.current = null
    draggedAvatarId.current = null
    setDraggingAvatarId(null)
  }

  const cancelAvatarMove = () => {
    if (draggedAvatarId.current && avatarDragOrigin.current) {
      avatarDragPreview.current = avatarDragOrigin.current
      setAvatars(avatarDragOrigin.current)
    }
    avatarDragOrigin.current = null
    draggedAvatarId.current = null
    setDraggingAvatarId(null)
  }

  const cancelAvatarEditing = () => {
    const snapshot = avatarEditSnapshot.current
    if (!snapshot) {
      setBodyEditing(false)
      restoreStateAfterEditor()
      return
    }
    avatarEditSnapshot.current = null
    avatarsRef.current = snapshot.avatars
    setAvatars(snapshot.avatars)
    activateAvatar(snapshot.activeAvatarId, false, true)
    restoreStateAfterEditor()
  }

  const saveAvatarEditing = () => {
    avatarEditSnapshot.current = null
    persistAvatarLibrary({ activeAvatarId: activeAvatarIdRef.current, avatars: avatarsRef.current })
    setBodyEditing(false)
    restoreStateAfterEditor()
  }

  const renameActiveAvatar = (name: string) => {
    updateActiveAvatar(avatar => ({ ...avatar, name }))
  }

  const deleteActiveAvatar = () => {
    if (avatarsRef.current.length <= 1) return
    avatarEditSnapshot.current = null
    const remaining = avatarsRef.current.filter(avatar => avatar.id !== activeAvatarIdRef.current)
    avatarsRef.current = remaining
    setAvatars(remaining)
    persistAvatarLibrary({ activeAvatarId: remaining[0].id, avatars: remaining })
    setDeleteAvatarOpen(false)
    activateAvatar(remaining[0].id)
    restoreStateAfterEditor()
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
    if (next && statePlaying) pauseState()
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
    playbackTimeline.current = {
      ...playbackTimeline.current,
      stepDueAt: null,
      blinkDueAt: null,
    }
  }

  const pauseState = (persist = true) => {
    playbackTimeline.current = pausePlaybackTimeline(playbackTimeline.current, readSequenceClock())
    if (transitionFrame.current !== null && activeSequenceTransition.current) {
      cancelAnimationFrame(transitionFrame.current)
      transitionFrame.current = null
      pausedSequenceTransition.current = activeSequenceTransition.current
      activeSequenceTransition.current = null
    }
    if (blinkAnimating.current) blinkControls.current?.pause()
    clearStateTimers()
    setStatePlaying(false)
    if (persist && activeState) persistStatePlayback({ stateId: activeState, playing: false })
  }

  const stopState = (persist = true) => {
    clearStateTimers()
    playbackTimeline.current = stopPlaybackTimeline(playbackTimeline.current)
    activeSequenceTransition.current = null
    pausedSequenceTransition.current = null
    stopTransition(true)
    blinkControls.current?.stop()
    blinkAnimating.current = false
    blinkValue.jump(1)
    paintPose(displayedPose.current, 1)
    setStatePlaying(false)
    setPlaybackVisual(current => ({ ...current, position: null }))
    if (persist) persistStatePlayback({ stateId: activeState ?? selectedState, playing: false })
  }

  const launchSequence = (sequence: AvatarSequence, resume = false, persist = true) => {
    clearStateTimers()
    if (!sequence.steps.length) {
      stopState(persist)
      return
    }
    const id = sequence.id
    playbackTimeline.current = beginPlayback(playbackTimeline.current, resume)
    setSelectedState(id)
    setActiveState(id)
    activeSequenceRef.current = sequence
    setStatePlaying(true)
    if (persist) persistStatePlayback({ stateId: id, playing: true })
    const scheduleAdvance = (delay: number) => {
      playbackTimeline.current = schedulePlaybackStep(
        playbackTimeline.current,
        readSequenceClock(),
        delay
      )
      stateTimer.current = setTimeout(advance, delay)
    }
    const playCurrentStep = () => {
      playbackTimeline.current = { ...playbackTimeline.current, stepDueAt: null }
      const step = sequence.steps[playbackTimeline.current.position]
      const expressionIndex = findExpressionIndex(expressions, step.expressionId)
      const preset = expressions[expressionIndex]
      const durationMs = (reduceMotion ? 0 : step.transitionMs) + step.holdMs
      setPlaybackVisual(current => ({
        position: playbackTimeline.current.position,
        run: current.run + 1,
        durationMs,
      }))
      if (preset) {
        transitionToExpression(preset, expressionIndex, step)
      }
      scheduleAdvance(durationMs)
    }
    const advance = () => {
      const advanced = advancePlaybackTimeline(playbackTimeline.current, sequence)
      playbackTimeline.current = advanced.timeline
      const { cursor } = advanced
      if (cursor.complete) {
        if (blinkTimer.current) clearTimeout(blinkTimer.current)
        blinkTimer.current = null
        playbackTimeline.current = { ...playbackTimeline.current, blinkDueAt: null }
        setStatePlaying(false)
        setPlaybackVisual(current => ({ ...current, position: null }))
        return
      }
      playCurrentStep()
    }
    const scheduleBlink = (delay: number) => {
      playbackTimeline.current = schedulePlaybackBlink(
        playbackTimeline.current,
        readSequenceClock(),
        delay
      )
      blinkTimer.current = setTimeout(blinkLoop, delay)
    }
    const blinkLoop = () => {
      playbackTimeline.current = { ...playbackTimeline.current, blinkDueAt: null }
      blink(sequence.blink.durationMs)
      const { minIntervalMs, maxIntervalMs } = sequence.blink
      scheduleBlink(
        sequence.blink.durationMs + minIntervalMs + Math.random() * (maxIntervalMs - minIntervalMs)
      )
    }
    if (resume) {
      const pausedTransition = pausedSequenceTransition.current
      if (pausedTransition) {
        transitionToExpression(pausedTransition.target, pausedTransition.index, {
          ...pausedTransition.settings,
          transitionMs: pausedTransition.remainingMs,
        })
        pausedSequenceTransition.current = null
      }
      if (blinkAnimating.current) blinkControls.current?.play()
      const currentStep = sequence.steps[playbackTimeline.current.position]
      scheduleAdvance(
        playbackTimeline.current.stepRemainingMs ||
          (reduceMotion ? 0 : currentStep.transitionMs) + currentStep.holdMs
      )
    } else {
      playCurrentStep()
    }
    if (sequence.blink.enabled) {
      scheduleBlink(
        resume
          ? playbackTimeline.current.blinkRemainingMs || sequence.blink.initialDelayMs
          : sequence.blink.initialDelayMs
      )
    }
  }

  const toggleStatePlayback = () => {
    if (!activeState || !activeSequenceRef.current) return
    if (statePlaying) pauseState()
    else launchSequence(activeSequenceRef.current, true)
  }

  const suspendStateForEditor = () => {
    if (editorStateSnapshot.current || !activeState) return
    editorStateSnapshot.current = {
      stateId: activeState,
      playing: statePlaying,
      expression: { ...displayedPose.current.expression },
    }
    if (statePlaying) pauseState(false)
    setActiveState(null)
  }

  const restoreStateAfterEditor = (availableSequences = sequences) => {
    const snapshot = editorStateSnapshot.current
    editorStateSnapshot.current = null
    if (!snapshot) return
    const sequence = availableSequences.find(item => item.id === snapshot.stateId)
    if (!sequence) {
      stopState(false)
      persistStatePlayback({ stateId: null, playing: false })
      return
    }
    activeSequenceRef.current = sequence
    setSelectedState(sequence.id)
    setActiveState(sequence.id)
    if (snapshot.playing) {
      launchSequence(sequence, true, false)
      return
    }
    setStatePlaying(false)
    transitionToExpression(snapshot.expression)
  }

  useEffect(() => {
    if (initialStatePlaybackApplied.current) return
    initialStatePlaybackApplied.current = true
    const sequence = sequences.find(item => item.id === selectedState)
    if (!sequence || initialStatePlayback.stateId === null) return
    activeSequenceRef.current = sequence
    setActiveState(sequence.id)
    if (initialStatePlayback.playing) launchSequence(sequence, false, false)
  }, [])

  const saveEditing = () => {
    if (!editing) return
    const index = editing.index ?? expressions.length
    const savedDraft =
      editing.index === null ? { ...editing.draft, id: createExpressionId() } : editing.draft
    const next =
      editing.index === null
        ? [...expressions, savedDraft]
        : expressions.map((item, itemIndex) =>
            itemIndex === editing.index ? { ...savedDraft } : item
          )
    setExpressions(next)
    persistGlobalExpressions(next)
    setEditing(null)
    transitionToExpression(savedDraft, index)
    if (!sequenceEditing) restoreStateAfterEditor()
  }

  const duplicateExpression = (_index: number | null, draft: Expression, editDuplicate = false) => {
    const duplicate = { ...draft, id: createExpressionId() }
    const next = [...expressions, duplicate]
    const duplicateIndex = next.length - 1
    setExpressions(next)
    persistGlobalExpressions(next)
    if (editDuplicate) openExpressionEditor(duplicateIndex, duplicate)
    else transitionToExpression(duplicate, duplicateIndex)
  }

  const previewExpressionMove = (targetId: string | null) => {
    const draggedId = draggedExpressionId.current
    if (!draggedId || draggedId === targetId) return
    const current = expressionDragPreview.current
    const dragged = current.find(item => item.id === draggedId)
    if (!dragged) return
    const activeId = activeExpression === null ? null : current[activeExpression]?.id
    const next = current.filter(item => item.id !== draggedId)
    const targetIndex = targetId ? next.findIndex(item => item.id === targetId) : next.length
    next.splice(targetIndex < 0 ? next.length : targetIndex, 0, dragged)
    expressionDragPreview.current = next
    setExpressions(next)
    if (activeId) setActiveExpression(next.findIndex(item => item.id === activeId))
  }

  const commitExpressionMove = (targetId: string | null) => {
    previewExpressionMove(targetId)
    persistGlobalExpressions(expressionDragPreview.current)
    expressionDragOrigin.current = null
    draggedExpressionId.current = null
    setDraggingExpressionId(null)
  }

  const cancelExpressionMove = () => {
    if (draggedExpressionId.current && expressionDragOrigin.current) {
      expressionDragPreview.current = expressionDragOrigin.current
      setExpressions(expressionDragOrigin.current)
    }
    expressionDragOrigin.current = null
    draggedExpressionId.current = null
    setDraggingExpressionId(null)
  }

  const previewExpressionDraft = (draft: Expression) => {
    setEditing(current => (current ? { ...current, draft } : current))
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(draft, avatar.colors))
    paintPose(poseFromExpression(draft))
  }

  const previewCanvasExpression = (next: Expression) => {
    if (bodyEditing) {
      paintRenderedScene(
        renderedScene,
        renderAvatar(poseFromExpression(next), surfaceRef.current, blinkValue.get(), {
          includeWire: showWireRef.current || highlightRef.current === 'head',
          bodyNodes: bodyNodesRef.current,
        })
      )
      return
    }
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(next, avatar.colors))
    paintPose(poseFromExpression(next))
  }

  const openExpressionEditor = (index: number | null, draft: Expression) => {
    suspendStateForEditor()
    setBodyEditing(false)
    setMode('expressions')
    setEditing({
      index,
      draft: { ...draft, id: index === null ? createExpressionId() : draft.id },
    })
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(draft, avatar.colors))
    paintPose(poseFromExpression(draft))
  }

  const cancelExpressionEditing = () => {
    setEditing(null)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(expression, avatar.colors))
    paintPose(poseFromExpression(expression))
    if (!sequenceEditing) restoreStateAfterEditor()
  }

  const deleteEditing = () => {
    if (editing?.index === null || editing?.index === undefined) return
    const next =
      expressions.length <= 1
        ? [{ ...defaultExpression }]
        : expressions.filter((_, index) => index !== editing.index)
    const fallback = next[Math.min(editing.index, next.length - 1)] ?? defaultExpression
    const deletedExpressionId = expressions[editing.index]?.id ?? editing.draft.id
    const fallbackExpressionId = fallback.id
    const nextSequences = remapSequencesAfterExpressionDelete(
      sequences,
      deletedExpressionId,
      fallbackExpressionId
    )
    setExpressions(next)
    setSequences(nextSequences)
    if (sequenceEditing) {
      const draft = remapSequencesAfterExpressionDelete(
        [sequenceEditing.draft],
        deletedExpressionId,
        fallbackExpressionId
      )[0]
      setSequenceEditing({ ...sequenceEditing, draft })
    }
    persistGlobalExpressions(next)
    persistSequences(nextSequences)
    setActiveExpression(null)
    setEditing(null)
    setDeleteExpressionOpen(false)
    setExpression(fallback)
    const avatar = avatarsRef.current.find(item => item.id === activeAvatarIdRef.current)
    if (avatar) setDisplayColors(resolveColors(fallback, avatar.colors))
    paintPose(poseFromExpression(fallback))
    if (!sequenceEditing) restoreStateAfterEditor()
  }

  const openSequenceEditor = (sequence?: AvatarSequence) => {
    suspendStateForEditor()
    setEditing(null)
    setBodyEditing(false)
    setMode('states')
    const draft = sequence
      ? {
          ...sequence,
          steps: sequence.steps.map(step => ({ ...step })),
          blink: { ...sequence.blink },
        }
      : createSequence(expressions[activeExpression ?? 0]?.id ?? expressions[0]?.id)
    setSequenceEditing({ sourceId: sequence?.id ?? null, draft })
    setSelectedSequenceStepId(draft.steps[0]?.id ?? null)
    const firstStep = draft.steps[0]
    const expressionIndex = firstStep
      ? findExpressionIndex(expressions, firstStep.expressionId)
      : -1
    const preset = expressions[expressionIndex]
    if (preset) transitionToExpression(preset, expressionIndex, firstStep)
  }

  const cancelSequenceEditing = () => {
    if (activeState === sequenceEditing?.draft.id) stopState(false)
    setSequenceEditing(null)
    setSelectedSequenceStepId(null)
    restoreStateAfterEditor()
  }

  const saveSequenceEditing = () => {
    if (!sequenceEditing?.draft.steps.length || !sequenceEditing.draft.name.trim()) return
    const saved = {
      ...sequenceEditing.draft,
      name: sequenceEditing.draft.name.trim(),
      group: sequenceEditing.draft.group.trim() || 'Custom',
    }
    const next = sequenceEditing.sourceId
      ? sequences.map(sequence => (sequence.id === sequenceEditing.sourceId ? saved : sequence))
      : [...sequences, saved]
    setSequences(next)
    persistSequences(next)
    setSelectedState(saved.id)
    if (activeState === saved.id) stopState(false)
    setSequenceEditing(null)
    setSelectedSequenceStepId(null)
    restoreStateAfterEditor(next)
  }

  const duplicateSequenceEditing = () => {
    if (!sequenceEditing) return
    if (activeState === sequenceEditing.draft.id) stopState(false)
    const duplicate = duplicateSequence(sequenceEditing.draft)
    const next = [...sequences, duplicate]
    setSequences(next)
    persistSequences(next)
    setSelectedState(duplicate.id)
    setSequenceEditing({ sourceId: duplicate.id, draft: duplicate })
    setSelectedSequenceStepId(duplicate.steps[0]?.id ?? null)
  }

  const duplicateState = (sequence: AvatarSequence) => {
    if (activeState === sequence.id) stopState(false)
    const duplicate = duplicateSequence(sequence)
    const next = [...sequences, duplicate]
    setSequences(next)
    persistSequences(next)
    setSelectedState(duplicate.id)
  }

  const previewStateMove = (targetId: string | null, targetGroup: string) => {
    const draggedId = draggedStateId.current
    if (!draggedId || draggedId === targetId) return
    const current = stateDragPreview.current
    const dragged = current.find(sequence => sequence.id === draggedId)
    if (!dragged) return
    const next = current.filter(sequence => sequence.id !== draggedId)
    const moved = { ...dragged, group: targetGroup }
    if (targetId) {
      const targetIndex = next.findIndex(sequence => sequence.id === targetId)
      next.splice(targetIndex < 0 ? next.length : targetIndex, 0, moved)
    } else {
      let lastGroupIndex = -1
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (next[index].group !== targetGroup) continue
        lastGroupIndex = index
        break
      }
      next.splice(lastGroupIndex + 1, 0, moved)
    }
    stateDragPreview.current = next
    setSequences(next)
  }

  const commitStateMove = (targetId: string | null, targetGroup: string) => {
    previewStateMove(targetId, targetGroup)
    persistSequences(stateDragPreview.current)
    stateDragOrigin.current = null
    draggedStateId.current = null
    setDraggingStateId(null)
  }

  const cancelStateMove = () => {
    if (draggedStateId.current && stateDragOrigin.current) {
      stateDragPreview.current = stateDragOrigin.current
      setSequences(stateDragOrigin.current)
    }
    stateDragOrigin.current = null
    draggedStateId.current = null
    setDraggingStateId(null)
  }

  const deleteSequenceEditing = () => {
    if (!sequenceEditing?.sourceId) return
    const next = sequences.filter(sequence => sequence.id !== sequenceEditing.sourceId)
    const fallback = next[0]
    setSequences(next)
    persistSequences(next)
    if (activeState === sequenceEditing.sourceId) stopState(false)
    setSelectedState(fallback?.id ?? '')
    setSequenceEditing(null)
    setSelectedSequenceStepId(null)
    setDeleteSequenceOpen(false)
    restoreStateAfterEditor(next)
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
  const activeSequence = sequences.find(sequence => sequence.id === activeState) ?? null
  const activeSequenceLabel = activeSequence
    ? activeSequence.builtIn
      ? t(activeSequence.name)
      : activeSequence.name
    : null
  const expressionById = new Map(expressions.map(item => [item.id, item]))
  const exportAnimationIdSet = new Set(exportAnimationIds)
  const selectedExportAnimations = sequences.filter(animation =>
    exportAnimationIdSet.has(animation.id)
  )
  const toggleExportAnimation = (animationId: string) => {
    setExportAnimationIds(current =>
      current.includes(animationId)
        ? current.filter(id => id !== animationId)
        : [...current, animationId]
    )
  }
  const downloadAvatarExport = () => {
    if (!selectedExportAnimations.length) return
    const payload = createAvatarExportPayload(activeAvatar, expressions, selectedExportAnimations)
    const isReact = exportFormat === 'react'
    const extension = isReact ? 'tsx' : 'zip'
    const blob = isReact
      ? new Blob([generateReactAvatarComponent(payload)], { type: 'text/typescript' })
      : generateJavaScriptAvatarPackage(payload)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = avatarExportFileName(activeAvatar.name, extension)
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  const canvasExpression = editing?.draft ?? expression
  const editorPageOpen = bodyEditing || editing !== null || sequenceEditing !== null

  useEffect(() => {
    if (!editorPageOpen || focusAvatarName) return
    const frame = requestAnimationFrame(() => workspaceBackButtonRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [editorPageOpen, focusAvatarName])

  const updateAvatarEyeDimension = (side: Side, dimension: 'width' | 'height', value: number) => {
    const next = updateEyeDimension(
      { ...defaultExpression, ...activeAvatarEyes },
      side,
      dimension,
      value,
      linked[dimension]
    )
    updateAvatarEyes({
      [`${dimension}Left`]: next[`${dimension}Left`],
      [`${dimension}Right`]: next[`${dimension}Right`],
    })
  }
  const updateAvatarEyeSize = (side: Side, value: number) => {
    const next = scaleEye({ ...defaultExpression, ...activeAvatarEyes }, side, value, linked.size)
    updateAvatarEyes({
      widthLeft: next.widthLeft,
      widthRight: next.widthRight,
      heightLeft: next.heightLeft,
      heightRight: next.heightRight,
    })
  }
  const updateAvatarEyePosition = (side: Side, axis: 'X' | 'Y', value: number) => {
    const next = updateEyePosition(
      { ...defaultExpression, ...activeAvatarEyes },
      side,
      axis,
      value,
      linked.position
    )
    updateAvatarEyes({
      [`position${axis}Left`]: next[`position${axis}Left`],
      [`position${axis}Right`]: next[`position${axis}Right`],
    })
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
      <motion.section
        className="stage-column"
        style={
          {
            '--avatar-body-color': renderedColors.body,
            '--avatar-eye-color': renderedColors.eyes,
          } as CSSProperties
        }
      >
        <div className="brand">
          <span className="brand-mark" />
          Bible Strong <em>Avatar Lab</em>
        </div>
        <div className="language-picker">
          <span aria-hidden="true">{language === 'en' ? '🇬🇧' : '🇫🇷'}</span>
          <Select
            value={language}
            items={[
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
            ]}
            onValueChange={next => next && setLanguage(next as StudioLanguage)}
          >
            <SelectTrigger aria-label={t('Langue de l’interface')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AvatarCanvas
          expression={canvasExpression}
          avatarEyes={activeAvatarEyes}
          surface={surface}
          scene={renderedScene}
          showWire={showWire}
          bodyEditing={bodyEditing}
          selectedBodyNodeId={selectedBodyNodeId}
          selectedBodyNode={selectedBodyNode}
          selectedSide={selectedEyeSide}
          linked={linked}
          highlight={highlight}
          onHighlightChange={updateHighlight}
          onBodyNodeSelect={selectBodyNode}
          onBodyNodePreview={previewSelectedBodyNode}
          onBodyNodeChange={commitBodyNode}
          onEyeSelect={setSelectedEyeSide}
          onPreview={previewCanvasExpression}
          onChange={editing ? previewExpressionDraft : updateImmediate}
          onReset={next => {
            if (editing) {
              setEditing(current => (current ? { ...current, draft: next } : current))
            }
            transitionToExpression(next)
          }}
          onEyeChange={
            editing ? previewExpressionDraft : bodyEditing ? persistEditedEyeExpression : undefined
          }
        />
        <p className="stage-help">
          {t(
            'Glisse sur la surface pour orienter la tête. Les anneaux du gizmo contrôlent X, Y et Z.'
          )}
        </p>
      </motion.section>

      <main
        className={`inspector ${editing ? 'expression-workspace-active' : sequenceEditing ? 'sequence-workspace-active' : bodyEditing ? 'body-workspace' : 'studio-workspace'}${activeSequence && !editorPageOpen ? ' state-player-active' : ''}`}
      >
        {sequenceEditing && !editing && (
          <motion.div
            key={`sequence-${sequenceEditing.sourceId ?? 'new'}`}
            className="workspace-page sequence-workspace"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <SequenceWorkspace
              editing={sequenceEditing}
              expressions={expressions}
              surface={surface}
              bodyNodes={bodyNodes}
              colors={activeAvatar.colors}
              avatarEyes={activeAvatarEyes}
              selectedStepId={selectedSequenceStepId}
              backButtonRef={workspaceBackButtonRef}
              reduceMotion={Boolean(reduceMotion)}
              onSelectedStepChange={setSelectedSequenceStepId}
              onChange={draft =>
                setSequenceEditing(current => (current ? { ...current, draft } : current))
              }
              onPreviewStep={step => {
                const expressionIndex = findExpressionIndex(expressions, step.expressionId)
                const preset = expressions[expressionIndex]
                if (preset) transitionToExpression(preset, expressionIndex, step)
              }}
              onEditExpression={openExpressionEditor}
              onPlay={() => launchSequence(sequenceEditing.draft, false, false)}
              onPause={() => pauseState(false)}
              onStop={() => stopState(false)}
              playing={statePlaying}
              active={activeState === sequenceEditing.draft.id}
              onCancel={cancelSequenceEditing}
              onSave={saveSequenceEditing}
              onDuplicate={duplicateSequenceEditing}
              onDelete={() => setDeleteSequenceOpen(true)}
            />
          </motion.div>
        )}
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
              onDuplicate={() => duplicateExpression(editing.index, editing.draft, true)}
              onDelete={() => setDeleteExpressionOpen(true)}
            />
          </motion.div>
        )}
        {!sequenceEditing &&
          !editing &&
          (bodyEditing ? (
            <header className="workspace-header body-workspace-header">
              <Button
                ref={workspaceBackButtonRef}
                variant="ghost"
                size="icon"
                onClick={cancelAvatarEditing}
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
            </header>
          ) : (
            <>
              <header className="inspector-header">
                <h1>Avatar Studio</h1>
              </header>
              <section className="avatar-shelf" aria-label={t('Choisir un avatar')}>
                <div className="avatar-shelf-heading">
                  <strong>Avatars</strong>
                  <span>{t('Double-clic pour modifier')}</span>
                </div>
                <div className="avatar-grid">
                  {avatars.map(avatar => (
                    <motion.div
                      className="avatar-sort-item"
                      data-dragging={draggingAvatarId === avatar.id || undefined}
                      key={avatar.id}
                      layout="position"
                      animate={{
                        opacity: draggingAvatarId === avatar.id ? 0.28 : 1,
                        scale: draggingAvatarId === avatar.id ? 0.96 : 1,
                      }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }
                      }
                    >
                      <ContextMenu>
                        <ContextMenuTrigger
                          render={
                            <Button
                              className="avatar-card"
                              variant="outline"
                              aria-pressed={activeAvatarId === avatar.id}
                              type="button"
                              draggable
                              onDragStart={event => {
                                avatarDragOrigin.current = avatarsRef.current
                                avatarDragPreview.current = avatarsRef.current
                                draggedAvatarId.current = avatar.id
                                setDraggingAvatarId(avatar.id)
                                event.dataTransfer.effectAllowed = 'move'
                              }}
                              onDragEnter={() => previewAvatarMove(avatar.id)}
                              onDragOver={event => {
                                event.preventDefault()
                                event.dataTransfer.dropEffect = 'move'
                              }}
                              onDrop={event => {
                                event.preventDefault()
                                commitAvatarMove(avatar.id)
                              }}
                              onDragEnd={cancelAvatarMove}
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
                          }
                        />
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() => {
                              setFocusAvatarName(false)
                              activateAvatar(avatar.id, true)
                            }}
                          >
                            <Pencil /> {t('Modifier')}
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => duplicateAvatar(avatar)}>
                            <Copy /> {t('Dupliquer')}
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            variant="destructive"
                            disabled={avatars.length <= 1}
                            onClick={() => {
                              activateAvatar(avatar.id, false, true)
                              setDeleteAvatarOpen(true)
                            }}
                          >
                            <Trash2 /> {t('Supprimer')}
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </motion.div>
                  ))}
                  <Button
                    variant="outline"
                    className="avatar-add creation-card"
                    onClick={createNewAvatar}
                    aria-label={t('Nouvel avatar')}
                  >
                    <Plus />
                  </Button>
                </div>
              </section>
              <Tabs value={mode} onValueChange={value => setMode(value as Mode)}>
                <TabsList className="tabs" aria-label={t('Mode d’édition')}>
                  <TabsTrigger value="manual">{t('Pose')}</TabsTrigger>
                  <TabsTrigger value="expressions">{t('Expressions')}</TabsTrigger>
                  <TabsTrigger value="states">{t('Animations')}</TabsTrigger>
                  <TabsTrigger value="export">{t('Exporter')}</TabsTrigger>
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
                        <span className="body-node-icon body-node-icon-primary">
                          <SurfaceThumbnail surface={surface} />
                        </span>
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
                          <span className="body-node-icon">
                            <SurfaceThumbnail surface={node.surface} />
                          </span>
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
                            className="surface-card body-add-card"
                            variant="outline"
                            type="button"
                            key={type}
                            disabled={bodyNodes.length >= MAX_BODY_NODES}
                            onClick={() => addBodyNode(type)}
                          >
                            <SurfaceThumbnail surface={surfacePresets[type]} />
                            <span>{t(surfaceLabels[type])}</span>
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
                          <NumericField
                            label="Échelle"
                            value={Math.max(
                              selectedBodyNode.surface.width,
                              selectedBodyNode.surface.height,
                              selectedBodyNode.surface.depth
                            )}
                            min={10}
                            max={300}
                            unit="u"
                            onChange={size =>
                              updateSelectedBodyNode(node => ({
                                ...node,
                                surface: scaleSurface(node.surface, size, {
                                  width: 10,
                                  height: 10,
                                  depth: 10,
                                }),
                              }))
                            }
                          />
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
                        label="Échelle"
                        value={Math.max(surface.width, surface.height, surface.depth)}
                        min={120}
                        max={300}
                        unit="u"
                        onChange={size =>
                          updateSurface(
                            scaleSurface(surface, size, { width: 120, height: 120, depth: 100 })
                          )
                        }
                      />
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
                        size="icon-sm"
                        aria-label={t('Reprendre la couleur de l’avatar')}
                        onClick={() => {
                          const next = { ...expression }
                          delete next.bodyColor
                          updateImmediate(next)
                        }}
                      >
                        <RotateCcw />
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
                        size="icon-sm"
                        aria-label={t('Reprendre la couleur de l’avatar')}
                        onClick={() => {
                          const next = { ...expression }
                          delete next.eyeColor
                          updateImmediate(next)
                        }}
                      >
                        <RotateCcw />
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
                    <div className="panel-inline-title">
                      <PanelTitle
                        level={3}
                        title="Rotation locale"
                        subtitle="Inclinaison propre à chaque œil."
                      />
                      <LinkButton
                        linked={linked.rotation}
                        label="Lier les rotations"
                        onClick={() =>
                          setLinked(current => ({ ...current, rotation: !current.rotation }))
                        }
                      />
                    </div>
                    <div className="eye-columns">
                      <NumericField
                        label="Œil gauche"
                        value={expression.leftAngle}
                        unit="°"
                        onActiveChange={active =>
                          updateHighlight(active ? (linked.rotation ? 'both' : 'left') : null)
                        }
                        onChange={value =>
                          updateImmediate({
                            ...expression,
                            leftAngle: value,
                            ...(linked.rotation ? { rightAngle: -value } : {}),
                          })
                        }
                      />
                      <NumericField
                        label="Œil droit"
                        value={expression.rightAngle}
                        unit="°"
                        onActiveChange={active =>
                          updateHighlight(active ? (linked.rotation ? 'both' : 'right') : null)
                        }
                        onChange={value =>
                          updateImmediate({
                            ...expression,
                            rightAngle: value,
                            ...(linked.rotation ? { leftAngle: -value } : {}),
                          })
                        }
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

        {!sequenceEditing && !editing && bodyEditing && (
          <footer className="workspace-footer">
            <div className="workspace-footer-secondary">
              <Button
                variant="destructive"
                disabled={avatars.length <= 1}
                onClick={() => setDeleteAvatarOpen(true)}
              >
                <Trash2 />
                {t('Supprimer')}
              </Button>
              <Button variant="outline" onClick={() => duplicateAvatar(activeAvatar, true)}>
                <Copy />
                {t('Dupliquer')}
              </Button>
            </div>
            <Button onClick={saveAvatarEditing}>{t('Enregistrer')}</Button>
          </footer>
        )}

        {!sequenceEditing && !editing && !bodyEditing && mode === 'expressions' && (
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
                  <motion.div
                    className="expression-sort-item"
                    data-dragging={draggingExpressionId === preset.id || undefined}
                    key={preset.id}
                    layout="position"
                    layoutId={`expression-${preset.id}`}
                    animate={{
                      opacity: draggingExpressionId === preset.id ? 0.28 : 1,
                      scale: draggingExpressionId === preset.id ? 0.96 : 1,
                    }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }
                    }
                  >
                    <ExpressionCard
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
                      onDuplicate={() => duplicateExpression(index, preset)}
                      onDelete={() => {
                        openExpressionEditor(index, preset)
                        setDeleteExpressionOpen(true)
                      }}
                      draggable
                      onDragStart={event => {
                        expressionDragOrigin.current = expressions
                        expressionDragPreview.current = expressions
                        draggedExpressionId.current = preset.id
                        setDraggingExpressionId(preset.id)
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnter={() => previewExpressionMove(preset.id)}
                      onDragOver={event => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={event => {
                        event.preventDefault()
                        commitExpressionMove(preset.id)
                      }}
                      onDragEnd={cancelExpressionMove}
                    />
                  </motion.div>
                ))}
                <Button
                  className="expression-add creation-card"
                  variant="outline"
                  type="button"
                  onDragOver={event => event.preventDefault()}
                  onDrop={event => {
                    event.preventDefault()
                    commitExpressionMove(null)
                  }}
                  onClick={() => openExpressionEditor(null, expression)}
                  aria-label={t('Nouvelle expression')}
                >
                  <Plus />
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
                <Button variant="outline" type="button" onClick={() => blink()}>
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

        {!sequenceEditing && !editing && !bodyEditing && mode === 'states' && (
          <div className="panel-stack">
            <InspectorCard>
              <div className="preset-header">
                <div>
                  <p className="eyebrow">
                    {sequences.length} {t('animations')}
                  </p>
                  <h2>{t('Animations')}</h2>
                </div>
              </div>
              <div className="state-groups">
                {groupSequences(sequences).map(group => (
                  <div
                    key={group.name}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => {
                      event.preventDefault()
                      commitStateMove(null, group.name)
                    }}
                  >
                    <strong>
                      {group.sequences.every(sequence => sequence.builtIn)
                        ? t(group.name)
                        : group.name}
                    </strong>
                    <div className="state-buttons">
                      {group.sequences.map(sequence => {
                        const firstStep = sequence.steps[0]
                        const firstExpression = firstStep
                          ? expressionById.get(firstStep.expressionId)
                          : undefined
                        const card = (
                          <Button
                            className="expression-card state-card"
                            variant="outline"
                            type="button"
                            draggable
                            aria-pressed={selectedState === sequence.id}
                            onDragStart={event => {
                              stateDragOrigin.current = sequences
                              stateDragPreview.current = sequences
                              draggedStateId.current = sequence.id
                              setDraggingStateId(sequence.id)
                              event.dataTransfer.effectAllowed = 'move'
                            }}
                            onDragEnter={() => previewStateMove(sequence.id, group.name)}
                            onDragOver={event => {
                              event.preventDefault()
                              event.stopPropagation()
                              event.dataTransfer.dropEffect = 'move'
                            }}
                            onDrop={event => {
                              event.preventDefault()
                              event.stopPropagation()
                              commitStateMove(sequence.id, group.name)
                            }}
                            onDragEnd={cancelStateMove}
                            onClick={() => launchSequence(sequence)}
                            onDoubleClick={() => openSequenceEditor(sequence)}
                          >
                            <ExpressionPreview
                              expression={firstExpression ?? expressions[0] ?? defaultExpression}
                              surface={surface}
                              bodyNodes={bodyNodes}
                              colors={activeAvatar.colors}
                              avatarEyes={activeAvatarEyes}
                              id={`state-card-${sequence.id}`}
                            />
                            <span>{sequence.builtIn ? t(sequence.name) : sequence.name}</span>
                          </Button>
                        )
                        return (
                          <motion.div
                            className="state-sort-item"
                            data-dragging={draggingStateId === sequence.id || undefined}
                            key={sequence.id}
                            layout="position"
                            layoutId={`state-${sequence.id}`}
                            animate={{
                              opacity: draggingStateId === sequence.id ? 0.28 : 1,
                              scale: draggingStateId === sequence.id ? 0.96 : 1,
                            }}
                            transition={
                              reduceMotion
                                ? { duration: 0 }
                                : { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 }
                            }
                          >
                            <ContextMenu>
                              <ContextMenuTrigger render={card} />
                              <ContextMenuContent>
                                <ContextMenuItem onClick={() => openSequenceEditor(sequence)}>
                                  <Pencil />
                                  {t('Modifier')}
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => duplicateState(sequence)}>
                                  <Copy />
                                  {t('Dupliquer')}
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    openSequenceEditor(sequence)
                                    setDeleteSequenceOpen(true)
                                  }}
                                >
                                  <Trash2 />
                                  {t('Supprimer')}
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <div className="state-buttons">
                  <Button
                    className="expression-add creation-card"
                    variant="outline"
                    type="button"
                    onClick={() => openSequenceEditor()}
                    aria-label={t('Nouvelle animation')}
                  >
                    <Plus />
                  </Button>
                </div>
              </div>
            </InspectorCard>
          </div>
        )}

        {!sequenceEditing && !editing && !bodyEditing && mode === 'export' && (
          <div className="panel-stack export-panel">
            <InspectorCard>
              <PanelTitle
                title="Exporter l’avatar"
                subtitle="Télécharge un composant autonome avec les animations de ton choix."
              />
              <div className="export-avatar-summary">
                <ExpressionPreview
                  expression={expressions[0] ?? defaultExpression}
                  surface={activeAvatar.body.primary}
                  bodyNodes={activeAvatar.body.nodes}
                  colors={activeAvatar.colors}
                  avatarEyes={activeAvatarEyes}
                  id={`export-avatar-${activeAvatar.id}`}
                />
                <div>
                  <small>{t('Avatar sélectionné')}</small>
                  <strong>{activeAvatar.name}</strong>
                </div>
              </div>
            </InspectorCard>

            <InspectorCard>
              <PanelTitle
                title="Format"
                subtitle="Choisis l’intégration correspondant à ton projet."
              />
              <div className="export-format-grid">
                <Button
                  variant="outline"
                  type="button"
                  aria-pressed={exportFormat === 'react'}
                  onClick={() => setExportFormat('react')}
                >
                  <FileCode2 />
                  <span>
                    <strong>React / TypeScript</strong>
                    <small>{t('Composant TSX autonome')}</small>
                  </span>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  aria-pressed={exportFormat === 'javascript'}
                  onClick={() => setExportFormat('javascript')}
                >
                  <FileCode2 />
                  <span>
                    <strong>{t('Module JavaScript')}</strong>
                    <small>{t('Projet HTML + module JS (.zip)')}</small>
                  </span>
                </Button>
              </div>
            </InspectorCard>

            <InspectorCard>
              <div className="preset-header export-animation-header">
                <div>
                  <p className="eyebrow">
                    {selectedExportAnimations.length}/{sequences.length} {t('sélectionnées')}
                  </p>
                  <h2>{t('Animations à exporter')}</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() =>
                    setExportAnimationIds(
                      selectedExportAnimations.length === sequences.length
                        ? []
                        : sequences.map(animation => animation.id)
                    )
                  }
                >
                  {t(
                    selectedExportAnimations.length === sequences.length
                      ? 'Tout désélectionner'
                      : 'Tout sélectionner'
                  )}
                </Button>
              </div>
              <div className="state-buttons export-animation-grid">
                {sequences.map(animation => {
                  const firstStep = animation.steps[0]
                  const firstExpression = firstStep
                    ? expressionById.get(firstStep.expressionId)
                    : undefined
                  return (
                    <Button
                      className="expression-card state-card"
                      variant="outline"
                      type="button"
                      key={animation.id}
                      aria-pressed={exportAnimationIdSet.has(animation.id)}
                      onClick={() => toggleExportAnimation(animation.id)}
                    >
                      <ExpressionPreview
                        expression={firstExpression ?? expressions[0] ?? defaultExpression}
                        surface={surface}
                        bodyNodes={bodyNodes}
                        colors={activeAvatar.colors}
                        avatarEyes={activeAvatarEyes}
                        id={`export-animation-${animation.id}`}
                      />
                      <span>{animation.builtIn ? t(animation.name) : animation.name}</span>
                    </Button>
                  )
                })}
              </div>
            </InspectorCard>

            <Button
              className="export-download"
              type="button"
              disabled={!selectedExportAnimations.length}
              onClick={downloadAvatarExport}
            >
              <Download />
              {t(
                exportFormat === 'react' ? 'Télécharger le composant TSX' : 'Télécharger le module'
              )}
            </Button>
          </div>
        )}
        {activeSequence && !editorPageOpen && (
          <motion.footer
            className={`state-playback-footer${statePlayerExpanded ? ' is-expanded' : ''}`}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              className="state-playback-expand"
              variant="outline"
              size="icon-sm"
              type="button"
              aria-expanded={statePlayerExpanded}
              aria-label={t(
                statePlayerExpanded
                  ? 'Masquer les détails de l’animation'
                  : 'Afficher les détails de l’animation'
              )}
              onClick={() => setStatePlayerExpanded(expanded => !expanded)}
            >
              {statePlayerExpanded ? <ChevronDown /> : <ChevronUp />}
            </Button>
            {statePlayerExpanded && (
              <motion.div
                className="state-playback-details"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="state-playback-details-header">
                  <div>
                    <p className="eyebrow">{t('Détails de l’animation')}</p>
                    <h2>{activeSequenceLabel}</h2>
                    <p>
                      {activeSequence.builtIn
                        ? t(activeSequence.description)
                        : activeSequence.description}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {t('Mode de lecture')} · {t(activeSequence.playbackMode)}
                  </Badge>
                </div>
                <div className="state-playback-detail-grid">
                  <div>
                    <span>{t('Expressions')}</span>
                    <strong>{activeSequence.steps.length}</strong>
                    <small>
                      {activeSequence.steps
                        .map(step => formatSeconds(step.holdMs, language))
                        .join(' · ')}
                    </small>
                  </div>
                  <div>
                    <span>{t('Premier clignement')}</span>
                    <strong>
                      {activeSequence.blink.enabled
                        ? formatSeconds(activeSequence.blink.initialDelayMs, language)
                        : t('Désactivé')}
                    </strong>
                    <small>{t('après le lancement')}</small>
                  </div>
                  <div>
                    <span>{t('Intervalle du clignement')}</span>
                    <strong>
                      {formatSeconds(activeSequence.blink.minIntervalMs, language)}–
                      {formatSeconds(activeSequence.blink.maxIntervalMs, language)}
                    </strong>
                    <small>{t('tirage aléatoire')}</small>
                  </div>
                  <div>
                    <span>{t('Durée du clignement')}</span>
                    <strong>{activeSequence.blink.durationMs} ms</strong>
                    <small>{t('fermeture et ouverture')}</small>
                  </div>
                </div>
              </motion.div>
            )}
            <div className="state-playback-bar">
              <div className="state-playback-timeline">
                {activeSequence.steps.map((step, position) => {
                  const expressionIndex = findExpressionIndex(expressions, step.expressionId)
                  const preset = expressions[expressionIndex]
                  if (!preset) return null
                  return (
                    <Button
                      className="state-playback-step"
                      variant="outline"
                      type="button"
                      key={step.id}
                      aria-pressed={activeExpression === expressionIndex}
                      onClick={() => transitionToExpression(preset, expressionIndex, step)}
                    >
                      <ExpressionPreview
                        expression={preset}
                        surface={surface}
                        bodyNodes={bodyNodes}
                        colors={activeAvatar.colors}
                        avatarEyes={activeAvatarEyes}
                        id={`player-${activeSequence.id}-${position}`}
                      />
                      {playbackVisual.position === position && (
                        <span
                          className="state-playback-progress"
                          key={`${step.id}-${playbackVisual.run}`}
                          aria-hidden="true"
                          style={
                            {
                              animationDuration: `${Math.max(playbackVisual.durationMs, 1)}ms`,
                              animationPlayState: statePlaying ? 'running' : 'paused',
                            } as CSSProperties
                          }
                        />
                      )}
                    </Button>
                  )
                })}
              </div>
              <div className="state-playback-controls">
                <StatePlayer
                  name={activeSequenceLabel}
                  playing={statePlaying}
                  onToggle={toggleStatePlayback}
                  onStop={stopState}
                />
              </div>
            </div>
          </motion.footer>
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
      <AlertDialog open={deleteSequenceOpen} onOpenChange={setDeleteSequenceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Supprimer cette animation ?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Cette action supprimera définitivement cette animation.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Annuler')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSequenceEditing}>{t('Supprimer')}</AlertDialogAction>
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
    <div className="state-player" aria-label={t(`Animation en cours : ${name}`)}>
      <span className={playing ? 'is-playing' : 'is-paused'}>
        <i />
        <span>
          <small>{t(playing ? 'En lecture' : 'En pause')}</small>
          <strong>{name}</strong>
        </span>
      </span>
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label={t(playing ? `Mettre ${name} en pause` : `Reprendre ${name}`)}
        onClick={onToggle}
      >
        {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t(`Arrêter ${name}`)} onClick={onStop}>
        <Square fill="currentColor" />
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
