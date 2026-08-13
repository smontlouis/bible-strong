import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react'
import { motionValue, type MotionValue } from 'motion'
import { useEffect, useRef, useState } from 'react'

import {
  bodyPrimitiveTypes,
  createBodyNode,
  duplicateBodyNode,
  MAX_BODY_NODES,
  type BodyNode,
} from './body'
import {
  createAvatar,
  loadAvatarLibrary,
  loadGlobalExpressions,
  persistAvatarLibrary,
  persistGlobalExpressions,
  type StudioAvatar,
} from './avatars'
import {
  expressionFields,
  poseFromExpression,
  renderAvatar,
  renderEyeEditor,
  rotateExpressionAroundAxis,
  rotateExpressionAroundCamera,
  rotateExpressionWithArcball,
  rotationRing,
  type AvatarPose,
  type Expression,
  type Point3,
} from './geometry'
import { defaultExpression, stateGroups, stateNotes, statePools } from './presets'
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
  WeakMap<SurfaceConfig, WeakMap<BodyNode[], ReturnType<typeof renderAvatar>>>
>()

const getPreviewGeometry = (
  expression: Expression,
  surface: SurfaceConfig,
  bodyNodes: BodyNode[]
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
  const cached = bodyCache.get(bodyNodes)
  if (cached) return cached
  const geometry = renderAvatar(poseFromExpression(expression), surface, 1, {
    includeWire: false,
    bodyNodes,
  })
  bodyCache.set(bodyNodes, geometry)
  return geometry
}

const bounded = (value: number, min?: number, max?: number) =>
  Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value))

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
    <div className="numeric-field">
      <button
        className="scrub-label"
        type="button"
        title="Glisser horizontalement pour modifier"
        onPointerDown={startScrub}
        onPointerMove={scrub}
        onPointerUp={stopScrub}
        onPointerCancel={stopScrub}
      >
        <span>{label}</span>
        <span className="scrub-icon" aria-hidden="true">
          ↔
        </span>
      </button>
      <label className="number-shell">
        <input
          type="number"
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
    </div>
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
  return (
    <button
      type="button"
      className="link-button"
      aria-pressed={linked}
      aria-label={label}
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" />
      </svg>
    </button>
  )
}

function RotationGizmo({
  expression,
  onChange,
  onActiveChange,
}: {
  expression: Expression
  onChange: (next: Expression) => void
  onActiveChange: (active: boolean) => void
}) {
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
    <svg className="gizmo" viewBox="-43 -43 86 86" aria-label="Gizmo de rotation">
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
  )
}

