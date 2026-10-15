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
    // The pillars stand on the ground.
    expect(canStand({ x: 919, y: 508 }, navigation)).toBe(false)
    expect(canStand({ x: 963, y: 508 }, navigation)).toBe(false)
  })

  it('stands on the central plaza, opposite the app stand', () => {
    expect(nearIslandAction(WORLD_PORTAL.arrival, 'portal')).toBe(true)
    expect(nearIslandAction({ x: 725, y: 530 }, 'portal')).toBe(false)
    expect(nearIslandAction({ x: 836, y: 770 }, 'portal')).toBe(false)
  })
})
