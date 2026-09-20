import { WIDTH, HEIGHT } from './world'
import type { WorldView } from './map-tiles'

export const WATER_VARIANTS = ['rock', 'stones', 'rock-reeds', 'reeds'] as const
export const WATER_CELL_SIZE = 260
const CLEARANCE = 115

export type WaterDecoration = {
  key: string
  variant: (typeof WATER_VARIANTS)[number]
  x: number
  y: number
  size: number
}

// A fixed coordinate hash makes the scenery independent of camera travel and reloads.
function random(column: number, row: number, salt: number) {
  let value = Math.imul(column, 374761393) ^ Math.imul(row, 668265263) ^ salt
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296
}

export function visibleWaterDecorations(view: WorldView): WaterDecoration[] {
  const result: WaterDecoration[] = []
  const left = Math.floor(view.x / WATER_CELL_SIZE) - 1
  const top = Math.floor(view.y / WATER_CELL_SIZE) - 1
  const right = Math.floor((view.x + view.width) / WATER_CELL_SIZE) + 1
  const bottom = Math.floor((view.y + view.height) / WATER_CELL_SIZE) + 1
  for (let row = top; row <= bottom; row++) {
    for (let column = left; column <= right; column++) {
      // Most cells stay empty; jitter prevents the occupied cells looking like a grid.
      if (random(column, row, 1979) > 0.34) continue
      const x = (column + 0.25 + random(column, row, 7919) * 0.5) * WATER_CELL_SIZE
      const y = (row + 0.25 + random(column, row, 104729) * 0.5) * WATER_CELL_SIZE
      const size = 76 + random(column, row, 15485863) * 34
      const radius = size / 2
      if (
        x + radius > -CLEARANCE &&
        x - radius < WIDTH + CLEARANCE &&
        y + radius > -CLEARANCE &&
        y - radius < HEIGHT + CLEARANCE
      )
        continue
      result.push({
        key: `${column}:${row}`,
        variant: WATER_VARIANTS[Math.floor(random(column, row, 32452843) * WATER_VARIANTS.length)],
        x,
        y,
        size,
      })
    }
  }
  return result
}
