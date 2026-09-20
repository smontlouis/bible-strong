import { describe, expect, it } from 'vitest'
import { canStand, move, SPAWN, stations, detailObstacles, occluders, type Point } from './world'

describe('archipelago navigation', () => {
  it('spawns on land and blocks water and the central table', () => {
    expect(canStand(SPAWN)).toBe(true)
    expect(canStand({ x: 835, y: 470 })).toBe(false)
    expect(canStand({ x: 500, y: 450 })).toBe(false)
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

  it('does not cross the central table even after a long frame', () => {
    let p = { ...SPAWN }
    for (let i = 0; i < 200; i++) p = move(p, { x: 0, y: -1 }, 0.5)
    expect(p.y).toBeGreaterThan(510)
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
    // Flood fill is a validation of annotations only; runtime has no click/pathfinding.
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
