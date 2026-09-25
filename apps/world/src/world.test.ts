import { parseNavigation } from './navigation-document'
import savedNavigation from '../public/navigation/archipelago.json'
import { defaultNavigation, stationAt, inPolygon, type NavigationDocument } from './world'
import { describe, expect, it } from 'vitest'
import { canStand, move, SPAWN, stations, detailObstacles, occluders, type Point } from './world'

describe('archipelago navigation', () => {
  it('spawns on land and blocks water and the central table', () => {
    expect(canStand(SPAWN)).toBe(true)
    expect(canStand({ x: 835, y: 470 })).toBe(false)
    expect(canStand({ x: 500, y: 450 })).toBe(false)
  })

  it('opens the ground around the half-sized table in default and saved navigation', () => {
    for (const navigation of [defaultNavigation, parseNavigation(savedNavigation)]) {
      expect(canStand({ x: 836, y: 470 }, navigation)).toBe(false)
      for (const point of [
        { x: 770, y: 470 },
        { x: 900, y: 470 },
        { x: 836, y: 506 },
      ])
        expect(canStand(point, navigation)).toBe(true)
    }
    const table = occluders.find(object => object.id === 'central-table')!
    expect([table.width, table.height]).toEqual([89, 59.5])
  })

  it('keeps diagonal speed bounded and stops when input is released', () => {
    const origin = { x: 810, y: 545 }
    const straight = move(origin, { x: 1, y: 0 }, 1 / 60)
    const diagonal = move(origin, { x: 1, y: 1 }, 1 / 60)
    expect(Math.hypot(diagonal.x - origin.x, diagonal.y - origin.y)).toBeCloseTo(
      straight.x - origin.x
    )
    expect(move(origin, { x: 0, y: 0 }, 1)).toEqual(origin)
  })

  it('blocks the app pedestal while leaving the path behind the phone open', () => {
    for (const navigation of [defaultNavigation, parseNavigation(savedNavigation)]) {
      expect(canStand({ x: 725, y: 510 }, navigation)).toBe(false)
      expect(canStand({ x: 725, y: 477 }, navigation)).toBe(true)
      expect(canStand({ x: 685, y: 510 }, navigation)).toBe(true)
      let position = { x: 685, y: 510 }
      for (let i = 0; i < 40; i++) position = move(position, { x: 1, y: 0 }, 1 / 60, navigation)
      expect(position.x).toBeLessThan(695)
      expect(canStand(position, navigation)).toBe(true)
    }
  })

  it('does not cross the central table even after a long frame', () => {
    let p = { ...SPAWN }
    for (let i = 0; i < 200; i++) p = move(p, { x: 0, y: -1 }, 0.5)
    expect(p.y).toBeGreaterThan(480)
    expect(p.y).toBeLessThan(500)
    expect(canStand(p)).toBe(true)
  })

  it('blocks every new annotated object footprint, not its rectangular image bounds', () => {
    for (const zone of detailObstacles) {
      const center = zone.points.reduce((p, [x, y]) => ({ x: p.x + x, y: p.y + y }), { x: 0, y: 0 })
      center.x /= zone.points.length
      center.y /= zone.points.length
      expect(canStand(center), zone.id).toBe(false)
    }
    const cypress = occluders.find(o => o.id === 'themes-south-cypress')!
    // Behind its foliage but well above the trunk's small ground footprint.
    expect(cypress.y).toBeLessThan(675)
    expect(canStand({ x: 161, y: 675 })).toBe(true)
  })

  it('places resource interaction markers on usable ground', () => {
    for (const station of stations) expect(canStand(station), station.id).toBe(true)
  })

  it('connects the plaza to all six resources with a blob-width route', () => {
    // Validate annotation connectivity independently of the runtime A* planner.
    const step = 6
    const queue: Point[] = [{ ...SPAWN }]
    const seen = new Set<string>([`${SPAWN.x},${SPAWN.y}`])
    const reached = new Set<string>()
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]
      for (const s of stations) if (Math.hypot(s.x - p.x, s.y - p.y) < 25) reached.add(s.id)
      for (const [dx, dy] of [
        [step, 0],
        [-step, 0],
        [0, step],
        [0, -step],
      ]) {
        const next = { x: p.x + dx, y: p.y + dy }
        const key = `${next.x},${next.y}`
        if (!seen.has(key) && canStand(next)) {
          seen.add(key)
          queue.push(next)
        }
      }
    }
    expect([...reached].sort()).toEqual(stations.map(s => s.id).sort())
  })
})

describe('island discovery', () => {
  it.each([defaultNavigation, parseNavigation(savedNavigation)])(
    'makes discovery available throughout every island, including its entrance',
    navigation => {
      for (const station of stations) {
        const island = navigation.zones.find(zone => zone.id === station.islandZoneId)!
        let covered = 0
        for (let y = 0; y < 941; y += 12) {
          for (let x = 0; x < 1671; x += 12) {
            if (!inPolygon({ x, y }, island.points)) continue
            expect(stationAt({ x, y }, navigation)?.id).toBe(station.id)
            covered++
          }
        }
        expect(covered).toBeGreaterThan(50)
      }
      expect(stationAt(SPAWN, navigation)).toBeNull()
      expect(stationAt({ x: 830, y: 320 }, navigation)).toBeNull()
      expect(stationAt({ x: 500, y: 450 }, navigation)).toBeNull()
    }
  )

  it('uses the current edited island contour', () => {
    const navigation: NavigationDocument = {
      ...defaultNavigation,
      zones: [
        {
          id: 'land-1',
          name: 'Renamed island',
          kind: 'allowed',
          points: [
            [0, 0],
            [100, 0],
            [100, 100],
            [0, 100],
          ],
        },
      ],
    }
    expect(stationAt({ x: 50, y: 50 }, navigation)?.id).toBe('dictionary')
    expect(stationAt(stations[0], navigation)).toBeNull()
  })
})
