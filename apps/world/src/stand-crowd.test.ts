import { describe, expect, it } from 'vitest'
import { StandCrowd, STAND_CROWD_SIZE } from './stand-crowd'
import { canStand, defaultNavigation, inPolygon, SPAWN, type Point } from './world'

function setup() {
  let seed = 42
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  const crowd = new StandCrowd(defaultNavigation, random)
  let now = 0
  const tick = (count = 0, active = true, visible: (point: Point) => boolean = () => true) => {
    now += 50
    crowd.update({
      navigation: defaultNavigation,
      realCount: count,
      local: SPAWN,
      delta: 50,
      now,
      active,
      visible,
    })
  }
  const advance = (milliseconds: number, count = 0) => {
    for (let i = 0; i < milliseconds / 50; i++) tick(count)
  }
  advance(12000)
  return { crowd, tick, advance, now: () => now }
}

describe('stand crowd', () => {
  it('fills gradually, replaces one bot per real visitor, and restores them gradually', () => {
    const { crowd, tick, advance } = setup()
    expect(crowd.remotes.size).toBe(STAND_CROWD_SIZE)
    tick(1)
    expect([...crowd.remotes.values()].filter(bot => bot.leaving)).toHaveLength(1)
    advance(1000, 1)
    expect(crowd.remotes.size).toBe(4)
    advance(1000, 5)
    expect(crowd.remotes.size).toBe(0)
    tick(0)
    expect(crowd.remotes.size).toBe(1)
    advance(12000)
    expect(crowd.remotes.size).toBe(5)
  })

  it('prefers off-screen bots for departure', () => {
    const { crowd, tick } = setup()
    const offscreen = [...crowd.remotes.values()][0]
    tick(1, true, point => point !== offscreen.pose)
    expect(offscreen.leaving).toBe(true)
  })

  it('walks only on the central island, without crossing obstacles, with varied pauses', () => {
    const { crowd, tick } = setup()
    const island = defaultNavigation.zones.find(zone => zone.id === 'land-0')!
    const central = {
      ...defaultNavigation,
      zones: defaultNavigation.zones.filter(
        zone => zone.kind === 'blocked' || zone.id === 'land-0'
      ),
    }
    let moving = 0,
      idle = 0
    for (let i = 0; i < 1800; i++) {
      const before = new Map([...crowd.remotes].map(([id, bot]) => [id, { ...bot.pose }]))
      tick()
      for (const [id, bot] of crowd.remotes) {
        expect(inPolygon(bot.pose, island.points)).toBe(true)
        expect(canStand(bot.pose, central)).toBe(true)
        const previous = before.get(id)!
        expect(Math.hypot(bot.pose.x - previous.x, bot.pose.y - previous.y)).toBeLessThan(4.1)
        if (bot.pose.moving) moving++
        else idle++
      }
    }
    expect(moving).toBeGreaterThan(100)
    expect(idle).toBeGreaterThan(100)
  })

  it('responds once with a delay to nearby emojis, with cooldown and expiry', () => {
    const { crowd, advance, now } = setup()
    const bot = [...crowd.remotes.values()][0]
    expect(crowd.react('hello', bot.pose, now())).toBe(true)
    expect(crowd.react('hello', bot.pose, now())).toBe(false)
    expect(crowd.reactions.size).toBe(1) // Only the local bubble initially.
    advance(500)
    expect(crowd.reactions.size).toBe(1)
    advance(1300)
    expect(crowd.reactions.size).toBeGreaterThan(1)
    expect(crowd.reactions.size).toBeLessThanOrEqual(3)
    advance(4000)
    expect(crowd.reactions.size).toBe(0)
  })

  it('ignores far-away reactions and never replies to its own bot bubbles', () => {
    const { crowd, advance, now } = setup()
    crowd.react('hello', { x: 0, y: 0 }, now())
    advance(2000)
    expect([...crowd.reactions.keys()]).toEqual([crowd.playerId])
    advance(5000)
    expect(crowd.reactions.size).toBe(0)
  })

  it('freezes movement during pause, retains population during reconnect, and drops stale replies', () => {
    const { crowd, advance, now } = setup()
    advance(1200, 3)
    const bot = [...crowd.remotes.values()][0]
    crowd.react('love', bot.pose, now())
    const positions = [...crowd.remotes.values()].map(bot => ({ ...bot.pose }))
    crowd.update({
      navigation: defaultNavigation,
      realCount: null,
      local: SPAWN,
      delta: 10000,
      now: now() + 10000,
      active: false,
      visible: () => true,
    })
    expect([...crowd.remotes.values()].map(bot => bot.pose)).toEqual(positions)
    crowd.update({
      navigation: defaultNavigation,
      realCount: null,
      local: SPAWN,
      delta: 16,
      now: now() + 10016,
      active: true,
      visible: () => true,
    })
    expect(crowd.remotes.size).toBe(2)
    expect(crowd.reactions.size).toBe(0)
  })

  it('handles navigation without a central island without spawning unsafe avatars', () => {
    const { crowd, now } = setup()
    crowd.update({
      navigation: { ...defaultNavigation, zones: [] },
      realCount: 0,
      local: SPAWN,
      delta: 50,
      now: now(),
      active: true,
      visible: () => true,
    })
    expect(crowd.remotes.size).toBe(0)
  })
})

it('answers a remote visitor once per event, without creating a local visitor bubble', () => {
  const { crowd, advance, now } = setup()
  const bot = [...crowd.remotes.values()][0]
  const event = { reaction: 'hello' as const, startedAt: now() }
  const events = new Map([['visitor', event]])
  crowd.observeReactions(events, () => bot.pose, now())
  advance(2000)
  expect(crowd.reactions.size).toBeGreaterThan(0)
  expect(crowd.reactions.has(crowd.playerId)).toBe(false)
  advance(6000)
  crowd.observeReactions(events, () => bot.pose, now())
  advance(2000)
  expect(crowd.reactions.size).toBe(0)
})
