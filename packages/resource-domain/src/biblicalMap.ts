// The map of the places of the Bible, shared by the atlas of the public site and the application
// (ADR-0091): one projection, the windows a map opens on, and how names are placed on it. Its
// ground (land, lakes, rivers) is drawn by `apps/site/scripts/build-atlas-map.py` in the same
// coordinates.

const WEST = 8
const EAST = 54
const SOUTH = 20
const NORTH = 44
const PARALLEL = 32
const UNIT = 100

const X_SCALE = Math.cos((PARALLEL * Math.PI) / 180) * UNIT

/** The drawing, in map units: an equirectangular map true to scale along the 32nd parallel. */
export const BIBLICAL_MAP_WIDTH = Math.round((EAST - WEST) * X_SCALE)
export const BIBLICAL_MAP_HEIGHT = (NORTH - SOUTH) * UNIT

/** A window on the map, in map units. */
export type BiblicalMapView = { x: number; y: number; width: number; height: number }

/**
 * Where a place falls on the map, or nothing when it lies outside or its position is unknown:
 * the entity publication writes a latitude of 0 for a place it cannot locate.
 */
export const projectBiblicalPlace = (
  latitude: number,
  longitude: number
): [x: number, y: number] | undefined => {
  if (latitude === 0) return undefined
  if (latitude < SOUTH || latitude > NORTH || longitude < WEST || longitude > EAST) return undefined
  return [
    Math.round((longitude - WEST) * X_SCALE * 10) / 10,
    Math.round((NORTH - latitude) * UNIT * 10) / 10,
  ]
}

/** The Promised Land, from the Sinai to Damascus. */
export const BIBLICAL_MAP_HOLY_LAND: BiblicalMapView = (() => {
  const [left, top] = projectBiblicalPlace(33.6, 33.6) ?? [0, 0]
  const [right, bottom] = projectBiblicalPlace(29.4, 37.2) ?? [0, 0]
  return { x: left, y: top, width: right - left, height: bottom - top }
})()

export const BIBLICAL_MAP_WHOLE: BiblicalMapView = {
  x: 0,
  y: 0,
  width: BIBLICAL_MAP_WIDTH,
  height: BIBLICAL_MAP_HEIGHT,
}

/** The closest a map zooms: about a degree of longitude across. */
export const BIBLICAL_MAP_MIN_WIDTH = 90

/** A view framing a region at the given aspect (height over width), with no part left out. */
export const fitBiblicalMapView = (region: BiblicalMapView, aspect: number): BiblicalMapView => {
  const width = Math.max(region.width, region.height / aspect)
  const height = width * aspect
  return {
    x: region.x + region.width / 2 - width / 2,
    y: region.y + region.height / 2 - height / 2,
    width,
    height,
  }
}

/** Keeps a view inside the map, at its aspect, between the closest zoom and the whole map. */
export const clampBiblicalMapView = (view: BiblicalMapView, aspect: number): BiblicalMapView => {
  const width = Math.min(Math.max(view.width, BIBLICAL_MAP_MIN_WIDTH), BIBLICAL_MAP_WIDTH)
  const height = width * aspect
  const x = Math.min(Math.max(view.x, -width * 0.25), BIBLICAL_MAP_WIDTH - width * 0.75)
  const y = Math.min(Math.max(view.y, -height * 0.25), BIBLICAL_MAP_HEIGHT - height * 0.75)
  return { x, y, width, height }
}

/** The region several places cover, with a margin around them; a single place keeps its surroundings. */
export const biblicalMapBounds = (
  points: readonly { x: number; y: number }[],
  minimumWidth = 260
): BiblicalMapView | undefined => {
  if (!points.length) return undefined
  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const left = Math.min(...xs)
  const top = Math.min(...ys)
  const width = Math.max(Math.max(...xs) - left, minimumWidth)
  const height = Math.max(Math.max(...ys) - top, minimumWidth * 0.6)
  const centreX = (left + Math.max(...xs)) / 2
  const centreY = (top + Math.max(...ys)) / 2
  return {
    x: centreX - (width * 1.3) / 2,
    y: centreY - (height * 1.3) / 2,
    width: width * 1.3,
    height: height * 1.3,
  }
}

/** A place as a map draws it. */
export type BiblicalMapPlace = {
  uniqueName: string
  name: string
  x: number
  y: number
  /** How many chapters name it: the more, the sooner its name shows. */
  chapterCount: number
  /** Its painting, when it has one. */
  picture?: string
}

/**
 * Which names a map writes. Names are placed from the place in focus and the most named down; a
 * name that would cover one already placed, or a painting other than its own place's, is left
 * out and shows once the map is close enough to part them.
 */
export const placeBiblicalMapLabels = ({
  places,
  unit,
  focus,
  thumbRadius,
  fontSize = 12,
}: {
  places: readonly BiblicalMapPlace[]
  /** Map units per screen point: names keep their size whatever the zoom. */
  unit: number
  focus?: string
  /** The radius, in screen points, of a place drawn with its painting; nothing for a dot. */
  thumbRadius: (place: BiblicalMapPlace) => number | undefined
  fontSize?: number
}): Set<string> => {
  type Box = [left: number, top: number, right: number, bottom: number, owner: string]
  const placed: Box[] = []
  for (const place of places) {
    const radius = thumbRadius(place)
    if (radius === undefined) continue
    const size = (radius + 1) * unit
    placed.push([place.x - size, place.y - size, place.x + size, place.y + size, place.uniqueName])
  }
  const labelled = new Set<string>()
  const byFame = [...places].sort(
    (left, right) =>
      Number(right.uniqueName === focus) - Number(left.uniqueName === focus) ||
      right.chapterCount - left.chapterCount
  )
  for (const place of byFame) {
    const size = (place.uniqueName === focus ? fontSize + 2 : fontSize) * unit
    const width = place.name.length * size * 0.56
    const radius = thumbRadius(place)
    const top = place.y + (radius !== undefined ? radius + 13 : 15) * unit - size
    const box: Box = [
      place.x - width / 2,
      top,
      place.x + width / 2,
      top + size * 1.3,
      place.uniqueName,
    ]
    const covers = placed.some(
      other =>
        other[4] !== place.uniqueName &&
        box[0] < other[2] &&
        box[2] > other[0] &&
        box[1] < other[3] &&
        box[3] > other[1]
    )
    if (covers) continue
    placed.push(box)
    labelled.add(place.uniqueName)
  }
  return labelled
}
