import { describe, expect, it } from 'vitest'
import navigationJson from '../public/navigation/archipelago.json'
import { parseNavigation } from './navigation-document'
import { canStand, defaultNavigation, inPolygon } from './world'
import { centralSpawnCandidates, chooseCentralSpawn } from './multiplayer-spawn'
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
    expect(chooseCentralSpawn(navigation, () => 0)).not.toEqual(
      chooseCentralSpawn(navigation, () => 0.9)
    )
  })
  it('keeps arrivals inside the paving circle and off the table in both navigation sources', () => {
    for (const document of [navigation, defaultNavigation]) {
      const candidates = centralSpawnCandidates(document)
      expect(candidates.length).toBeGreaterThan(100)
      for (const point of candidates) {
        expect(((point.x - 835) / 136) ** 2 + ((point.y - 458) / 74) ** 2).toBeLessThanOrEqual(1)
        expect(canStand(point, document)).toBe(true)
        expect(Math.abs(point.x - 836) < 35 && Math.abs(point.y - 460) < 15).toBe(false)
      }
      expect(candidates.some(point => point.y > 520)).toBe(true)
      expect(candidates.some(point => point.y < 410)).toBe(true)
    }
  })
  it('allows 100 arrivals at the same position', () => {
    const first = chooseCentralSpawn(navigation, () => 0.37)
    expect(first).not.toBeNull()
    for (let i = 0; i < 100; i++) {
      expect(chooseCentralSpawn(navigation, () => 0.37)).toEqual(first)
    }
  })
  it('returns no spawn if the central island is missing or fully blocked', () => {
    expect(chooseCentralSpawn({ ...navigation, zones: [] })).toBeNull()
    const island = navigation.zones.find(z => z.id === 'land-0')!
    expect(
      chooseCentralSpawn(
        { ...navigation, zones: [island, { ...island, id: 'blocked', kind: 'blocked' }] }
      )
    ).toBeNull()
  })
})
