import { describe, expect, it } from 'vitest'
import navigationJson from '../public/navigation/archipelago.json'
import { parseNavigation } from './navigation-document'
import { canStand, inPolygon, type Point } from './world'
import { centralSpawnCandidates, chooseCentralSpawn, spawnOverlaps } from './multiplayer-spawn'
const navigation = parseNavigation(navigationJson)

describe('central island arrivals', () => {
  it('only proposes walkable positions on the saved central island', () => {
    const candidates = centralSpawnCandidates(navigation)
    expect(candidates.length).toBeGreaterThan(100)
    const island = navigation.zones.find(z => z.id === 'land-0')!
    for (const p of candidates) {
      expect(inPolygon(p, island.points)).toBe(true)
      expect(canStand(p, navigation)).toBe(true)
    }
  })
  it('randomizes the position rather than always selecting the same arrival', () => {
    expect(chooseCentralSpawn(navigation, [], () => 0)).not.toEqual(
      chooseCentralSpawn(navigation, [], () => 0.9)
    )
  })
  it('never overlaps existing avatar footprints, even when crowded', () => {
    const occupied: Point[] = []
    for (let i = 0; i < 100; i++) {
      const spawn = chooseCentralSpawn(navigation, occupied, () => 0.37)
      if (!spawn) break
      expect(occupied.every(other => !spawnOverlaps(spawn, other))).toBe(true)
      occupied.push(spawn)
    }
    expect(occupied.length).toBeGreaterThan(5)
    expect(chooseCentralSpawn(navigation, occupied)).toBeNull()
    const free = occupied.pop()!
    expect(chooseCentralSpawn(navigation, occupied)).not.toBeNull()
    expect(canStand(free, navigation)).toBe(true)
  })
  it('returns no spawn if the central island is missing or fully blocked', () => {
    expect(chooseCentralSpawn({ ...navigation, zones: [] }, [])).toBeNull()
    const island = navigation.zones.find(z => z.id === 'land-0')!
    expect(
      chooseCentralSpawn(
        { ...navigation, zones: [island, { ...island, id: 'blocked', kind: 'blocked' }] },
        []
      )
    ).toBeNull()
  })
})
