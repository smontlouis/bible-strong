import {
  surfaceFrontSampleAt,
  surfacePointAt,
  surfaceSampleAt,
  type SurfaceConfig,
} from './surfaces'

export type Quaternion = readonly [number, number, number, number]
export type Point3 = readonly [number, number, number]

export type Expression = {
  headX: number
  headY: number
  headZ: number
  widthLeft: number
  widthRight: number
  heightLeft: number
  heightRight: number
  spacing: number
  positionXLeft: number
  positionXRight: number
  positionYLeft: number
  positionYRight: number
  leftAngle: number
  rightAngle: number
  perspective: number
}

export type AvatarPose = {
  expression: Expression
  orientation: Quaternion
}

export type AvatarGeometry = {
  headPath: string
  leftPath: string
  rightPath: string
  leftVisible: boolean
  rightVisible: boolean
  wirePaths: string[]
}

export type RenderAvatarOptions = {
  includeWire?: boolean
}

export type EyeEditorGeometry = {
  visible: boolean
  selectionPath: string
  widthGuide: string
  heightGuide: string
  rotationGuide: string
  spacingGuide: string
  center: Point3
  widthHandle: Point3
  heightHandle: Point3
  rotateHandle: Point3
  sizeHandle: Point3
  spacingHandle: Point3
}

export const RADIUS = 120
const FOCAL_LENGTH = 620
const QUARTER_ARC_SAMPLES = 14

export const expressionFields: (keyof Expression)[] = [
  'headX',
  'headY',
  'headZ',
  'widthLeft',
  'widthRight',
  'heightLeft',
  'heightRight',
  'spacing',
  'positionXLeft',
  'positionXRight',
  'positionYLeft',
  'positionYRight',
  'leftAngle',
  'rightAngle',
  'perspective',
]

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export const radians = (degrees: number) => (degrees * Math.PI) / 180

export const normalizeQuaternion = ([w, x, y, z]: Quaternion): Quaternion => {
  const length = Math.hypot(w, x, y, z) || 1
  return [w / length, x / length, y / length, z / length]
}

export const multiplyQuaternions = (
  [aw, ax, ay, az]: Quaternion,
  [bw, bx, by, bz]: Quaternion
): Quaternion =>
  normalizeQuaternion([
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ])

export const quaternionFromAxisAngle = ([x, y, z]: Point3, angle: number): Quaternion => {
  const halfAngle = angle / 2
  const sine = Math.sin(halfAngle)
  return normalizeQuaternion([Math.cos(halfAngle), x * sine, y * sine, z * sine])
}

export const quaternionFromEuler = (x: number, y: number, z: number): Quaternion => {
  const xRotation = quaternionFromAxisAngle([1, 0, 0], x)
  const yRotation = quaternionFromAxisAngle([0, 1, 0], y)
  const zRotation = quaternionFromAxisAngle([0, 0, 1], z)
  return multiplyQuaternions(multiplyQuaternions(zRotation, xRotation), yRotation)
}

export const quaternionFromVectors = (from: Point3, to: Point3): Quaternion => {
  const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2]
  const cross: Point3 = [
    from[1] * to[2] - from[2] * to[1],
    from[2] * to[0] - from[0] * to[2],
    from[0] * to[1] - from[1] * to[0],
  ]
  return normalizeQuaternion([1 + dot, cross[0], cross[1], cross[2]])
}

export const quaternionToEuler = ([w, x, y, z]: Quaternion): Point3 => {
  const matrix00 = 1 - 2 * (y * y + z * z)
  const matrix01 = 2 * (x * y - z * w)
  const matrix10 = 2 * (x * y + z * w)
  const matrix11 = 1 - 2 * (x * x + z * z)
  const matrix20 = 2 * (x * z - y * w)
  const matrix21 = 2 * (y * z + x * w)
  const matrix22 = 1 - 2 * (x * x + y * y)
  const headX = Math.asin(clamp(matrix21, -1, 1))
  if (Math.abs(Math.cos(headX)) < 0.00001) return [headX, 0, Math.atan2(matrix10, matrix00)]
  return [headX, Math.atan2(-matrix20, matrix22), Math.atan2(-matrix01, matrix11)]
}

const nearestEquivalentAngle = (angle: number, current: number) => {
  let result = angle
  while (result - current > 180) result -= 360
  while (result - current < -180) result += 360
  return clamp(result, -365, 365)
}

export const expressionWithOrientation = (
  expression: Expression,
  orientation: Quaternion
): Expression => {
  const [radiansX, radiansY, radiansZ] = quaternionToEuler(orientation)
  const x = (radiansX * 180) / Math.PI
  const y = (radiansY * 180) / Math.PI
  const z = (radiansZ * 180) / Math.PI
  return {
    ...expression,
    headX: nearestEquivalentAngle(x, expression.headX),
    headY: nearestEquivalentAngle(y, expression.headY),
    headZ: nearestEquivalentAngle(z, expression.headZ),
  }
}

