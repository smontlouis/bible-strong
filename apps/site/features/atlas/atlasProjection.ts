// The projection of the atlas map, the same as `scripts/build-atlas-map.py` draws its ground
// with (`public/atlas/map.svg`): an equirectangular map true to scale along the 32nd parallel.

const WEST = 8
const EAST = 54
const SOUTH = 20
const NORTH = 44
const PARALLEL = 32
const UNIT = 100

const X_SCALE = Math.cos((PARALLEL * Math.PI) / 180) * UNIT

export const ATLAS_MAP_WIDTH = Math.round((EAST - WEST) * X_SCALE)
export const ATLAS_MAP_HEIGHT = (NORTH - SOUTH) * UNIT

/** Where a place falls on the map, or nothing when it lies outside. */
export const projectAtlasPlace = (
  latitude: number,
  longitude: number
): [x: number, y: number] | undefined => {
  if (latitude < SOUTH || latitude > NORTH || longitude < WEST || longitude > EAST) return undefined
  return [
    Math.round((longitude - WEST) * X_SCALE * 10) / 10,
    Math.round((NORTH - latitude) * UNIT * 10) / 10,
  ]
}

/** The Promised Land, from the Sinai to Damascus: the window a page opens the map on. */
export const ATLAS_HOLY_LAND_VIEW = (() => {
  const [left, top] = projectAtlasPlace(33.6, 33.6) ?? [0, 0]
  const [right, bottom] = projectAtlasPlace(29.4, 37.2) ?? [0, 0]
  return { x: left, y: top, width: right - left, height: bottom - top }
})()

export const ATLAS_WHOLE_VIEW = { x: 0, y: 0, width: ATLAS_MAP_WIDTH, height: ATLAS_MAP_HEIGHT }