function AvatarCanvas({
  expression,
  surface,
  wirePaths,
  showWire,
  backPaths,
  frontPaths,
  backNodeIds,
  frontNodeIds,
  bodyEditing,
  headPath,
  leftPath,
  rightPath,
  leftOpacity,
  rightOpacity,
  linked,
  highlight,
  onHighlightChange,
  onBodyNodeSelect,
  onChange,
}: {
  expression: Expression
  surface: SurfaceConfig
  wirePaths: MotionValue<string>[]
  showWire: boolean
  backPaths: MotionValue<string>[]
  frontPaths: MotionValue<string>[]
  backNodeIds: { current: Array<string | null> }
  frontNodeIds: { current: Array<string | null> }
  bodyEditing: boolean
  headPath: MotionValue<string>
  leftPath: MotionValue<string>
  rightPath: MotionValue<string>
  leftOpacity: MotionValue<number>
  rightOpacity: MotionValue<number>
  linked: { width: boolean; height: boolean; size: boolean }
  highlight: Highlight
  onHighlightChange: (highlight: Highlight) => void
  onBodyNodeSelect: (id: 'primary' | string) => void
  onChange: (next: Expression) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedSide, setSelectedSide] = useState<-1 | 1 | null>(null)
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
      : renderEyeEditor(poseFromExpression(expression), surface, selectedSide)
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
    setSelectedSide(null)
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
    setSelectedSide(null)
    onBodyNodeSelect(nodeId)
  }
  const selectEye = (side: -1 | 1, event: React.PointerEvent<SVGPathElement>) => {
    event.stopPropagation()
    setSelectedSide(side)
  }
  const startHandle = (
    type: 'width' | 'height' | 'size' | 'spacing' | 'rotate',
    event: React.PointerEvent<SVGElement>
  ) => {
    event.stopPropagation()
    if (selectedSide === null || !editor) return
    onHighlightChange(selectedSide < 0 ? 'left' : 'right')
    const point = toSvg(event)
    const leftEditor = renderEyeEditor(poseFromExpression(expression), surface, -1)
    const rightEditor = renderEyeEditor(poseFromExpression(expression), surface, 1)
    drag.current = {
      type,
      side: selectedSide,
      startPoint: point,
      expression,
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
    onChange(next)
  }
  return (
    <div className="avatar-wrap">
      <svg
        ref={svgRef}
        className="avatar"
        viewBox="-150 -150 300 300"
        role="img"
        aria-label="Avatar procédural"
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
            className={`avatar-eye ${highlight === 'left' || highlight === 'both' ? 'cyan-outline' : ''}`}
            d={leftPath}
            opacity={leftOpacity}
            onPointerDown={event => selectEye(-1, event)}
          />
          <motion.path
            className={`avatar-eye ${highlight === 'right' || highlight === 'both' ? 'cyan-outline' : ''}`}
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
  id,
}: {
  expression: Expression
  surface: SurfaceConfig
  bodyNodes: BodyNode[]
  id: string
}) {
  const geometry = getPreviewGeometry(expression, surface, bodyNodes)
  const clipId = `preview-${id}`
  return (
    <svg viewBox="-150 -150 300 300" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={geometry.headPath} />
        </clipPath>
      </defs>
      {geometry.backPaths.map((pathValue, index) => (
        <path className="preview-head" d={pathValue} key={index} />
      ))}
      <path className="preview-head" d={geometry.headPath} />
      <g clipPath={`url(#${clipId})`}>
        <path
          className="preview-eye"
          d={geometry.leftPath}
          opacity={geometry.leftVisible ? 1 : 0}
        />
        <path
          className="preview-eye"
          d={geometry.rightPath}
          opacity={geometry.rightVisible ? 1 : 0}
        />
      </g>
      {geometry.frontPaths.map((pathValue, index) => (
        <path className="preview-head" d={pathValue} key={`front-${index}`} />
      ))}
    </svg>
  )
}