export const slerpQuaternion = (
  start: Quaternion,
  end: Quaternion,
  progress: number
): Quaternion => {
  let target = end
  let dot = start.reduce((total, value, index) => total + value * target[index], 0)
  if (dot < 0) {
    target = target.map(value => -value) as unknown as Quaternion
    dot = -dot
  }
  if (dot > 0.9995) {
    return normalizeQuaternion(
      start.map(
        (value, index) => value + (target[index] - value) * progress
      ) as unknown as Quaternion
    )
  }
  const angle = Math.acos(clamp(dot, -1, 1))
  const sine = Math.sin(angle)
  const startWeight = Math.sin((1 - progress) * angle) / sine
  const targetWeight = Math.sin(progress * angle) / sine
  return normalizeQuaternion(
    start.map(
      (value, index) => value * startWeight + target[index] * targetWeight
    ) as unknown as Quaternion
  )
}

export const rotateWithQuaternion = ([w, x, y, z]: Quaternion, [px, py, pz]: Point3): Point3 => {
  const tx = 2 * (y * pz - z * py)
  const ty = 2 * (z * px - x * pz)
  const tz = 2 * (x * py - y * px)
  return [
    px + w * tx + (y * tz - z * ty),
    py + w * ty + (z * tx - x * tz),
    pz + w * tz + (x * ty - y * tx),
  ]
}

const roundedRectangle = (width: number, height: number): (readonly [number, number])[] => {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const cornerRadius = Math.min(halfHeight, halfWidth)
  const points: (readonly [number, number])[] = []
  const addLine = (start: readonly [number, number], end: readonly [number, number]) => {
    const samples = Math.max(2, Math.ceil(Math.hypot(end[0] - start[0], end[1] - start[1]) / 1.5))
    for (let index = 0; index < samples; index += 1) {
      const progress = index / samples
      points.push([
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress,
      ])
    }
  }
  const addArc = (centerX: number, centerY: number, startAngle: number) => {
    for (let index = 0; index < QUARTER_ARC_SAMPLES; index += 1) {
      const angle = startAngle + (index / QUARTER_ARC_SAMPLES) * (Math.PI / 2)
      points.push([
        centerX + Math.cos(angle) * cornerRadius,
        centerY + Math.sin(angle) * cornerRadius,
      ])
    }
  }
  addLine([-halfWidth + cornerRadius, -halfHeight], [halfWidth - cornerRadius, -halfHeight])
  addArc(halfWidth - cornerRadius, -halfHeight + cornerRadius, -Math.PI / 2)
  addLine([halfWidth, -halfHeight + cornerRadius], [halfWidth, halfHeight - cornerRadius])
  addArc(halfWidth - cornerRadius, halfHeight - cornerRadius, 0)
  addLine([halfWidth - cornerRadius, halfHeight], [-halfWidth + cornerRadius, halfHeight])
  addArc(-halfWidth + cornerRadius, halfHeight - cornerRadius, Math.PI / 2)
  addLine([-halfWidth, halfHeight - cornerRadius], [-halfWidth, -halfHeight + cornerRadius])
  addArc(-halfWidth + cornerRadius, -halfHeight + cornerRadius, Math.PI)
  return points
}

const project = (point: Point3, perspective: number): Point3 => {
  const denominator = FOCAL_LENGTH - point[2] * perspective
  const scale = Math.abs(denominator) < 0.0001 ? FOCAL_LENGTH / 0.0001 : FOCAL_LENGTH / denominator
  return [point[0] * scale, point[1] * scale, point[2]]
}

export const axisVector = (axis: 'x' | 'y' | 'z'): Point3 =>
  axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1]

export const rotateExpressionAroundAxis = (
  expression: Expression,
  axis: 'x' | 'y' | 'z',
  deltaDegrees: number
) => {
  const startOrientation = poseFromExpression(expression).orientation
  const worldAxis = rotateWithQuaternion(startOrientation, axisVector(axis))
  const orientation = multiplyQuaternions(
    quaternionFromAxisAngle(worldAxis, radians(deltaDegrees)),
    startOrientation
  )
  return expressionWithOrientation(expression, orientation)
}

export const rotateExpressionAroundCamera = (expression: Expression, deltaRadians: number) => {
  const startOrientation = poseFromExpression(expression).orientation
  return expressionWithOrientation(
    expression,
    multiplyQuaternions(quaternionFromAxisAngle([0, 0, 1], deltaRadians), startOrientation)
  )
}

