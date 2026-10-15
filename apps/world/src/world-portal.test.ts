import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nearIslandAction } from './island-actions'
import { parseNavigation } from './navigation-document'
import { Pathfinder } from './pathfinding'
import { canStand, defaultNavigation, SPAWN } from './world'
import { nearWorldPortal, WORLD_PORTAL } from './world-portal'

const saved = parseNavigation(
  JSON.parse(await readFile(resolve(import.meta.dirname, '../public/navigation/archipelago.json'), 'utf8'))
)

describe('the portal to Valence 1876', () => {
  it.each([
    ['default', defaultNavigation],
    ['saved', saved],
  ])('lets travellers step out in front of the arch and walk there from the plaza (%s map)', (_, navigation) => {
    expect(canStand(WORLD_PORTAL.arrival, navigation)).toBe(true)
    expect(nearWorldPortal(WORLD_PORTAL.arrival)).toBe(true)
    expect(new Pathfinder(navigation).find(SPAWN, WORLD_PORTAL.arrival)).not.toBeNull()
    // The pillars stand on the ground; the passage between them stays open.
    expect(canStand({ x: 812, y: 820 }, navigation)).toBe(false)
    expect(canStand({ x: 856, y: 820 }, navigation)).toBe(false)
    expect(canStand({ x: 833, y: 820 }, navigation)).toBe(true)
  })

  it('takes over from the comparison island only on its circle', () => {
    expect(nearIslandAction(WORLD_PORTAL.arrival, 'portal')).toBe(true)
    expect(nearIslandAction(WORLD_PORTAL.arrival, 'comparison')).toBe(false)
    expect(nearIslandAction({ x: 836, y: 770 }, 'comparison')).toBe(true)
    expect(nearIslandAction({ x: 836, y: 770 }, 'portal')).toBe(false)
  })
})
