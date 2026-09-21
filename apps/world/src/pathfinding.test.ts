import { describe, expect, it } from 'vitest'
import savedNavigation from '../public/navigation/archipelago.json'
import { parseNavigation } from './navigation-document'
import { Pathfinder } from './pathfinding'
import { WalkingRoute } from './walking-route'
import { canStand, findSafePosition, SPAWN, stations, type NavigationDocument, type Point, type Zone } from './world'

const rectangle = (id: string, kind: Zone['kind'], x: number, y: number, w: number, h: number): Zone => ({
  id, name: id, kind, points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
})
const document = (obstacles: Zone[] = []): NavigationDocument => ({
  version: 1, map: 'archipelago', width: 200, height: 160,
  zones: [rectangle('floor', 'allowed', 0, 0, 200, 160), ...obstacles],
})

function verifyPath(start: Point, path: Point[], navigation: NavigationDocument) {
  let previous = start
  for (const point of path) {
    const steps = Math.ceil(Math.hypot(point.x - previous.x, point.y - previous.y))
    for (let i = 0; i <= steps; i++) {
      expect(canStand({ x: previous.x + (point.x - previous.x) * i / Math.max(1, steps), y: previous.y + (point.y - previous.y) * i / Math.max(1, steps) }, navigation)).toBe(true)
    }
    previous = point
  }
}

describe('click-to-walk pathfinding', () => {
  it('walks directly across clear ground and rejects water or obstacles', () => {
    const planner = new Pathfinder(document([rectangle('table', 'blocked', 80, 60, 40, 30)]))
    expect(planner.find({ x: 20, y: 20 }, { x: 180, y: 20 })).toEqual([{ x: 180, y: 20 }])
    expect(planner.find({ x: 20, y: 20 }, { x: 100, y: 75 })).toBeNull()
    expect(planner.find({ x: 20, y: 20 }, { x: -20, y: 20 })).toBeNull()
  })

  it('routes around a wall without cutting corners, then arrives without overshoot', () => {
    const navigation = document([rectangle('wall', 'blocked', 90, 30, 20, 100)])
    const start = { x: 30, y: 80 }, goal = { x: 170, y: 80 }
    const planner = new Pathfinder(navigation)
    const path = planner.find(start, goal)!
    expect(path.length).toBeGreaterThan(1)
    verifyPath(start, path, navigation)
    const route = new WalkingRoute()
    route.points = [...path]
    let position = start
    for (let i = 0; i < 1000 && route.points.length; i++) position = route.advance(position, 1 / 60, navigation)
    expect(position.x).toBeCloseTo(goal.x)
    expect(position.y).toBeCloseTo(goal.y)
    expect(route.points).toEqual([])
    expect(route.advance(position, 1, navigation)).toEqual(position)
  })

  it('reports disconnected ground and passages narrower than the avatar', () => {
    const navigation = document([rectangle('wall', 'blocked', 90, 0, 20, 150)])
    expect(new Pathfinder(navigation).find({ x: 30, y: 80 }, { x: 170, y: 80 })).toBeNull()
  })

  it('cancels an existing route and responds to edited geometry with a new planner', () => {
    const start = { x: 30, y: 80 }, goal = { x: 170, y: 80 }
    const route = new WalkingRoute()
    route.points = new Pathfinder(document()).find(start, goal)!
    route.cancel()
    expect(route.advance(start, 1, document())).toEqual(start)
    const edited = document([rectangle('wall', 'blocked', 90, 0, 20, 160)])
    expect(new Pathfinder(edited).find(start, goal)).toBeNull()
  })

  const navigation = parseNavigation(savedNavigation)
  const planner = new Pathfinder(navigation)
  it.each(stations)('reaches $id across the actual annotated bridges', station => {
    const start = findSafePosition(SPAWN, navigation)!
    const goal = findSafePosition(station, navigation)!
    const path = planner.find(start, goal)
    expect(path, station.id).not.toBeNull()
    verifyPath(start, path!, navigation)
    const route = new WalkingRoute()
    route.points = [...path!]
    let position = start
    for (let i = 0; i < 2000 && route.points.length; i++) position = route.advance(position, 1 / 60, navigation)
    expect(position.x).toBeCloseTo(goal.x)
    expect(position.y).toBeCloseTo(goal.y)
    expect(route.points).toHaveLength(0)
  })
})