const arcballVector = ([xValue, yValue]: readonly [number, number]): Point3 => {
  const x = xValue / RADIUS
  const y = yValue / RADIUS
  const squaredLength = x * x + y * y
  if (squaredLength <= 1) return [x, y, Math.sqrt(1 - squaredLength)]
  const length = Math.sqrt(squaredLength)
  return [x / length, y / length, 0]
}

export const rotateExpressionWithArcball = (
  expression: Expression,
  startPoint: readonly [number, number],
  currentPoint: readonly [number, number]
) => {
  const startOrientation = poseFromExpression(expression).orientation
  const delta = quaternionFromVectors(arcballVector(startPoint), arcballVector(currentPoint))
  return expressionWithOrientation(expression, multiplyQuaternions(delta, startOrientation))
}

export const rotationRing = (pose: AvatarPose, axis: 'x' | 'y' | 'z', radius = 30): Point3[] =>
  Array.from({ length: 97 }, (_, index) => {
    const angle = (index / 96) * Math.PI * 2
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const point: Point3 =
      axis === 'x' ? [0, cosine, sine] : axis === 'y' ? [cosine, 0, sine] : [cosine, sine, 0]
    const rotated = rotateWithQuaternion(pose.orientation, point)
    return [rotated[0] * radius, rotated[1] * radius, rotated[2]]
  })

const path = (points: Point3[], close = true) => {
  if (!points.length) return ''
  return `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}${points
    .slice(1)
    .map(point => `L${point[0].toFixed(2)} ${point[1].toFixed(2)}`)
    .join('')}${close ? 'Z' : ''}`
}

export const poseFromExpression = (expression: Expression): AvatarPose => ({
  expression,
  orientation: quaternionFromEuler(
    radians(expression.headX),
    radians(expression.headY),
    radians(expression.headZ)
  ),
})

export const interpolatePose = (from: AvatarPose, to: AvatarPose, progress: number): AvatarPose => {
  const expression = Object.fromEntries(
    expressionFields.map(field => [
      field,
      from.expression[field] + (to.expression[field] - from.expression[field]) * progress,
    ])
  ) as Expression
  return {
    expression,
    orientation: slerpQuaternion(from.orientation, to.orientation, progress),
  }
}

type ProjectedSurfacePoint = { point: Point3; normal: Point3 }
type LocalSurfacePoint = ProjectedSurfacePoint

const MAX_SURFACE_CACHE_ENTRIES = 24
const HEAD_LATITUDE_SAMPLES = 25
const HEAD_LONGITUDE_SAMPLES = 73
const PRIMITIVE_RING_SAMPLES = 144
const ROUNDED_CONE_LATITUDE_SAMPLES = 33
const ROUNDED_CONE_LONGITUDE_SAMPLES = 73
const headSamplesCache = new Map<string, Point3[]>()
const wireSamplesCache = new Map<string, LocalSurfacePoint[][]>()

const surfaceCacheKey = (surface: SurfaceConfig) =>
  [
    surface.type,
    surface.width,
    surface.height,
    surface.depth,
    surface.roundness,
    surface.tipRoundness,
    surface.baseRoundness,
  ]
    .map(value => (typeof value === 'number' ? value.toFixed(4) : value))
    .join(':')

const cacheSurfaceValue = <Value>(cache: Map<string, Value>, key: string, value: Value) => {
  if (cache.size >= MAX_SURFACE_CACHE_ENTRIES) cache.delete(cache.keys().next().value!)
  cache.set(key, value)
  return value
}

const localSurfacePoint = (
  surface: SurfaceConfig,
  longitude: number,
  latitude: number
): LocalSurfacePoint => surfaceSampleAt(surface, longitude, latitude)

const projectLocalSurfacePoint = (
  pose: AvatarPose,
  sample: LocalSurfacePoint
): ProjectedSurfacePoint => ({
  point: project(rotateWithQuaternion(pose.orientation, sample.point), pose.expression.perspective),
  normal: rotateWithQuaternion(pose.orientation, sample.normal),
})

const canonicalFaceCoordinates = (x: number, y: number): readonly [number, number] => {
  const longitude = x / RADIUS
  const latitude = y / RADIUS
  return [RADIUS * Math.cos(latitude) * Math.sin(longitude), RADIUS * Math.sin(latitude)]
}

const projectFacePoint = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  x: number,
  y: number
): ProjectedSurfacePoint => {
  const [faceX, faceY] = canonicalFaceCoordinates(x, y)
  return projectLocalSurfacePoint(pose, surfaceFrontSampleAt(surface, faceX, faceY))
}

