vi.mock('./games/catalogue', () => ({ GameCatalogue: class {} }))
vi.mock('./games/room', () => ({
  WorldGames: class {
    presence() {}
    command() {}
    tick() {
      return null
    }
  },
}))
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('./guestbook', () => ({ Guestbook: class {}, routeGuestbook: vi.fn() }))
vi.mock('partyserver', () => ({
  Server: class {
    constructor(
      public ctx: any,
      public env: any
    ) {}
    getConnections() {
      return this.env.connections.values()
    }
    broadcast(raw: string, exclude: string[] = []) {
      for (const c of this.env.connections.values())
        if (c.readyState === 1 && !exclude.includes(c.id)) c.send(raw)
    }
  },
  routePartykitRequest: vi.fn(),
}))
import { WorldRoom } from './index'
const profile = { avatar: 'nova', name: 'Visitor', color: '#73cdd0' }
const pose = { x: 200, y: 250, dx: 1, dy: 0, moving: false }
let room: WorldRoom
let connections: Map<string, any>
let saved: Map<string, any>
let alarm: number | null
async function send(c: any, message: unknown) {
  await room.onMessage(c, JSON.stringify(message))
}
async function join(resumeToken?: string) {
  const c: any = {
    id: crypto.randomUUID(),
    readyState: 1,
    state: null,
    messages: [],
    setState(state: unknown) {
      this.state = structuredClone(state)
    },
    send(raw: string) {
      this.messages.push(JSON.parse(raw))
    },
    close(code: number) {
      this.readyState = 3
      this.code = code
      room.onClose(this)
      connections.delete(this.id)
    },
  }
  connections.set(c.id, c)
  await room.onConnect(c)
  await send(c, { type: 'join', version: 2, profile, pose, resumeToken })
  return c
}
beforeEach(() => {
  vi.useFakeTimers()
  connections = new Map()
  saved = new Map()
  alarm = null
  const ctx = {
    blockConcurrencyWhile: (fn: () => unknown) => fn(),
    waitUntil: (_: unknown) => {},
    storage: {
      getAlarm: async () => alarm,
      setAlarm: async (value: number) => {
        alarm = value
      },
      get: async (key: string) => saved.get(key),
      put: async (key: string | Record<string, unknown>, value?: unknown) => {
        const entries = typeof key === 'string' ? { [key]: value } : key
        for (const [k, v] of Object.entries(entries)) saved.set(k, structuredClone(v))
      },
      delete: async (key: string | string[]) => {
        for (const k of [key].flat()) saved.delete(k)
      },
      list: async () => new Map(saved),
    },
  }
  room = new WorldRoom(ctx as never, { connections } as never)
})
afterEach(() => {
  vi.useRealTimers()
})
it('retains hidden sessions past heartbeat expiry, then checks heartbeats when visible again', async () => {
  const c = await join()
  const id = c.state.player.id
  await send(c, { type: 'visibility', hidden: true })
  vi.advanceTimersByTime(5 * 60_000)
  await room.onAlarm()
  expect(c.readyState).toBe(1)
  expect(c.state.player.id).toBe(id)
  await send(c, { type: 'visibility', hidden: false })
  vi.advanceTimersByTime(46_000)
  await room.onAlarm()
  expect(c.code).toBe(4000)
})
it('restores identity, position and movement sequence after a disconnect and room recreation', async () => {
  const c = await join()
  const { id } = c.state.player
  const token = c.state.resumeToken
  await send(c, { type: 'move', pose, seq: 42 })
  c.close(1000)
  room = new WorldRoom((room as any).ctx, { connections } as never)
  const next = await join(token)
  expect(next.state.player).toMatchObject({ id, pose, seq: 43 })
  // The snapshot is kept while connected, so an unclean shutdown still resumes this identity.
  expect(saved.get(`resume:${token}`).player).toMatchObject({ id, seq: 43 })
  await send(next, { type: 'move', pose: { ...pose, x: 220 }, seq: 44 })
  expect(next.state.player.pose.x).toBe(220)
})
it('replaces a still-open transport without duplicate avatars or leaking the resume token', async () => {
  const c = await join()
  const observer = await join()
  const token = c.state.resumeToken
  const id = c.state.player.id
  const next = await join(token)
  expect(c.code).toBe(4001)
  expect(next.state.player.id).toBe(id)
  expect([...connections.values()].filter(c => c.state.player?.id === id)).toHaveLength(1)
  expect(JSON.stringify(observer.messages)).not.toContain(token)
  expect(observer.messages.some((m: any) => m.type === 'leave' && m.id === id)).toBe(false)
  expect(saved.get(`resume:${token}`).player.id).toBe(id)
})
it('expires abandoned sessions after 24 hours and refuses to restore expired credentials', async () => {
  const c = await join()
  const id = c.state.player.id
  const token = c.state.resumeToken
  c.close(1000)
  vi.advanceTimersByTime(24 * 60 * 60_000 + 1)
  const next = await join(token)
  expect(next.state.player.id).not.toBe(id)
  next.close(1000)
  vi.advanceTimersByTime(24 * 60 * 60_000 + 1)
  await room.onAlarm()
  expect(saved.size).toBe(0)
})

