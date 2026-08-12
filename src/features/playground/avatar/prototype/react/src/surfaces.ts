import type { Point3 } from './geometry'

export type SurfaceType =
  | 'sphere'
  | 'ellipsoid'
  | 'roundedBox'
  | 'capsule'
  | 'cylinder'
  | 'cone'
  | 'diamond'

export type SurfaceConfig = {
  type: SurfaceType
  width: number
  height: number
  depth: number
  roundness: number
  tipRoundness?: number
  baseRoundness?: number
}

export type SurfaceSample = {
  point: Point3
  normal: Point3
}

export const surfacePresets: Record<SurfaceType, SurfaceConfig> = {
  sphere: { type: 'sphere', width: 240, height: 240, depth: 240, roundness: 1 },
  ellipsoid: { type: 'ellipsoid', width: 250, height: 210, depth: 220, roundness: 1 },
  roundedBox: { type: 'roundedBox', width: 250, height: 225, depth: 215, roundness: 0.32 },
  capsule: { type: 'capsule', width: 205, height: 270, depth: 205, roundness: 1 },
  cylinder: { type: 'cylinder', width: 235, height: 250, depth: 215, roundness: 0.45 },
  cone: {
    type: 'cone',
    width: 250,
    height: 265,
    depth: 225,
    roundness: 0,
    tipRoundness: 0.55,
    baseRoundness: 0.45,
  },
  diamond: { type: 'diamond', width: 235, height: 260, depth: 215, roundness: 0 },
}

export const surfaceLabels: Record<SurfaceType, string> = {
  sphere: 'Sphère',
  ellipsoid: 'Ellipsoïde',
  roundedBox: 'Cube arrondi',
  capsule: 'Capsule',
  cylinder: 'Cylindre',
  cone: 'Cône',
  diamond: 'Diamant',
}

const signedPower = (value: number, exponent: number) =>
  Math.sign(value) * Math.abs(value) ** exponent

const superellipsoid = (
  longitude: number,
  latitude: number,
  width: number,
  height: number,
  depth: number,
  verticalExponent: number,
  horizontalExponent: number
): Point3 => {
  const latitudeCosine = signedPower(Math.cos(latitude), verticalExponent)
  return [
    (width / 2) * latitudeCosine * signedPower(Math.sin(longitude), horizontalExponent),
    (height / 2) * signedPower(Math.sin(latitude), verticalExponent),
    (depth / 2) * latitudeCosine * signedPower(Math.cos(longitude), horizontalExponent),
  ]
}

const capsule = (config: SurfaceConfig, longitude: number, latitude: number): Point3 => {
  const radiusX = config.width / 2
  const radiusZ = config.depth / 2
  const capRadius = Math.min(radiusX, config.height / 2)
  const straightHalf = Math.max(0, (config.height - capRadius * 2) / 2)
  const meridianLength = straightHalf * 2 + Math.PI * capRadius
  const distance = ((latitude + Math.PI / 2) / Math.PI) * meridianLength
  let radial = radiusX
  let y = 0

  if (distance < (Math.PI * capRadius) / 2) {
    const angle = -Math.PI / 2 + distance / capRadius
    radial = radiusX * Math.cos(angle)
    y = -straightHalf + capRadius * Math.sin(angle)
  } else if (distance <= (Math.PI * capRadius) / 2 + straightHalf * 2) {
    y = -straightHalf + distance - (Math.PI * capRadius) / 2
  } else {
    const angle = (distance - (Math.PI * capRadius) / 2 - straightHalf * 2) / capRadius
    radial = radiusX * Math.cos(angle)
    y = straightHalf + capRadius * Math.sin(angle)
  }

  const depthScale = radiusX ? radiusZ / radiusX : 1
  return [radial * Math.sin(longitude), y, radial * depthScale * Math.cos(longitude)]
}

const diamond = (config: SurfaceConfig, longitude: number, latitude: number): Point3 => {
  const sphereX = Math.cos(latitude) * Math.sin(longitude)
  const sphereY = Math.sin(latitude)
  const sphereZ = Math.cos(latitude) * Math.cos(longitude)
  const length = Math.abs(sphereX) + Math.abs(sphereY) + Math.abs(sphereZ) || 1
  return [
    (config.width / 2) * (sphereX / length),
    (config.height / 2) * (sphereY / length),
    (config.depth / 2) * (sphereZ / length),
  ]
}

const MAX_CONE_TIP_FRACTION = 0.24
const MAX_CONE_BASE_FRACTION = 0.2
const MAX_CYLINDER_EDGE_FRACTION = 0.22

type RadialProfile = {
  radiusScale: number
  verticalProgress: number
}