const eyePoints = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  side: -1 | 1,
  blink: number
): ProjectedSurfacePoint[] => {
  const expression = pose.expression
  const suffix = side < 0 ? 'Left' : 'Right'
  const width = expression[`width${suffix}`]
  const restingHeight = expression[`height${suffix}`]
  const height = 5 + (restingHeight - 5) * blink
  const centerX = (side * expression.spacing) / 2 + expression[`positionX${suffix}`]
  const centerY = expression[`positionY${suffix}`]
  const angle = radians(side < 0 ? expression.leftAngle : expression.rightAngle)
  return roundedRectangle(width, height).map(([localX, localY]) => {
    const rotatedX = localX * Math.cos(angle) - localY * Math.sin(angle)
    const rotatedY = localX * Math.sin(angle) + localY * Math.cos(angle)
    return projectFacePoint(pose, surface, centerX + rotatedX, centerY + rotatedY)
  })
}

const visiblePath = (points: ProjectedSurfacePoint[]) => {
  const segments: Point3[][] = []
  let segment: Point3[] = []
  points.forEach(({ point, normal }) => {
    if (normal[2] > 0) segment.push(point)
    else if (segment.length) {
      segments.push(segment)
      segment = []
    }
  })
  if (segment.length) segments.push(segment)
  return segments
    .filter(item => item.length > 1)
    .map(item => path(item, false))
    .join('')
}

const wirePaths = (pose: AvatarPose, surface: SurfaceConfig): string[] => {
  const key = surfaceCacheKey(surface)
  let samples = wireSamplesCache.get(key)
  if (!samples) {
    const parallels = [-60, -30, 0, 30, 60].map(latitude =>
      Array.from({ length: 73 }, (_, index) =>
        localSurfacePoint(surface, radians(-180 + index * 5), radians(latitude))
      )
    )
    const meridians = Array.from(
      { length: 12 },
      (_, longitudeIndex) => -150 + longitudeIndex * 30
    ).map(longitude =>
      Array.from({ length: 37 }, (_, index) =>
        localSurfacePoint(surface, radians(longitude), radians(-90 + index * 5))
      )
    )
    samples = cacheSurfaceValue(wireSamplesCache, key, [...parallels, ...meridians])
  }
  return samples.map(curve =>
    visiblePath(curve.map(sample => projectLocalSurfacePoint(pose, sample)))
  )
}

const projectEyePoint = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  side: -1 | 1,
  localX: number,
  localY: number
): Point3 => {
  const expression = pose.expression
  const suffix = side < 0 ? 'Left' : 'Right'
  const angle = radians(side < 0 ? expression.leftAngle : expression.rightAngle)
  const rotatedX = localX * Math.cos(angle) - localY * Math.sin(angle)
  const rotatedY = localX * Math.sin(angle) + localY * Math.cos(angle)
  return projectFacePoint(
    pose,
    surface,
    (side * expression.spacing) / 2 + expression[`positionX${suffix}`] + rotatedX,
    expression[`positionY${suffix}`] + rotatedY
  ).point
}

export const renderEyeEditor = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  side: -1 | 1
): EyeEditorGeometry => {
  const expression = pose.expression
  const suffix = side < 0 ? 'Left' : 'Right'
  const width = expression[`width${suffix}`]
  const height = expression[`height${suffix}`]
  const selectedSamples = eyePoints(pose, surface, side, 1)
  const selectedPoints = selectedSamples.map(sample => sample.point)
  const center = projectEyePoint(pose, surface, side, 0, 0)
  const widthHandle = projectEyePoint(pose, surface, side, width / 2 + 9, 0)
  const heightHandle = projectEyePoint(pose, surface, side, 0, -height / 2 - 9)
  const rotateHandle = projectEyePoint(pose, surface, side, 0, -height / 2 - 30)
  const sizeHandle = projectEyePoint(pose, surface, side, width / 2 + 11, height / 2 + 11)
  const leftCenter = projectEyePoint(pose, surface, -1, 0, 0)
  const rightCenter = projectEyePoint(pose, surface, 1, 0, 0)
  const spacingCenterX = (expression.positionXLeft + expression.positionXRight) / 2
  const spacingCenterY = (expression.positionYLeft + expression.positionYRight) / 2
  const spacingHandle = projectFacePoint(
    pose,
    surface,
    spacingCenterX,
    spacingCenterY + height / 2 + 34
  ).point
  const spacingMiddle: Point3 = [
    (leftCenter[0] + rightCenter[0]) / 2,
    (leftCenter[1] + rightCenter[1]) / 2,
    (leftCenter[2] + rightCenter[2]) / 2,
  ]
  const line = (from: Point3, to: Point3) => path([from, to], false)
  return {
    visible: selectedSamples.reduce((total, sample) => total + sample.normal[2], 0) > 0,
    selectionPath: path(selectedPoints),
    widthGuide: line(center, widthHandle),
    heightGuide: line(center, heightHandle),
    rotationGuide: line(heightHandle, rotateHandle),
    spacingGuide: `${line(leftCenter, rightCenter)}${line(spacingMiddle, spacingHandle)}`,
    center,
    widthHandle,
    heightHandle,
    rotateHandle,
    sizeHandle,
    spacingHandle,
  }
}

