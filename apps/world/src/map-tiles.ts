import manifestJson from './generated/map-tiles.json'

export type MapTileLevel = {
  scale: number
  width: number
  height: number
  columns: number
  rows: number
}
export type MapTileManifest = {
  version: number
  worldWidth: number
  worldHeight: number
  tileSize: number
  overlap: number
  format: string
  levels: MapTileLevel[]
}
export type TileCoordinate = { level: MapTileLevel; column: number; row: number }
export type WorldView = { x: number; y: number; width: number; height: number }

export const mapTileManifest = manifestJson as MapTileManifest

export function chooseMapLevel(
  levels: MapTileLevel[],
  zoom: number,
  rendererResolution: number
): MapTileLevel | null {
  const density = zoom * rendererResolution
  if (density <= 1.25) return null
  return levels.reduce((best, level) =>
    Math.abs(Math.log2(level.scale / density)) < Math.abs(Math.log2(best.scale / density))
      ? level
      : best
  )
}

export function visibleTileCoordinates(
  manifest: MapTileManifest,
  level: MapTileLevel,
  view: WorldView,
  padding = 1
): TileCoordinate[] {
  const left = Math.max(0, Math.floor((view.x * level.scale) / manifest.tileSize) - padding)
  const top = Math.max(0, Math.floor((view.y * level.scale) / manifest.tileSize) - padding)
  const right = Math.min(
    level.columns - 1,
    Math.floor(((view.x + view.width) * level.scale - 0.001) / manifest.tileSize) + padding
  )
  const bottom = Math.min(
    level.rows - 1,
    Math.floor(((view.y + view.height) * level.scale - 0.001) / manifest.tileSize) + padding
  )
  const result: TileCoordinate[] = []
  for (let row = top; row <= bottom; row++)
    for (let column = left; column <= right; column++) result.push({ level, column, row })
  return result
}

export function tilePlacement(manifest: MapTileManifest, tile: TileCoordinate) {
  const { level, column, row } = tile
  const coreLeft = column * manifest.tileSize
  const coreTop = row * manifest.tileSize
  const left = Math.max(0, coreLeft - manifest.overlap)
  const top = Math.max(0, coreTop - manifest.overlap)
  const right = Math.min(level.width, coreLeft + manifest.tileSize + manifest.overlap)
  const bottom = Math.min(level.height, coreTop + manifest.tileSize + manifest.overlap)
  return {
    x: left / level.scale,
    y: top / level.scale,
    width: (right - left) / level.scale,
    height: (bottom - top) / level.scale,
  }
}

/** Request the final arrival framing rather than each intermediate zoom level. */
export function arrivalTileTarget(
  viewport: { width: number; height: number },
  zoom: number,
  position: { x: number; y: number },
  rendererResolution: number
): { zoom: number; view: WorldView } {
  const width = viewport.width / zoom
  const height = viewport.height / zoom
  return {
    zoom,
    view: {
      x: Math.max(0, Math.min(mapTileManifest.worldWidth - width, position.x - width / 2)),
      y: Math.max(
        0,
        Math.min(
          mapTileManifest.worldHeight - height,
          position.y - (38 * rendererResolution) / zoom - height / 2
        )
      ),
      width,
      height,
    },
  }
}
