import { describe, expect, it } from 'vitest'
import { ISLAND_ACTION_RADIUS, islandActions, nearIslandAction } from './island-actions'

describe('map action proximity', () => {
  it.each(islandActions.filter(action => action.id !== 'games'))(
    'activates $id only near its map anchor',
    action => {
      expect(nearIslandAction(action, action.id)).toBe(true)
      expect(
        nearIslandAction({ x: action.x + ISLAND_ACTION_RADIUS + 1, y: action.y }, action.id)
      ).toBe(false)
    }
  )

  it('does not activate one discovery from another island', () => {
    const dictionary = islandActions.find(action => action.id === 'dictionary')!
    expect(nearIslandAction(dictionary, 'references')).toBe(false)
  })

  it('keeps visitor notes at the east board rather than the central Bible', () => {
    expect(nearIslandAction({ x: 950, y: 420 }, 'guestbook')).toBe(true)
    for (const point of [
      { x: 836, y: 455 },
      { x: 836, y: 490 },
      { x: 885, y: 455 },
    ]) {
      expect(nearIslandAction(point, 'guestbook')).toBe(false)
    }
    expect(
      nearIslandAction({ x: 950, y: 420 }, 'guestbook', {
        version: 1,
        map: 'archipelago',
        width: 1671,
        height: 941,
        zones: [],
      })
    ).toBe(false)
  })

  it('opens the story at the central book but not from the northern bridge', () => {
    expect(nearIslandAction({ x: 836, y: 495 }, 'story')).toBe(true)
    expect(nearIslandAction({ x: 836, y: 315 }, 'story')).toBe(false)
    expect(nearIslandAction({ x: 950, y: 420 }, 'story')).toBe(false)
  })
})