it('broadcasts reactions with the authenticated sender identity and throttles across hibernation', async () => {
  const sender = await join()
  const observer = await join()
  await send(sender, { type: 'reaction', reaction: 'love', id: observer.state.player.id })
  const expected = { type: 'reaction', reaction: 'love', id: sender.state.player.id }
  expect(sender.messages.at(-1)).toEqual(expected)
  expect(observer.messages.at(-1)).toEqual(expected)
  room = new WorldRoom((room as any).ctx, { connections } as never)
  await send(sender, { type: 'reaction', reaction: 'laugh' })
  expect(observer.messages.filter((m: any) => m.type === 'reaction')).toHaveLength(1)
  vi.advanceTimersByTime(1500)
  await send(sender, { type: 'reaction', reaction: 'bravo' })
  expect(observer.messages.at(-1)).toEqual({ ...expected, reaction: 'bravo' })
  const newcomer = await join()
  expect(newcomer.messages.some((m: any) => m.type === 'reaction')).toBe(false)
  await send(sender, { type: 'visibility', hidden: true })
  vi.advanceTimersByTime(1500)
  await send(sender, { type: 'reaction', reaction: 'sad' })
  expect(observer.messages.filter((m: any) => m.type === 'reaction')).toHaveLength(2)
})

it('rejects unknown reactions instead of broadcasting arbitrary image paths', async () => {
  const sender = await join()
  const observer = await join()
  await send(sender, { type: 'reaction', reaction: '/untrusted.png' })
  expect(sender.code).toBe(4002)
  expect(observer.messages.some((m: any) => m.type === 'reaction')).toBe(false)
})

it('shares current activity with newcomers and clears it for existing visitors', async () => {
  const a = await join()
  await send(a, { type: 'activity', activity: 'game' })
  const b = await join()
  expect(b.messages.find((m: any) => m.type === 'welcome').players.find((p: any) => p.id === a.state.player.id).activity).toBe('game')
  await send(a, { type: 'activity', activity: null })
  await vi.advanceTimersByTimeAsync(100)
  expect(b.messages.filter((m: any) => m.type === 'frame').at(-1).players.find((p: any) => p.id === a.state.player.id).activity).toBeNull()
})

it('counts refused game commands toward the message rate limit', async () => {
  const c = await join()
  for (let i = 0; i < 45; i++) await send(c, { type: 'game', command: { action: 'sync' } })
  expect(c.code).toBe(4009)
})

it('tells an outdated page to reload instead of letting it reconnect forever', async () => {
  const c: any = await join()
  const stale: any = {
    ...c,
    id: crypto.randomUUID(),
    readyState: 1,
    state: null,
    messages: [],
    code: undefined,
  }
  connections.set(stale.id, stale)
  await room.onConnect(stale)
  await send(stale, { type: 'join', version: 1, profile, pose })
  expect(stale.messages.at(-1)).toEqual({ type: 'outdated' })
  expect(stale.code).toBe(4003)
})

it('expires sockets that never join even while they keep pinging', async () => {
  const c: any = {
    id: crypto.randomUUID(),
    readyState: 1,
    state: null,
    messages: [],
    setState(state: unknown) {
      this.state = structuredClone(state)
    },
    send(raw: string) {
      this.messages.push(JSON.parse(raw))
    },
    close(code: number) {
      this.readyState = 3
      this.code = code
      room.onClose(this)
      connections.delete(this.id)
    },
  }
  connections.set(c.id, c)
  await room.onConnect(c)
  for (let i = 0; i < 3; i++) {
    vi.advanceTimersByTime(5_000)
    await send(c, { type: 'ping' })
  }
  await room.onAlarm()
  expect(c.code).toBe(4000)
})

it('releases a hidden avatar after 30 minutes without news and keeps its identity resumable', async () => {
  const c = await join()
  const id = c.state.player.id
  const token = c.state.resumeToken
  await send(c, { type: 'visibility', hidden: true })
  vi.advanceTimersByTime(30 * 60_000 + 1)
  await room.onAlarm()
  expect(c.code).toBe(4000)
  const next = await join(token)
  expect(next.state.player.id).toBe(id)
})

it('refreshes resume snapshots of moving visitors on each alarm', async () => {
  const c = await join()
  const token = c.state.resumeToken
  await send(c, { type: 'move', pose: { ...pose, x: 300 }, seq: 5 })
  await room.onAlarm()
  expect(saved.get(`resume:${token}`).player.pose.x).toBe(300)
})

it('keeps the reaction cooldown across a resumed connection', async () => {
  const sender = await join()
  const observer = await join()
  const token = sender.state.resumeToken
  await send(sender, { type: 'reaction', reaction: 'love' })
  sender.close(1000)
  const again = await join(token)
  await send(again, { type: 'reaction', reaction: 'laugh' })
  expect(observer.messages.filter((m: any) => m.type === 'reaction')).toHaveLength(1)
})

it('never sends presence to sockets that have not joined', async () => {
  const lurker: any = {
    id: crypto.randomUUID(),
    readyState: 1,
    state: null,
    messages: [],
    setState(state: unknown) {
      this.state = structuredClone(state)
    },
    send(raw: string) {
      this.messages.push(JSON.parse(raw))
    },
    close() {},
  }
  connections.set(lurker.id, lurker)
  await room.onConnect(lurker)
  const c = await join()
  await send(c, { type: 'move', pose: { ...pose, x: 320 }, seq: 2 })
  vi.advanceTimersByTime(60)
  expect(lurker.messages).toEqual([])
})