const convexHull = (points: Point3[]): Point3[] => {
  const sorted = [...points].sort((left, right) => left[0] - right[0] || left[1] - right[1])
  const cross = (origin: Point3, first: Point3, second: Point3) =>
    (first[0] - origin[0]) * (second[1] - origin[1]) -
    (first[1] - origin[1]) * (second[0] - origin[0])
  const half = (source: Point3[]) => {
    const result: Point3[] = []
    source.forEach(point => {
      while (result.length >= 2 && cross(result.at(-2)!, result.at(-1)!, point) <= 0) result.pop()
      result.push(point)
    })
    return result
  }
  return [...half(sorted).slice(0, -1), ...half(sorted.reverse()).slice(0, -1)]
}

const smoothClosedPath = (points: Point3[]) => {
  if (points.length < 3) return path(points)
  const pointAt = (index: number) => points[(index + points.length) % points.length]
  return `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}${points
    .map((point, index) => {
      const previous = pointAt(index - 1)
      const next = pointAt(index + 1)
      const afterNext = pointAt(index + 2)
      const firstControl: Point3 = [
        point[0] + (next[0] - previous[0]) / 6,
        point[1] + (next[1] - previous[1]) / 6,
        point[2],
      ]
      const secondControl: Point3 = [
        next[0] - (afterNext[0] - point[0]) / 6,
        next[1] - (afterNext[1] - point[1]) / 6,
        next[2],
      ]
      return `C${firstControl[0].toFixed(2)} ${firstControl[1].toFixed(2)} ${secondControl[0].toFixed(2)} ${secondControl[1].toFixed(2)} ${next[0].toFixed(2)} ${next[1].toFixed(2)}`
    })
    .join('')}Z`
}

const densifyClosedPoints = (points: Point3[], maximumDistance = 7) =>
  points.flatMap((point, index) => {
    const next = points[(index + 1) % points.length]
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(next[0] - point[0], next[1] - point[1]) / maximumDistance)
    )
    return Array.from({ length: steps }, (_, step) => {
      const progress = step / steps
      return [
        point[0] + (next[0] - point[0]) * progress,
        point[1] + (next[1] - point[1]) * progress,
        point[2] + (next[2] - point[2]) * progress,
      ] as Point3
    })
  })

const smoothOpenPath = (points: Point3[]) => {
  if (!points.length) return ''
  if (points.length === 1) return `${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`
  return points
    .slice(0, -1)
    .map((point, index) => {
      const previous = points[Math.max(0, index - 1)]
      const next = points[index + 1]
      const afterNext = points[Math.min(points.length - 1, index + 2)]
      const firstControlX = point[0] + (next[0] - previous[0]) / 6
      const firstControlY = point[1] + (next[1] - previous[1]) / 6
      const secondControlX = next[0] - (afterNext[0] - point[0]) / 6
      const secondControlY = next[1] - (afterNext[1] - point[1]) / 6
      return `C${firstControlX.toFixed(2)} ${firstControlY.toFixed(2)} ${secondControlX.toFixed(2)} ${secondControlY.toFixed(2)} ${next[0].toFixed(2)} ${next[1].toFixed(2)}`
    })
    .join('')
}

const projectLocalPoint = (pose: AvatarPose, point: Point3) =>
  project(rotateWithQuaternion(pose.orientation, point), pose.expression.perspective)

const ringPoints = (width: number, depth: number, y: number) =>
  Array.from({ length: PRIMITIVE_RING_SAMPLES + 1 }, (_, index) => {
    const angle = (index / PRIMITIVE_RING_SAMPLES) * Math.PI * 2
    return [(width / 2) * Math.sin(angle), y, (depth / 2) * Math.cos(angle)] as Point3
  })

const projectedCylinderPath = (pose: AvatarPose, surface: SurfaceConfig) => {
  const halfHeight = surface.height / 2
  const projected = [
    ...ringPoints(surface.width, surface.depth, -halfHeight),
    ...ringPoints(surface.width, surface.depth, halfHeight),
  ].map(point => projectLocalPoint(pose, point))
  return smoothClosedPath(densifyClosedPoints(convexHull(projected)))
}