const cubic = (
  start: number,
  firstControl: number,
  secondControl: number,
  end: number,
  progress: number
) => {
  const inverse = 1 - progress
  return (
    inverse ** 3 * start +
    3 * inverse * inverse * progress * firstControl +
    3 * inverse * progress * progress * secondControl +
    progress ** 3 * end
  )
}

const coneRounding = (config: SurfaceConfig) => ({
  tipFraction: (config.tipRoundness ?? 0) * MAX_CONE_TIP_FRACTION,
  baseFraction: (config.baseRoundness ?? 0) * MAX_CONE_BASE_FRACTION,
})

/** Cylinder half-profile with a quarter-round transition at both caps. */
const cylinderProfileAt = (config: SurfaceConfig, progress: number): RadialProfile => {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const edgeFraction = config.roundness * MAX_CYLINDER_EDGE_FRACTION
  if (edgeFraction <= 0) {
    return {
      radiusScale: 1,
      verticalProgress: (Math.sin((clampedProgress - 0.5) * Math.PI) + 1) / 2,
    }
  }

  if (clampedProgress < edgeFraction) {
    const angle = -Math.PI / 2 + (clampedProgress / edgeFraction) * (Math.PI / 2)
    return {
      radiusScale: 1 - edgeFraction + edgeFraction * Math.cos(angle),
      verticalProgress: (edgeFraction + edgeFraction * Math.sin(angle)) / 2,
    }
  }

  if (clampedProgress > 1 - edgeFraction) {
    const angle = ((clampedProgress - (1 - edgeFraction)) / edgeFraction) * (Math.PI / 2)
    return {
      radiusScale: 1 - edgeFraction + edgeFraction * Math.cos(angle),
      verticalProgress: 1 - edgeFraction / 2 + (edgeFraction * Math.sin(angle)) / 2,
    }
  }

  const middleProgress = (clampedProgress - edgeFraction) / (1 - edgeFraction * 2)
  return {
    radiusScale: 1,
    verticalProgress: edgeFraction / 2 + middleProgress * (1 - edgeFraction),
  }
}

const radiusScaleAtVerticalProgress = (
  config: SurfaceConfig,
  verticalProgress: number,
  profileAt: (config: SurfaceConfig, progress: number) => RadialProfile
) => {
  const progress = Math.max(0, Math.min(1, verticalProgress))
  let lower = 0
  let upper = 1
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const candidate = (lower + upper) / 2
    if (profileAt(config, candidate).verticalProgress < progress) lower = candidate
    else upper = candidate
  }
  return profileAt(config, (lower + upper) / 2).radiusScale
}

/** Rounded half-profile revolved around the cone's vertical axis. */
const coneProfileAt = (config: SurfaceConfig, progress: number): RadialProfile => {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const { tipFraction, baseFraction } = coneRounding(config)

  if (baseFraction > 0 && clampedProgress < baseFraction) {
    const curveProgress = clampedProgress / baseFraction
    return {
      radiusScale: cubic(
        1 - baseFraction,
        1,
        1 - baseFraction / 2,
        1 - baseFraction,
        curveProgress
      ),
      verticalProgress: cubic(0, 0, baseFraction / 2, baseFraction, curveProgress),
    }
  }

  if (tipFraction > 0 && clampedProgress > 1 - tipFraction) {
    const curveProgress = (clampedProgress - (1 - tipFraction)) / tipFraction
    return {
      radiusScale: cubic(tipFraction, tipFraction / 2, tipFraction / 4, 0, curveProgress),
      verticalProgress: cubic(1 - tipFraction, 1 - tipFraction / 2, 1, 1, curveProgress),
    }
  }

  return {
    radiusScale: 1 - clampedProgress,
    verticalProgress: clampedProgress,
  }
}

export const surfacePointAt = (
  config: SurfaceConfig,
  longitude: number,
  latitude: number
): Point3 => {
  const { width, height, depth } = config
  switch (config.type) {
    case 'sphere':
    case 'ellipsoid':
      return superellipsoid(longitude, latitude, width, height, depth, 1, 1)
    case 'roundedBox': {
      const exponent = 0.16 + config.roundness * 0.84
      return superellipsoid(longitude, latitude, width, height, depth, exponent, exponent)
    }
    case 'cylinder': {
      const progress = (latitude + Math.PI / 2) / Math.PI
      const profile = cylinderProfileAt(config, progress)
      return [
        (width / 2) * profile.radiusScale * Math.sin(longitude),
        -height / 2 + height * profile.verticalProgress,
        (depth / 2) * profile.radiusScale * Math.cos(longitude),
      ]
    }
    case 'diamond':
      return diamond(config, longitude, latitude)
    case 'capsule':
      return capsule(config, longitude, latitude)
    case 'cone': {
      const progress = (latitude + Math.PI / 2) / Math.PI
      const profile = coneProfileAt(config, progress)
      return [
        (width / 2) * profile.radiusScale * Math.sin(longitude),
        height / 2 - height * profile.verticalProgress,
        (depth / 2) * profile.radiusScale * Math.cos(longitude),
      ]
    }
  }
}