function ExpressionDialog({
  editing,
  surface,
  bodyNodes,
  onChange,
  onCancel,
  onSave,
  onDelete,
}: {
  editing: { index: number | null; draft: Expression }
  surface: SurfaceConfig
  bodyNodes: BodyNode[]
  onChange: (draft: Expression) => void
  onCancel: () => void
  onSave: () => void
  onDelete: () => void
}) {
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
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <motion.section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      >
        <header className="dialog-header">
          <div>
            <p className="eyebrow">Preset en mémoire</p>
            <h2 id="dialog-title">
              {editing.index === null
                ? 'Nouvelle expression'
                : `Modifier l’expression ${String(editing.index).padStart(2, '0')}`}
            </h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Fermer">
            ×
          </button>
        </header>
        <div className="dialog-body">
          <aside className="dialog-preview">
            <ExpressionPreview
              expression={editing.draft}
              surface={surface}
              bodyNodes={bodyNodes}
              id="dialog"
            />
            <strong>Aperçu en direct</strong>
            <span>Projection sur la forme active</span>
          </aside>
          <div className="dialog-fields">
            <section className="dialog-group">
              <h3>Rotation de la tête</h3>
              {(['headX', 'headY', 'headZ'] as const).map(field => (
                <NumericField
                  key={field}
                  label={`Rotation ${field.at(-1)?.toUpperCase()}`}
                  value={editing.draft[field]}
                  unit="°"
                  onChange={value => update({ [field]: value })}
                />
              ))}
            </section>
            {(['width', 'height', 'size'] as const).map(dimension => (
              <section className="dialog-group" key={dimension}>
                <div className="panel-inline-title">
                  <h3>
                    {
                      { width: 'Largeur', height: 'Hauteur', size: 'Taille proportionnelle' }[
                        dimension
                      ]
                    }
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
              </section>
            ))}
            <section className="dialog-group">
              <h3>Position des yeux</h3>
              <div className="eye-columns">
                {(['Left', 'Right'] as Side[]).map(side => (
                  <div className="eye-column" key={side}>
                    <h3>{side === 'Left' ? 'Œil gauche' : 'Œil droit'}</h3>
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
            </section>
            <section className="dialog-group">
              <h3>Rotation locale</h3>
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
            </section>
            <section className="dialog-group">
              <h3>Disposition générale</h3>
              <NumericField
                label="Espacement"
                value={editing.draft.spacing}
                min={0}
                max={150}
                unit="u"
                onChange={value => update({ spacing: value })}
              />
            </section>
            <section className="dialog-group">
              <h3>Projection</h3>
              <NumericField
                label="Perspective"
                value={editing.draft.perspective}
                step={0.01}
                unit="×"
                onChange={value => update({ perspective: value })}
              />
            </section>
          </div>
        </div>
        <footer className="dialog-actions">
          {editing.index !== null && (
            <button className="danger" type="button" onClick={onDelete}>
              Supprimer
            </button>
          )}
          <div className="dialog-actions-main">
            <button type="button" onClick={onCancel}>
              Annuler
            </button>
            <button className="primary" type="button" onClick={onSave}>
              Enregistrer
            </button>
          </div>
        </footer>
      </motion.section>
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState<Mode>('manual')
  const [initialLibrary] = useState(loadAvatarLibrary)
  const [avatars, setAvatars] = useState(initialLibrary.avatars)
  const [activeAvatarId, setActiveAvatarId] = useState(initialLibrary.activeAvatarId)
  const initialAvatar =
    initialLibrary.avatars.find(avatar => avatar.id === initialLibrary.activeAvatarId) ??
    initialLibrary.avatars[0]
  const [surface, setSurface] = useState(initialAvatar.body.primary)
  const [bodyNodes, setBodyNodes] = useState(initialAvatar.body.nodes)
  const [selectedBodyNodeId, setSelectedBodyNodeId] = useState<'primary' | string>('primary')
  const [expressions, setExpressions] = useState(loadGlobalExpressions)
  const [bodyEditing, setBodyEditing] = useState(false)
  const [creatingAvatar, setCreatingAvatar] = useState(false)
  const [newAvatarName, setNewAvatarName] = useState('')
  const [expression, setExpression] = useState<Expression>({ ...defaultExpression })
  const [activeExpression, setActiveExpression] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ index: number | null; draft: Expression } | null>(null)
  const [showWire, setShowWire] = useState(false)
  const [springSpeed, setSpringSpeed] = useState(7)
  const [linked, setLinked] = useState({ width: true, height: true, size: true })
  const [highlight, setHighlight] = useState<Highlight>(null)
  const [selectedState, setSelectedState] = useState('idle')
  const [activeState, setActiveState] = useState<string | null>(null)
  const stateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
      geometry: renderAvatar(pose, surface, 1, { bodyNodes }),
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
        keyof Expression,
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
    const geometry = renderAvatar(pose, surfaceRef.current, blink ?? blinkValue.get(), {
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
    setActiveExpression(null)
    paintPose(pose)
  }

  const transitionToExpression = (next: Expression, index: number | null = null) => {
    setActiveExpression(index)
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
    blinkControls.current = animate(blinkValue, [1, 0, 1], {
      duration: reduceMotion ? 0 : 0.28,
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

  const activateAvatar = (id: string, editBody = false) => {
    const avatar = avatarsRef.current.find(item => item.id === id)
    if (!avatar) return
    stopTransition(true)
    stopState()
    activeAvatarIdRef.current = id
    surfaceRef.current = avatar.body.primary
    bodyNodesRef.current = avatar.body.nodes
    setActiveAvatarId(id)
    setSurface(avatar.body.primary)
    setBodyNodes(avatar.body.nodes)
    setSelectedBodyNodeId('primary')
    setActiveExpression(null)
    setBodyEditing(editBody)
    setMode('manual')
    const neutral = { ...defaultExpression }
    setExpression(neutral)
    canonicalTarget.current = neutral
    transitionTarget.current = neutral
    paintPose(poseFromExpression(neutral))
    persistAvatarLibrary({ activeAvatarId: id, avatars: avatarsRef.current })
  }

  const submitNewAvatar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const avatar = createAvatar(newAvatarName)
    const next = [...avatarsRef.current, avatar]
    avatarsRef.current = next
    setAvatars(next)
    setCreatingAvatar(false)
    setNewAvatarName('')
    persistAvatarLibrary({ activeAvatarId: avatar.id, avatars: next })
    activateAvatar(avatar.id, true)
  }

  const addBodyNode = (type: (typeof bodyPrimitiveTypes)[number]) => {
    if (bodyNodesRef.current.length >= MAX_BODY_NODES) return
    const node = createBodyNode(type, bodyNodesRef.current.length)
    updateBodyNodes([...bodyNodesRef.current, node])
    setSelectedBodyNodeId(node.id)
  }

  const updateSelectedBodyNode = (update: (node: BodyNode) => BodyNode) => {
    if (selectedBodyNodeId === 'primary') return
    updateBodyNodes(
      bodyNodesRef.current.map(node => (node.id === selectedBodyNodeId ? update(node) : node))
    )
  }

  const deleteSelectedBodyNode = () => {
    if (selectedBodyNodeId === 'primary') return
    updateBodyNodes(bodyNodesRef.current.filter(node => node.id !== selectedBodyNodeId))
    setSelectedBodyNodeId('primary')
  }

  const duplicateSelectedBodyNode = () => {
    if (selectedBodyNodeId === 'primary' || bodyNodesRef.current.length >= MAX_BODY_NODES) return
    const source = bodyNodesRef.current.find(node => node.id === selectedBodyNodeId)
    if (!source) return
    const duplicate = duplicateBodyNode(source)
    updateBodyNodes([...bodyNodesRef.current, duplicate])
    setSelectedBodyNodeId(duplicate.id)
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

  const stopState = () => {
    if (stateTimer.current) clearTimeout(stateTimer.current)
    if (blinkTimer.current) clearTimeout(blinkTimer.current)
    stateTimer.current = null
    blinkTimer.current = null
    setActiveState(null)
  }

  const launchState = (name: string) => {
    stopState()
    setActiveState(name)
    const pool = statePools[name]
    if (!pool?.length) return
    let position = 0
    const cycle = () => {
      const index = pool[position % pool.length]
      transitionToExpression(expressions[index], index)
      position += 1
      stateTimer.current = setTimeout(cycle, name === 'idle' ? 5200 : 2300)
    }
    const blinkLoop = () => {
      blink()
      blinkTimer.current = setTimeout(blinkLoop, 3400 + Math.random() * 2800)
    }
    cycle()
    blinkTimer.current = setTimeout(blinkLoop, 2600)
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

  const deleteEditing = () => {
    if (editing?.index === null || editing?.index === undefined) return
    if (!window.confirm(`Supprimer l’expression ${String(editing.index).padStart(2, '0')} ?`))
      return
    const next = expressions.filter((_, index) => index !== editing.index)
    setExpressions(next)
    persistGlobalExpressions(next)
    setActiveExpression(null)
    setEditing(null)
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

  return (
    <div className="studio">
      <section className="stage-column">
        <div className="brand">
          <span className="brand-mark" />
          Bible Strong <em>Avatar Lab</em>
        </div>
        <AvatarCanvas
          expression={expression}
          surface={surface}
          wirePaths={wirePaths}
          showWire={showWire}
          backPaths={backPaths}
          frontPaths={frontPaths}
          backNodeIds={backNodeIds}
          frontNodeIds={frontNodeIds}
          bodyEditing={bodyEditing}
          headPath={headPath}
          leftPath={leftPath}
          rightPath={rightPath}
          leftOpacity={leftOpacity}
          rightOpacity={rightOpacity}
          linked={linked}
          highlight={highlight}
          onHighlightChange={updateHighlight}
          onBodyNodeSelect={setSelectedBodyNodeId}
          onChange={updateImmediate}
        />
        <p className="stage-help">
          Glisse sur la surface pour orienter la tête. Les anneaux du gizmo contrôlent X, Y et Z.
        </p>
      </section>

      <main className={`inspector ${bodyEditing ? 'body-workspace' : ''}`}>
        {bodyEditing ? (
          <header className="body-workspace-header">
            <div>
              <p className="eyebrow">Construction du corps</p>
              <h1>{activeAvatar.name}</h1>
              <p>Choisis la forme principale puis assemble les primitives autour d’elle.</p>
            </div>
            <button type="button" onClick={() => setBodyEditing(false)}>
              Terminer
            </button>
          </header>
        ) : (
          <>
            <header className="inspector-header">
              <div>
                <p className="eyebrow">Prototype React + Motion</p>
                <h1>Avatar Studio</h1>
              </div>
              <span className="motion-status">
                <i />
                Motion actif
              </span>
            </header>
            <section className="avatar-switcher" aria-label="Avatar actif">
              <div>
                <span>Avatar</span>
                <select
                  aria-label="Choisir un avatar"
                  value={activeAvatarId}
                  onChange={event => activateAvatar(event.currentTarget.value)}
                >
                  {avatars.map(avatar => (
                    <option key={avatar.id} value={avatar.id}>
                      {avatar.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={() => setCreatingAvatar(true)}>
                + Nouvel avatar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('manual')
                  setBodyEditing(true)
                }}
              >
                Modifier le corps
              </button>
            </section>
            <p className="avatar-context">
              Tu travailles actuellement sur <strong>{activeAvatar.name}</strong>.
            </p>
            <nav className="tabs" aria-label="Mode d’édition">
              {(['manual', 'expressions', 'states'] as Mode[]).map(item => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={mode === item}
                  onClick={() => setMode(item)}
                >
                  {{ manual: 'Manuel', expressions: 'Expressions', states: 'États' }[item]}
                </button>
              ))}
            </nav>
          </>
        )}

        {mode === 'manual' && (
          <div className="panel-stack">
            {bodyEditing && (
              <>
                <section className="panel body-panel">
                  <PanelTitle
                    title="Construction du corps"
                    subtitle="Une forme principale porte les yeux. Les autres primitives se placent autour d’elle."
                  />
                  <div className="body-tree">
                    <button
                      type="button"
                      aria-pressed={selectedBodyNodeId === 'primary'}
                      onClick={() => setSelectedBodyNodeId('primary')}
                    >
                      <span className="body-node-icon">●</span>
                      <span>
                        <strong>Forme principale</strong>
                        <small>{surfaceLabels[surface.type]} · porte les yeux</small>
                      </span>
                    </button>
                    {bodyNodes.map(node => (
                      <button
                        type="button"
                        key={node.id}
                        aria-pressed={selectedBodyNodeId === node.id}
                        onClick={() => setSelectedBodyNodeId(node.id)}
                      >
                        <span className="body-node-icon">◇</span>
                        <span>
                          <strong>{node.name}</strong>
                          <small>{surfaceLabels[node.surface.type]}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="body-add">
                    <span>
                      Ajouter une forme · {bodyNodes.length}/{MAX_BODY_NODES}
                    </span>
                    <div>
                      {bodyPrimitiveTypes.map(type => (
                        <button
                          type="button"
                          key={type}
                          disabled={bodyNodes.length >= MAX_BODY_NODES}
                          onClick={() => addBodyNode(type)}
                        >
                          + {surfaceLabels[type]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedBodyNode && (
                    <div className="body-node-editor">
                      <div className="body-node-actions">
                        <strong>{selectedBodyNode.name}</strong>
                        <div>
                          <button
                            type="button"
                            disabled={bodyNodes.length >= MAX_BODY_NODES}
                            onClick={duplicateSelectedBodyNode}
                          >
                            Dupliquer
                          </button>
                          <button className="danger" type="button" onClick={deleteSelectedBodyNode}>
                            Supprimer
                          </button>
                        </div>
                      </div>
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
                          <h3>Position locale</h3>
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
                          <h3>Rotation locale</h3>
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
                </section>
                <section className="panel surface-panel">
                  <PanelTitle
                    title="Forme principale"
                    subtitle="Cette surface est la référence du visage et porte les yeux."
                  />
                  <div className="surface-grid">
                    {bodyPrimitiveTypes.map(type => {
                      const previewSurface = type === surface.type ? surface : surfacePresets[type]
                      return (
                        <button
                          className="surface-card"
                          type="button"
                          key={type}
                          aria-pressed={surface.type === type}
                          onClick={() => {
                            setSelectedBodyNodeId('primary')
                            if (type !== surface.type) {
                              updateSurface({ ...surfacePresets[type] })
                            }
                          }}
                        >
                          <SurfaceThumbnail surface={previewSurface} />
                          <span>{surfaceLabels[type]}</span>
                        </button>
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
                </section>
              </>
            )}
            {!bodyEditing && (
              <>
                <section className="panel">
                  <PanelTitle
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
                </section>
                {(['width', 'height', 'size'] as const).map(dimension => (
                  <section className="panel compact" key={dimension}>
                    <div className="panel-inline-title">
                      <h2>
                        {
                          { width: 'Largeur', height: 'Hauteur', size: 'Taille proportionnelle' }[
                            dimension
                          ]
                        }
                      </h2>
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
                  </section>
                ))}
                <section className="panel">
                  <PanelTitle
                    title="Position des yeux"
                    subtitle="Coordonnées communes projetées sur la forme choisie."
                  />
                  <div className="eye-columns">
                    <div className="eye-column">
                      <h3>Œil gauche</h3>
                      <NumericField
                        label="Horizontale"
                        value={expression.positionXLeft}
                        unit="u"
                        onActiveChange={active => updateHighlight(active ? 'left' : null)}
                        onChange={value => updateImmediate({ ...expression, positionXLeft: value })}
                      />
                      <NumericField
                        label="Verticale"
                        value={expression.positionYLeft}
                        unit="u"
                        onActiveChange={active => updateHighlight(active ? 'left' : null)}
                        onChange={value => updateImmediate({ ...expression, positionYLeft: value })}
                      />
                    </div>
                    <div className="eye-column">
                      <h3>Œil droit</h3>
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
                </section>
                <section className="panel">
                  <PanelTitle title="Rotation locale" subtitle="Inclinaison propre à chaque œil." />
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
                </section>
                <section className="panel">
                  <PanelTitle
                    title="Disposition générale"
                    subtitle="Écarte ou rapproche les yeux autour de leur centre commun."
                  />
                  <NumericField
                    label="Espacement"
                    value={expression.spacing}
                    min={0}
                    max={150}
                    unit="u"
                    onActiveChange={active => updateHighlight(active ? 'both' : null)}
                    onChange={updateSpacing}
                  />
                </section>
                <section className="panel">
                  <PanelTitle title="Projection" subtitle="Perspective et repères de la tête." />
                  <NumericField
                    label="Perspective"
                    value={expression.perspective}
                    step={0.01}
                    unit="×"
                    onChange={value => updateImmediate({ ...expression, perspective: value })}
                  />
                  <label className="switch">
                    <span>Afficher le maillage</span>
                    <input
                      type="checkbox"
                      checked={showWire}
                      onChange={event => updateWireVisibility(event.currentTarget.checked)}
                    />
                  </label>
                  <button
                    className="reset"
                    type="button"
                    onClick={() => transitionToExpression({ ...defaultExpression })}
                  >
                    Réinitialiser
                  </button>
                </section>
              </>
            )}
          </div>
        )}

        {!bodyEditing && mode === 'expressions' && (
          <div className="panel-stack">
            <section className="panel">
              <div className="preset-header">
                <div>
                  <p className="eyebrow">{expressions.length} presets</p>
                  <h2>Expressions</h2>
                </div>
                <span>Double-clic pour modifier</span>
              </div>
              <div className="expression-grid">
                {expressions.map((preset, index) => (
                  <button
                    className="expression-card"
                    aria-pressed={activeExpression === index}
                    type="button"
                    key={index}
                    onClick={() => transitionToExpression(preset, index)}
                    onDoubleClick={() => setEditing({ index, draft: { ...preset } })}
                  >
                    <ExpressionPreview
                      expression={preset}
                      surface={surface}
                      bodyNodes={bodyNodes}
                      id={String(index)}
                    />
                    <span>{String(index).padStart(2, '0')}</span>
                  </button>
                ))}
                <button
                  className="expression-add"
                  type="button"
                  onClick={() => setEditing({ index: null, draft: { ...expression } })}
                  aria-label="Nouvelle expression"
                >
                  +
                </button>
              </div>
            </section>
            <section className="panel">
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
                <button type="button" onClick={blink}>
                  Cligner
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const index = Math.floor(Math.random() * expressions.length)
                    transitionToExpression(expressions[index], index)
                  }}
                >
                  Expression aléatoire
                </button>
              </div>
            </section>
          </div>
        )}

        {!bodyEditing && mode === 'states' && (
          <div className="panel-stack">
            <section className="panel">
              <div className="preset-header">
                <div>
                  <p className="eyebrow">Séquences</p>
                  <h2>États animés</h2>
                </div>
                {activeState && (
                  <span className="live-state">
                    <i />
                    {activeState}
                  </span>
                )}
              </div>
              <div className="state-groups">
                {Object.entries(stateGroups).map(([group, states]) => (
                  <div key={group}>
                    <strong>{group}</strong>
                    <div className="state-buttons">
                      {states.map(name => (
                        <button
                          type="button"
                          key={name}
                          aria-pressed={selectedState === name}
                          onClick={() => setSelectedState(name)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel state-detail">
              <h2>{selectedState}</h2>
              <p>
                {stateNotes[selectedState] ??
                  'Cet état enchaîne un pool de presets et des clignements.'}
              </p>
              <div className="pool">
                {statePools[selectedState].map(index => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => transitionToExpression(expressions[index], index)}
                  >
                    {String(index).padStart(2, '0')}
                  </button>
                ))}
              </div>
              <div className="button-row">
                <button
                  className="primary"
                  type="button"
                  onClick={() => launchState(selectedState)}
                >
                  Lancer
                </button>
                <button type="button" onClick={stopState}>
                  Pause
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
      {creatingAvatar && (
        <div className="dialog-backdrop">
          <form className="avatar-create-dialog" onSubmit={submitNewAvatar}>
            <p className="eyebrow">Nouvel avatar</p>
            <h2>Comment s’appelle-t-il&nbsp;?</h2>
            <p>
              Il utilisera les expressions et les états globaux du Studio, puis tu construiras son
              corps.
            </p>
            <label>
              Nom de l’avatar
              <input
                autoFocus
                required
                value={newAvatarName}
                onChange={event => setNewAvatarName(event.currentTarget.value)}
                placeholder="Mon avatar"
              />
            </label>
            <div>
              <button type="button" onClick={() => setCreatingAvatar(false)}>
                Annuler
              </button>
              <button className="primary" type="submit">
                Créer l’avatar
              </button>
            </div>
          </form>
        </div>
      )}
      {editing && (
        <ExpressionDialog
          editing={editing}
          surface={surface}
          bodyNodes={bodyNodes}
          onChange={draft => setEditing({ ...editing, draft })}
          onCancel={() => setEditing(null)}
          onSave={saveEditing}
          onDelete={deleteEditing}
        />
      )}
    </div>
  )
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  )
}