const projectedConePath = (pose: AvatarPose, surface: SurfaceConfig) => {
  if ((surface.tipRoundness ?? 0) > 0 || (surface.baseRoundness ?? 0) > 0) {
    const key = surfaceCacheKey(surface)
    let localSamples = headSamplesCache.get(key)
    if (!localSamples) {
      localSamples = Array.from({ length: ROUNDED_CONE_LATITUDE_SAMPLES }, (_, latitudeIndex) => {
        const latitude =
          -Math.PI / 2 + (latitudeIndex / (ROUNDED_CONE_LATITUDE_SAMPLES - 1)) * Math.PI
        return Array.from({ length: ROUNDED_CONE_LONGITUDE_SAMPLES }, (_, longitudeIndex) => {
          const longitude =
            -Math.PI + (longitudeIndex / (ROUNDED_CONE_LONGITUDE_SAMPLES - 1)) * Math.PI * 2
          return surfacePointAt(surface, longitude, latitude)
        })
      }).flat()
      cacheSurfaceValue(headSamplesCache, key, localSamples)
    }
    const projected = localSamples.map(point => projectLocalPoint(pose, point))
    return smoothClosedPath(densifyClosedPoints(convexHull(projected)))
  }

  const apex = projectLocalPoint(pose, [0, surface.height / 2, 0])
  const base = ringPoints(surface.width, surface.depth, -surface.height / 2).map(point =>
    projectLocalPoint(pose, point)
  )
  const hull = convexHull([...base, apex])
  const apexIndex = hull.findIndex(
    point => Math.hypot(point[0] - apex[0], point[1] - apex[1]) < 0.01
  )
  if (apexIndex < 0) return smoothClosedPath(hull)

  const ordered = [...hull.slice(apexIndex), ...hull.slice(0, apexIndex)]
  const baseArc = ordered.slice(1)
  if (baseArc.length < 2) return path(hull)
  return `M${apex[0].toFixed(2)} ${apex[1].toFixed(2)}L${baseArc[0][0].toFixed(2)} ${baseArc[0][1].toFixed(2)}${smoothOpenPath(baseArc)}L${apex[0].toFixed(2)} ${apex[1].toFixed(2)}Z`
}

const projectedDiamondPath = (pose: AvatarPose, surface: SurfaceConfig) => {
  const halfWidth = surface.width / 2
  const halfHeight = surface.height / 2
  const halfDepth = surface.depth / 2
  const vertices: Point3[] = [
    [-halfWidth, 0, 0],
    [halfWidth, 0, 0],
    [0, -halfHeight, 0],
    [0, halfHeight, 0],
    [0, 0, -halfDepth],
    [0, 0, halfDepth],
  ]
  return path(convexHull(vertices.map(point => projectLocalPoint(pose, point))))
}

type ProjectedEllipse = {
  centerX: number
  centerY: number
  majorRadius: number
  minorRadius: number
  rotation: number
}

const ellipseProjection = (
  centerX: number,
  centerY: number,
  covarianceXX: number,
  covarianceXY: number,
  covarianceYY: number
): ProjectedEllipse | null => {
  const trace = covarianceXX + covarianceYY
  const difference = Math.hypot(covarianceXX - covarianceYY, covarianceXY * 2)
  const majorSquared = (trace + difference) / 2
  const minorSquared = (trace - difference) / 2
  if (majorSquared <= 0 || minorSquared <= 0) return null

  return {
    centerX,
    centerY,
    majorRadius: Math.sqrt(majorSquared),
    minorRadius: Math.sqrt(minorSquared),
    rotation: Math.atan2(covarianceXY * 2, covarianceXX - covarianceYY) / 2,
  }
}

const ellipsePath = ({
  centerX,
  centerY,
  majorRadius,
  minorRadius,
  rotation,
}: ProjectedEllipse) => {
  const rotationDegrees = (rotation * 180) / Math.PI
  const offsetX = Math.cos(rotation) * majorRadius
  const offsetY = Math.sin(rotation) * majorRadius
  const startX = centerX + offsetX
  const startY = centerY + offsetY
  const endX = centerX - offsetX
  const endY = centerY - offsetY

  return `M${startX.toFixed(2)} ${startY.toFixed(2)}A${majorRadius.toFixed(2)} ${minorRadius.toFixed(2)} ${rotationDegrees.toFixed(2)} 0 1 ${endX.toFixed(2)} ${endY.toFixed(2)}A${majorRadius.toFixed(2)} ${minorRadius.toFixed(2)} ${rotationDegrees.toFixed(2)} 0 1 ${startX.toFixed(2)} ${startY.toFixed(2)}Z`
}

