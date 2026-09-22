import { expect, it } from 'vitest'
import { GAME_STATION, GAME_STATION_RADIUS, nearGameStation } from './game-station'
it('offers games near the terminal on the central island, excluding the northern bridge and distant shore', () => {
  expect(nearGameStation(GAME_STATION)).toBe(true)
  expect(nearGameStation({ x: GAME_STATION.x + GAME_STATION_RADIUS, y: GAME_STATION.y })).toBe(true)
  expect(nearGameStation({ x: GAME_STATION.x + GAME_STATION_RADIUS + 1, y: GAME_STATION.y })).toBe(
    false
  )
  expect(nearGameStation({ x: 835, y: 305 })).toBe(false)
  expect(nearGameStation({ x: 1000, y: 500 })).toBe(false)
})
