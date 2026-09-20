import { describe, expect, it } from 'vitest'
import {
  chooseMapLevel,
  mapTileManifest,
  tilePlacement,
  visibleTileCoordinates,
} from './map-tiles'

describe('progressive map tiles', () => {
  it('uses the preview for overview, 2x for normal follow and 4x for close zoom', () => {
    expect(chooseMapLevel(mapTileManifest.levels, 0.9, 1)).toBeNull()
    expect(chooseMapLevel(mapTileManifest.levels, 1.2, 2)?.scale).toBe(2)
    expect(chooseMapLevel(mapTileManifest.levels, 2, 2)?.scale).toBe(4)
  })

  it('returns only camera-adjacent tiles and clamps them to the image', () => {
    const level = mapTileManifest.levels[0]
    const tiles = visibleTileCoordinates(
      mapTileManifest,
      level,
      { x: 760, y: 380, width: 300, height: 240 },
      1
    )
    expect(tiles.length).toBeGreaterThan(4)
    expect(new Set(tiles.map(tile => `${tile.column},${tile.row}`)).size).toBe(tiles.length)
    expect(tiles.every(tile => tile.column >= 0 && tile.column < level.columns)).toBe(true)
    expect(tiles.every(tile => tile.row >= 0 && tile.row < level.rows)).toBe(true)
  })

  it('places overlapping source tiles back into canonical world coordinates', () => {
    const level = mapTileManifest.levels[0]
    expect(tilePlacement(mapTileManifest, { level, column: 0, row: 0 })).toEqual({
      x: 0,
      y: 0,
      width: 257,
      height: 257,
    })
    expect(tilePlacement(mapTileManifest, { level, column: 1, row: 1 })).toEqual({
      x: 255,
      y: 255,
      width: 258,
      height: 258,
    })
  })
})