const projectedEllipsoid = (
  pose: AvatarPose,
  axes: Point3,
  localCenter: Point3 = [0, 0, 0]
): ProjectedEllipse | null => {
  const rotatedAxes = [
    rotateWithQuaternion(pose.orientation, [1, 0, 0]),
    rotateWithQuaternion(pose.orientation, [0, 1, 0]),
    rotateWithQuaternion(pose.orientation, [0, 0, 1]),
  ]
  const center = rotateWithQuaternion(pose.orientation, localCenter)

  if (Math.abs(pose.expression.perspective) < 0.0001) {
    const covarianceXX = rotatedAxes.reduce(
      (total, axis, index) => total + axis[0] * axis[0] * axes[index] * axes[index],
      0
    )
    const covarianceXY = rotatedAxes.reduce(
      (total, axis, index) => total + axis[0] * axis[1] * axes[index] * axes[index],
      0
    )
    const covarianceYY = rotatedAxes.reduce(
      (total, axis, index) => total + axis[1] * axis[1] * axes[index] * axes[index],
      0
    )
    return ellipseProjection(center[0], center[1], covarianceXX, covarianceXY, covarianceYY)
  }

  const inverseAxesSquared = axes.map(axis => 1 / (axis * axis))
  const quadratic = Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 3 }, (_, column) =>
      rotatedAxes.reduce(
        (total, axis, index) => total + axis[row] * inverseAxesSquared[index] * axis[column],
        0
      )
    )
  )
  const focalLength = FOCAL_LENGTH / pose.expression.perspective
  const cameraOffset: Point3 = [-center[0], -center[1], focalLength - center[2]]
  const cameraNormal: Point3 = [
    quadratic[0][0] * cameraOffset[0] +
      quadratic[0][1] * cameraOffset[1] +
      quadratic[0][2] * cameraOffset[2],
    quadratic[1][0] * cameraOffset[0] +
      quadratic[1][1] * cameraOffset[1] +
      quadratic[1][2] * cameraOffset[2],
    quadratic[2][0] * cameraOffset[0] +
      quadratic[2][1] * cameraOffset[1] +
      quadratic[2][2] * cameraOffset[2],
  ]
  const cameraTerm =
    cameraOffset[0] * cameraNormal[0] +
    cameraOffset[1] * cameraNormal[1] +
    cameraOffset[2] * cameraNormal[2] -
    1
  const tangentLinear = [cameraNormal[0], cameraNormal[1], -focalLength * cameraNormal[2]]
  const rayQuadratic = [
    [quadratic[0][0], quadratic[0][1], -focalLength * quadratic[0][2]],
    [quadratic[1][0], quadratic[1][1], -focalLength * quadratic[1][2]],
    [
      -focalLength * quadratic[2][0],
      -focalLength * quadratic[2][1],
      focalLength * focalLength * quadratic[2][2],
    ],
  ]
  const conic = Array.from({ length: 3 }, (_, row) =>
    Array.from(
      { length: 3 },
      (_, column) =>
        tangentLinear[row] * tangentLinear[column] - cameraTerm * rayQuadratic[row][column]
    )
  )
  const determinant = conic[0][0] * conic[1][1] - conic[0][1] * conic[0][1]
  if (Math.abs(determinant) < 1e-12) return null

  const centerX = -(conic[1][1] * conic[0][2] - conic[0][1] * conic[1][2]) / determinant
  const centerY = (conic[0][1] * conic[0][2] - conic[0][0] * conic[1][2]) / determinant
  const centeredConstant = conic[2][2] + conic[0][2] * centerX + conic[1][2] * centerY
  const scale = -centeredConstant
  if (Math.abs(scale) < 1e-12) return null

  const shapeXX = conic[0][0] / scale
  const shapeXY = conic[0][1] / scale
  const shapeYY = conic[1][1] / scale
  const shapeDeterminant = shapeXX * shapeYY - shapeXY * shapeXY
  if (shapeDeterminant <= 0) return null

  return ellipseProjection(
    centerX,
    centerY,
    shapeYY / shapeDeterminant,
    -shapeXY / shapeDeterminant,
    shapeXX / shapeDeterminant
  )
}

const projectedEllipsoidPath = (pose: AvatarPose, surface: SurfaceConfig) => {
  const ellipse = projectedEllipsoid(pose, [
    surface.width / 2,
    surface.height / 2,
    surface.depth / 2,
  ])
  return ellipse ? ellipsePath(ellipse) : null
}

const ellipsePoints = (ellipse: ProjectedEllipse) =>
  Array.from({ length: PRIMITIVE_RING_SAMPLES }, (_, index) => {
    const angle = (index / PRIMITIVE_RING_SAMPLES) * Math.PI * 2
    const major = Math.cos(angle) * ellipse.majorRadius
    const minor = Math.sin(angle) * ellipse.minorRadius
    return [
      ellipse.centerX + major * Math.cos(ellipse.rotation) - minor * Math.sin(ellipse.rotation),
      ellipse.centerY + major * Math.sin(ellipse.rotation) + minor * Math.cos(ellipse.rotation),
      0,
    ] as Point3
  })

