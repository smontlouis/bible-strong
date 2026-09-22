import { expect, it } from 'vitest'
import { GAME_STATION, GAME_STATION_RADIUS, nearGameStation } from './game-station'
import { defaultNavigation, type NavigationDocument } from './world'

it('requires both central-island membership and the terminal proximity radius', () => {
  const { x, y } = GAME_STATION
  // The sprite origin need not be walkable. Isolate radius/membership behavior
  // from the fallback map polygons, which are not the live navigation document.
  const navigation: NavigationDocument = {
    ...defaultNavigation,
    zones: [
      {
        id: 'land-0',
        name: 'Central island fixture',
        kind: 'allowed',
        points: [
          [x - 100, y - 10],
          [x + 100, y - 10],
          [x + 100, y + 100],
          [x - 100, y + 100],
        ],
      },
    ],
  }
  expect(nearGameStation({ x, y }, navigation)).toBe(true)
  expect(nearGameStation({ x: x + GAME_STATION_RADIUS, y }, navigation)).toBe(true)
  expect(nearGameStation({ x: x + GAME_STATION_RADIUS + 1, y }, navigation)).toBe(false)
  expect(nearGameStation({ x, y: y - 20 }, navigation)).toBe(false)
  expect(nearGameStation({ x: 1000, y: 500 }, navigation)).toBe(false)
})
