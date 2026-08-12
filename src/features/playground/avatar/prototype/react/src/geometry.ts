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
  headRadius: number
  leftPath: string
  rightPath: string
  leftVisible: boolean
  rightVisible: boolean
  wirePaths: string[]
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

const spherePoint = (longitude: number, latitude: number): Point3 => {
  const latitudeCosine = Math.cos(latitude)
  return [
    RADIUS * latitudeCosine * Math.sin(longitude),
    RADIUS * Math.sin(latitude),
    RADIUS * latitudeCosine * Math.cos(longitude),
  ]
}

const project = (point: Point3, perspective: number): Point3 => {
  const naturalPerspective = FOCAL_LENGTH / (FOCAL_LENGTH - point[2])
  const scale = 1 + (naturalPerspective - 1) * perspective
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

const averageDepth = (points: Point3[]) =>
  points.reduce((total, point) => total + point[2], 0) / points.length

const projectedHeadRadius = (perspective: number) => {
  let lowerAngle = 0
  let upperAngle = Math.PI / 2
  const radiusAt = (angle: number) => {
    const depth = RADIUS * Math.cos(angle)
    const naturalPerspective = FOCAL_LENGTH / (FOCAL_LENGTH - depth)
    return RADIUS * Math.sin(angle) * (1 + (naturalPerspective - 1) * perspective)
  }
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const first = lowerAngle + (upperAngle - lowerAngle) / 3
    const second = upperAngle - (upperAngle - lowerAngle) / 3
    if (radiusAt(first) < radiusAt(second)) lowerAngle = first
    else upperAngle = second
  }
  return radiusAt((lowerAngle + upperAngle) / 2)
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

const eyePoints = (pose: AvatarPose, side: -1 | 1, blink: number): Point3[] => {
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
    const surface = spherePoint((centerX + rotatedX) / RADIUS, (centerY + rotatedY) / RADIUS)
    return project(rotateWithQuaternion(pose.orientation, surface), expression.perspective)
  })
}

const visiblePath = (points: Point3[]) => {
  const segments: Point3[][] = []
  let segment: Point3[] = []
  points.forEach(point => {
    if (point[2] > 0) segment.push(point)
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

const wirePaths = (pose: AvatarPose): string[] => {
  const { perspective } = pose.expression
  const parallels = [-60, -30, 0, 30, 60].map(latitude =>
    Array.from({ length: 73 }, (_, index) => {
      const longitude = radians(-180 + index * 5)
      return project(
        rotateWithQuaternion(pose.orientation, spherePoint(longitude, radians(latitude))),
        perspective
      )
    })
  )
  const meridians = Array.from(
    { length: 12 },
    (_, longitudeIndex) => -150 + longitudeIndex * 30
  ).map(longitude =>
    Array.from({ length: 37 }, (_, index) => {
      const latitude = radians(-90 + index * 5)
      return project(
        rotateWithQuaternion(pose.orientation, spherePoint(radians(longitude), latitude)),
        perspective
      )
    })
  )
  return [...parallels, ...meridians].map(visiblePath)
}

const projectEyePoint = (
  pose: AvatarPose,
  side: -1 | 1,
  localX: number,
  localY: number
): Point3 => {
  const expression = pose.expression
  const suffix = side < 0 ? 'Left' : 'Right'
  const angle = radians(side < 0 ? expression.leftAngle : expression.rightAngle)
  const rotatedX = localX * Math.cos(angle) - localY * Math.sin(angle)
  const rotatedY = localX * Math.sin(angle) + localY * Math.cos(angle)
  const surface = spherePoint(
    ((side * expression.spacing) / 2 + expression[`positionX${suffix}`] + rotatedX) / RADIUS,
    (expression[`positionY${suffix}`] + rotatedY) / RADIUS
  )
  return project(rotateWithQuaternion(pose.orientation, surface), expression.perspective)
}

export const renderEyeEditor = (pose: AvatarPose, side: -1 | 1): EyeEditorGeometry => {
  const expression = pose.expression
  const suffix = side < 0 ? 'Left' : 'Right'
  const width = expression[`width${suffix}`]
  const height = expression[`height${suffix}`]
  const selectedPoints = eyePoints(pose, side, 1)
  const center = projectEyePoint(pose, side, 0, 0)
  const widthHandle = projectEyePoint(pose, side, width / 2 + 9, 0)
  const heightHandle = projectEyePoint(pose, side, 0, -height / 2 - 9)
  const rotateHandle = projectEyePoint(pose, side, 0, -height / 2 - 30)
  const sizeHandle = projectEyePoint(pose, side, width / 2 + 11, height / 2 + 11)
  const leftCenter = projectEyePoint(pose, -1, 0, 0)
  const rightCenter = projectEyePoint(pose, 1, 0, 0)
  const spacingCenterX = (expression.positionXLeft + expression.positionXRight) / 2
  const spacingCenterY = (expression.positionYLeft + expression.positionYRight) / 2
  const spacingSurface = spherePoint(
    spacingCenterX / RADIUS,
    (spacingCenterY + height / 2 + 34) / RADIUS
  )
  const spacingHandle = project(
    rotateWithQuaternion(pose.orientation, spacingSurface),
    expression.perspective
  )
  const spacingMiddle: Point3 = [
    (leftCenter[0] + rightCenter[0]) / 2,
    (leftCenter[1] + rightCenter[1]) / 2,
    (leftCenter[2] + rightCenter[2]) / 2,
  ]
  const line = (from: Point3, to: Point3) => path([from, to], false)
  return {
    visible: averageDepth(selectedPoints) > 0,
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

export const renderAvatar = (pose: AvatarPose, blink = 1): AvatarGeometry => {
  const left = eyePoints(pose, -1, blink)
  const right = eyePoints(pose, 1, blink)
  return {
    headRadius: projectedHeadRadius(pose.expression.perspective),
    leftPath: path(left),
    rightPath: path(right),
    leftVisible: averageDepth(left) > 0,
    rightVisible: averageDepth(right) > 0,
    wirePaths: wirePaths(pose),
  }
}