const subtract = (left: Point3, right: Point3): Point3 => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2],
]

const normalize = ([x, y, z]: Point3): Point3 => {
  const length = Math.hypot(x, y, z) || 1
  return [x / length, y / length, z / length]
}

const normalFromTangents = (
  config: SurfaceConfig,
  longitudeTangent: Point3,
  latitudeTangent: Point3
) => {
  const orientation = config.type === 'cone' ? -1 : 1
  return normalize([
    orientation *
      (longitudeTangent[1] * latitudeTangent[2] - longitudeTangent[2] * latitudeTangent[1]),
    orientation *
      (longitudeTangent[2] * latitudeTangent[0] - longitudeTangent[0] * latitudeTangent[2]),
    orientation *
      (longitudeTangent[0] * latitudeTangent[1] - longitudeTangent[1] * latitudeTangent[0]),
  ])
}

const tangentNormalAt = (config: SurfaceConfig, longitude: number, latitude: number) => {
  const epsilon = 0.0005
  if (config.type === 'cone' && latitude >= Math.PI / 2 - epsilon) return [0, -1, 0] as Point3
  const longitudeBefore = surfacePointAt(config, longitude - epsilon, latitude)
  const longitudeAfter = surfacePointAt(config, longitude + epsilon, latitude)
  const latitudeBefore = surfacePointAt(
    config,
    longitude,
    Math.max(-Math.PI / 2, latitude - epsilon)
  )
  const latitudeAfter = surfacePointAt(config, longitude, Math.min(Math.PI / 2, latitude + epsilon))
  return normalFromTangents(
    config,
    subtract(longitudeAfter, longitudeBefore),
    subtract(latitudeAfter, latitudeBefore)
  )
}

const signedMagnitude = (value: number, exponent: number) =>
  Math.sign(value) * Math.abs(value) ** exponent

const ellipsoidFrontSample = (
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  radiusZ: number,
  centerY = 0
): SurfaceSample => {
  const localY = y - centerY
  const remaining = Math.max(0, 1 - (x / (radiusX || 1)) ** 2 - (localY / (radiusY || 1)) ** 2)
  const z = radiusZ * Math.sqrt(remaining)
  return {
    point: [x, y, z],
    normal: normalize([
      x / (radiusX * radiusX || 1),
      localY / (radiusY * radiusY || 1),
      z / (radiusZ * radiusZ || 1),
    ]),
  }
}

const radialProfileFrontSample = (
  config: SurfaceConfig,
  x: number,
  y: number,
  profileAt: (config: SurfaceConfig, progress: number) => RadialProfile,
  verticalDirection: -1 | 1
): SurfaceSample => {
  const radiusX = config.width / 2 || 1
  const radiusZ = config.depth / 2 || 1
  const verticalProgress = Math.max(0, Math.min(1, 0.5 + verticalDirection * (y / config.height)))
  const radialScale = radiusScaleAtVerticalProgress(config, verticalProgress, profileAt)
  const sectionRadiusX = radiusX * radialScale
  const sectionRadiusZ = radiusZ * radialScale
  const surfaceX = Math.max(-sectionRadiusX, Math.min(sectionRadiusX, x))
  const remaining = sectionRadiusX > 0 ? Math.max(0, 1 - (surfaceX / sectionRadiusX) ** 2) : 0
  const z = sectionRadiusZ * Math.sqrt(remaining)
  const derivativeStep = 0.0001
  const previousProgress = Math.max(0, verticalProgress - derivativeStep)
  const nextProgress = Math.min(1, verticalProgress + derivativeStep)
  const previousScale = radiusScaleAtVerticalProgress(config, previousProgress, profileAt)
  const nextScale = radiusScaleAtVerticalProgress(config, nextProgress, profileAt)
  const scaleDerivative = (nextScale - previousScale) / (nextProgress - previousProgress || 1)
  const radialRemainder = Math.max(Math.sqrt(remaining), 0.0001)
  const depthRatio = radiusZ / radiusX
  const depthXDerivative = (-depthRatio * surfaceX) / (sectionRadiusX * radialRemainder || 1)
  const depthYDerivative =
    (verticalDirection * radiusZ * scaleDerivative) / (config.height * radialRemainder || 1)
  return {
    point: [surfaceX, y, z],
    normal: normalize([-depthXDerivative, -depthYDerivative, 1]),
  }
}