const smoothHullPath = (points: Point3[]) => {
  if (points.length < 3) return path(points)
  const distances = points.map((point, index) => {
    const next = points[(index + 1) % points.length]
    return Math.hypot(next[0] - point[0], next[1] - point[1])
  })
  const sortedDistances = [...distances].sort((left, right) => left - right)
  const medianDistance = sortedDistances[Math.floor(sortedDistances.length / 2)] || 1
  const straightThreshold = Math.max(8, medianDistance * 3.5)
  const straightEdges = distances.map(distance => distance > straightThreshold)

  return `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}${points
    .map((point, index) => {
      const nextIndex = (index + 1) % points.length
      const next = points[nextIndex]
      if (straightEdges[index]) return `L${next[0].toFixed(2)} ${next[1].toFixed(2)}`
      const previous = straightEdges[(index - 1 + points.length) % points.length]
        ? point
        : points[(index - 1 + points.length) % points.length]
      const afterNext = straightEdges[nextIndex] ? next : points[(index + 2) % points.length]
      const firstControlX = point[0] + (next[0] - previous[0]) / 6
      const firstControlY = point[1] + (next[1] - previous[1]) / 6
      const secondControlX = next[0] - (afterNext[0] - point[0]) / 6
      const secondControlY = next[1] - (afterNext[1] - point[1]) / 6
      return `C${firstControlX.toFixed(2)} ${firstControlY.toFixed(2)} ${secondControlX.toFixed(2)} ${secondControlY.toFixed(2)} ${next[0].toFixed(2)} ${next[1].toFixed(2)}`
    })
    .join('')}Z`
}

const projectedCapsulePath = (pose: AvatarPose, surface: SurfaceConfig) => {
  const radiusX = surface.width / 2
  const radiusY = Math.min(radiusX, surface.height / 2)
  const radiusZ = surface.depth / 2
  const straightHalf = Math.max(0, (surface.height - radiusY * 2) / 2)
  const axes: Point3 = [radiusX, radiusY, radiusZ]
  const top = projectedEllipsoid(pose, axes, [0, straightHalf, 0])
  const bottom = projectedEllipsoid(pose, axes, [0, -straightHalf, 0])
  if (!top || !bottom) return null
  return smoothHullPath(convexHull([...ellipsePoints(top), ...ellipsePoints(bottom)]))
}

const headPath = (pose: AvatarPose, surface: SurfaceConfig) => {
  if (surface.type === 'sphere' || surface.type === 'ellipsoid') {
    const exactPath = projectedEllipsoidPath(pose, surface)
    if (exactPath) return exactPath
  }

  if (surface.type === 'capsule') {
    const exactPath = projectedCapsulePath(pose, surface)
    if (exactPath) return exactPath
  }

  if (surface.type === 'cylinder') return projectedCylinderPath(pose, surface)
  if (surface.type === 'cone') return projectedConePath(pose, surface)
  if (surface.type === 'diamond') return projectedDiamondPath(pose, surface)

  const key = surfaceCacheKey(surface)
  let localSamples = headSamplesCache.get(key)
  if (!localSamples) {
    localSamples = Array.from({ length: HEAD_LATITUDE_SAMPLES }, (_, latitudeIndex) => {
      const latitude = -Math.PI / 2 + (latitudeIndex / (HEAD_LATITUDE_SAMPLES - 1)) * Math.PI
      return Array.from({ length: HEAD_LONGITUDE_SAMPLES }, (_, longitudeIndex) => {
        const longitude = -Math.PI + (longitudeIndex / (HEAD_LONGITUDE_SAMPLES - 1)) * Math.PI * 2
        return surfacePointAt(surface, longitude, latitude)
      })
    }).flat()
    cacheSurfaceValue(headSamplesCache, key, localSamples)
  }
  const projectedSamples = localSamples.map(sample =>
    project(rotateWithQuaternion(pose.orientation, sample), pose.expression.perspective)
  )
  return path(convexHull(projectedSamples))
}

export const renderAvatar = (
  pose: AvatarPose,
  surface: SurfaceConfig,
  blink = 1,
  options: RenderAvatarOptions = {}
): AvatarGeometry => {
  const leftSamples = eyePoints(pose, surface, -1, blink)
  const rightSamples = eyePoints(pose, surface, 1, blink)
  const left = leftSamples.map(sample => sample.point)
  const right = rightSamples.map(sample => sample.point)
  return {
    headPath: headPath(pose, surface),
    leftPath: path(left),
    rightPath: path(right),
    leftVisible: leftSamples.reduce((total, sample) => total + sample.normal[2], 0) > 0,
    rightVisible: rightSamples.reduce((total, sample) => total + sample.normal[2], 0) > 0,
    wirePaths: options.includeWire === false ? [] : wirePaths(pose, surface),
  }
}