/** Project canonical face coordinates onto a primitive's front-facing sheet. */
export const surfaceFrontSampleAt = (
  config: SurfaceConfig,
  x: number,
  y: number
): SurfaceSample => {
  const radiusX = config.width / 2 || 1
  const radiusY = config.height / 2 || 1
  const radiusZ = config.depth / 2 || 1

  switch (config.type) {
    case 'sphere':
    case 'ellipsoid':
      return ellipsoidFrontSample(x, y, radiusX, radiusY, radiusZ)

    case 'roundedBox': {
      const exponent = 0.16 + config.roundness * 0.84
      const power = 2 / exponent
      const normalizedX = x / radiusX
      const normalizedY = y / radiusY
      const remaining = Math.max(
        0,
        1 - Math.abs(normalizedX) ** power - Math.abs(normalizedY) ** power
      )
      const normalizedZ = remaining ** (1 / power)
      return {
        point: [x, y, radiusZ * normalizedZ],
        normal: normalize([
          signedMagnitude(normalizedX, power - 1) / radiusX,
          signedMagnitude(normalizedY, power - 1) / radiusY,
          normalizedZ ** (power - 1) / radiusZ,
        ]),
      }
    }

    case 'capsule': {
      const capRadiusY = Math.min(radiusX, radiusY)
      const straightHalf = Math.max(0, radiusY - capRadiusY)
      const capCenterY = y < -straightHalf ? -straightHalf : y > straightHalf ? straightHalf : y
      return ellipsoidFrontSample(x, y, radiusX, capRadiusY, radiusZ, capCenterY)
    }

    case 'cylinder':
      return radialProfileFrontSample(config, x, y, cylinderProfileAt, 1)

    case 'cone':
      return radialProfileFrontSample(config, x, y, coneProfileAt, -1)

    case 'diamond': {
      const normalizedZ = Math.max(0, 1 - Math.abs(x) / radiusX - Math.abs(y) / radiusY)
      const z = radiusZ * normalizedZ
      return {
        point: [x, y, z],
        normal: normalize([Math.sign(x) / radiusX, Math.sign(y) / radiusY, 1 / radiusZ]),
      }
    }
  }
}

export const surfaceNormalAt = (
  config: SurfaceConfig,
  longitude: number,
  latitude: number
): Point3 => {
  const point = surfacePointAt(config, longitude, latitude)

  // An ellipsoid has a cheap exact normal. This is also the overwhelmingly
  // common path for the default spherical head.
  if (config.type === 'sphere' || config.type === 'ellipsoid') {
    const halfWidth = config.width / 2 || 1
    const halfHeight = config.height / 2 || 1
    const halfDepth = config.depth / 2 || 1
    return normalize([
      point[0] / (halfWidth * halfWidth),
      point[1] / (halfHeight * halfHeight),
      point[2] / (halfDepth * halfDepth),
    ])
  }

  if (config.type === 'cylinder' && config.roundness <= 0) {
    return normalize([
      Math.sin(longitude) / (config.width / 2 || 1),
      0,
      Math.cos(longitude) / (config.depth / 2 || 1),
    ])
  }

  if (config.type === 'diamond') {
    return normalize([
      Math.sign(point[0]) / (config.width / 2 || 1),
      Math.sign(point[1]) / (config.height / 2 || 1),
      Math.sign(point[2]) / (config.depth / 2 || 1),
    ])
  }

  return tangentNormalAt(config, longitude, latitude)
}

export const surfaceSampleAt = (
  config: SurfaceConfig,
  longitude: number,
  latitude: number
): SurfaceSample => {
  const point = surfacePointAt(config, longitude, latitude)

  if (config.type === 'sphere' || config.type === 'ellipsoid') {
    const halfWidth = config.width / 2 || 1
    const halfHeight = config.height / 2 || 1
    const halfDepth = config.depth / 2 || 1
    return {
      point,
      normal: normalize([
        point[0] / (halfWidth * halfWidth),
        point[1] / (halfHeight * halfHeight),
        point[2] / (halfDepth * halfDepth),
      ]),
    }
  }

  if (config.type === 'cylinder' && config.roundness <= 0) {
    return {
      point,
      normal: normalize([
        Math.sin(longitude) / (config.width / 2 || 1),
        0,
        Math.cos(longitude) / (config.depth / 2 || 1),
      ]),
    }
  }

  if (config.type === 'diamond') {
    return {
      point,
      normal: normalize([
        Math.sign(point[0]) / (config.width / 2 || 1),
        Math.sign(point[1]) / (config.height / 2 || 1),
        Math.sign(point[2]) / (config.depth / 2 || 1),
      ]),
    }
  }

  return {
    point,
    normal: tangentNormalAt(config, longitude, latitude),
  }
}
