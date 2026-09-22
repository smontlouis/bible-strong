import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const sockets = vi.hoisted(() => [] as any[])
vi.mock('partysocket', () => ({
  default: class extends EventTarget {
    readyState = 0
    bufferedAmount = 0
    sent: any[] = []
    reconnect = vi.fn()
    constructor() {
      super()
      sockets.push(this)
    }
    send(value: string) {
      this.sent.push(JSON.parse(value))
    }
    close() {
      this.readyState = 3
      this.dispatchEvent(new Event('close'))
    }
    open() {
      this.readyState = 1
      this.dispatchEvent(new Event('open'))
    }
    receive(message: unknown) {
      this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }))
    }
  },
}))
import { WorldMultiplayer } from './multiplayer'
const pose = { x: 836, y: 542, dx: 1, dy: 0, moving: true }
const profile = { avatar: 'nova' as const, name: 'Visitor', color: '#73cdd0' }
let network: WorldMultiplayer
let doc: EventTarget & { hidden: boolean }
beforeEach(() => {
  vi.useFakeTimers()
  sockets.length = 0
  doc = Object.assign(new EventTarget(), { hidden: false })
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', { setInterval, clearInterval })
  vi.stubGlobal('location', { host: 'localhost:8791' })
  vi.stubGlobal('WebSocket', { OPEN: 1 })
  network = new WorldMultiplayer()
})
afterEach(() => {
  network.destroy()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function join() {
  network.update(pose, profile, true, 0)
  const socket = sockets[0]
  socket.open()
  socket.receive({ type: 'welcome', id: 'local', spawn: pose, players: [] })
  network.takeSpawn()
  return socket
}
it('keeps anonymous question history across fresh clients without using it as a resume credential', () => {
  network.destroy()
  const values = new Map<string, string>()
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key),
    setItem: (key: string, value: string) => values.set(key, value),
  })
  network = new WorldMultiplayer()
  let socket = join()
  const history = socket.sent[0].gameHistoryId
  expect(history).toMatch(/^[0-9a-f-]{36}$/)
  expect(socket.sent[0].resumeToken).toBeUndefined()
  network.destroy()
  sockets.length = 0
  network = new WorldMultiplayer()
  socket = join()
  expect(socket.sent[0].gameHistoryId).toBe(history)
  expect(socket.sent[0].resumeToken).toBeUndefined()
})
it('sends a fresh join and never queues movement while disconnected', () => {
  network.update(pose, profile, true, 0)
  expect(sockets[0].sent).toHaveLength(0)
  sockets[0].open()
  expect(sockets[0].sent[0]).toMatchObject({ type: 'join', pose })
  sockets[0].receive({ type: 'welcome', id: 'local', spawn: pose, players: [] })
  network.takeSpawn()
  network.update(pose, profile, true, 100)
  sockets[0].close()
  network.update({ ...pose, x: 850 }, profile, true, 200)
  expect(sockets[0].sent).toHaveLength(3)
  sockets[0].open()
  expect(sockets[0].sent.at(-1)).toMatchObject({ type: 'join', pose: { x: 850 } })
})
it('throttles motion but sends the final stop immediately', () => {
  const socket = join()
  network.update(pose, profile, true, 100)
  network.update({ ...pose, x: 837 }, profile, true, 110)
  expect(socket.sent.filter((m: any) => m.type === 'move')).toHaveLength(1)
  network.update({ ...pose, x: 837, moving: false }, profile, true, 115)
  expect(socket.sent.at(-1)).toMatchObject({ type: 'move', pose: { x: 837, moving: false } })
})
it('retries an unsent final position after backpressure clears', () => {
  const socket = join()
  socket.bufferedAmount = 20_000
  network.update({ ...pose, moving: false }, profile, true, 100)
  expect(socket.sent).toHaveLength(2)
  socket.bufferedAmount = 0
  network.update({ ...pose, moving: false }, profile, true, 200)
  expect(socket.sent.at(-1)).toMatchObject({ type: 'move', pose: { moving: false } })
})
it('handles batched frames, departures, and clears ghosts on disconnect', () => {
  const socket = join()
  const remote = { id: 'remote', profile, pose, seq: 1 }
  socket.receive({ type: 'frame', players: [{ ...remote, id: 'local' }, remote] })
  expect(network.status).toEqual({ state: 'online', count: 2 })
  expect(network.remotes.size).toBe(1)
  socket.receive({ type: 'leave', id: 'remote' })
  expect(network.status.count).toBe(1)
  socket.close()
  expect(network.status.state).toBe('offline')
  expect(network.remotes.size).toBe(0)
})
it('keeps the same connection in the background and resumes heartbeats on return', () => {
  const socket = join()
  doc.hidden = true
  doc.dispatchEvent(new Event('visibilitychange'))
  expect(socket.readyState).toBe(1)
  expect(socket.sent.at(-1)).toEqual({ type: 'visibility', hidden: true })
  expect(socket.sent.at(-2)).toMatchObject({ type: 'move', pose: { moving: false } })
  const sent = socket.sent.length
  vi.advanceTimersByTime(90_000)
  network.update(pose, profile, true, 90_000)
  expect(socket.sent).toHaveLength(sent)
  doc.hidden = false
  doc.dispatchEvent(new Event('visibilitychange'))
  expect(sockets).toHaveLength(1)
  expect(socket.sent.at(-1)).toEqual({ type: 'ping' })
  vi.advanceTimersByTime(5000)
  expect(socket.reconnect).not.toHaveBeenCalled()
})
it('keeps editors disconnected across visibility changes', () => {
  const socket = join()
  network.update(pose, profile, false, 100)
  doc.hidden = true
  doc.dispatchEvent(new Event('visibilitychange'))
  doc.hidden = false
  doc.dispatchEvent(new Event('visibilitychange'))
  expect(socket.readyState).toBe(3)
  expect(sockets).toHaveLength(1)
})
it('resumes with the private token and continues the server movement sequence', () => {
  const socket = join()
  const resumeToken = 'a83e66e5-83a6-4ac9-a5ac-02127eb5b495'
  socket.receive({
    type: 'welcome',
    id: 'local',
    spawn: pose,
    resumeToken,
    players: [{ id: 'local', profile, pose, seq: 20 }],
  })
  // Same identity again in this page: the live position is published, continuing seq 20.
  expect(network.takeSpawn()).toBeNull()
  expect(socket.sent.at(-1)).toMatchObject({ type: 'move', seq: 21 })
  network.update({ ...pose, x: 840 }, profile, true, 100)
  expect(socket.sent.at(-1)).toMatchObject({ type: 'move', seq: 22 })
  socket.close()
  socket.open()
  expect(socket.sent.at(-1)).toMatchObject({ type: 'join', resumeToken })
})
it('does not retry a full room until explicitly requested', () => {
  const socket = join()
  socket.receive({ type: 'full' })
  network.update(pose, profile, true, 100)
  expect(network.status.state).toBe('full')
  expect(sockets).toHaveLength(1)
  network.retry()
  expect(sockets).toHaveLength(2)
})

it('applies the reserved server position before publishing any local movement', () => {
  network.update(pose, profile, true, 0)
  const socket = sockets[0]
  socket.open()
  const spawn = { ...pose, x: 720, y: 470, moving: false }
  socket.receive({ type: 'welcome', id: 'local', spawn, players: [] })
  network.update(pose, profile, true, 100)
  expect(socket.sent.filter((m: any) => m.type === 'move')).toHaveLength(0)
  expect(network.takeSpawn()).toEqual(spawn)
  expect(network.takeSpawn()).toBeNull()
  network.update(spawn, profile, true, 200)
  expect(socket.sent.at(-1)).toMatchObject({ type: 'move', pose: spawn })
})

it('persists the resume credential across client recreation in the same tab', () => {
  const data = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
  const socket = join()
  const resumeToken = 'a83e66e5-83a6-4ac9-a5ac-02127eb5b495'
  socket.receive({ type: 'welcome', id: 'local', spawn: pose, players: [], resumeToken })
  network.destroy()
  network = new WorldMultiplayer()
  network.update(pose, profile, true, 100)
  sockets[1].open()
  expect(sockets[1].sent[0]).toMatchObject({ type: 'join', resumeToken })
})
it('does not automatically reclaim a session resumed in another tab', () => {
  const socket = join()
  socket.dispatchEvent(Object.assign(new Event('close'), { code: 4001 }))
  network.update(pose, profile, true, 100)
  expect(sockets).toHaveLength(1)
  expect(socket.readyState).toBe(3)
  network.retry()
  expect(sockets).toHaveLength(2)
  sockets[1].open()
  expect(sockets[1].sent[0].resumeToken).toBeUndefined()
})

it('sends only live reactions and expires echoes without replaying after reconnection', () => {
  expect(network.sendReaction('hello')).toBe(false)
  const socket = join()
  expect(network.sendReaction('hello')).toBe(true)
  expect(socket.sent.at(-1)).toEqual({ type: 'reaction', reaction: 'hello' })
  expect(network.sendReaction('love')).toBe(false)
  socket.receive({ type: 'reaction', id: 'local', reaction: 'hello' })
  expect(network.reactions.get('local')?.reaction).toBe('hello')
  socket.receive({ type: 'reaction', id: 'unknown', reaction: 'love' })
  expect(network.reactions.size).toBe(1)
  network.expireReactions(performance.now() + 2999)
  expect(network.reactions.size).toBe(1)
  network.expireReactions(performance.now() + 3000)
  expect(network.reactions.size).toBe(0)
  socket.receive({ type: 'reaction', id: 'local', reaction: 'hello' })
  socket.close()
  expect(network.reactions.size).toBe(0)
  expect(network.sendReaction('sad')).toBe(false)
  socket.open()
  expect(socket.sent.at(-1).type).toBe('join')
})

it('clears a departing visitor’s reaction and ignores reactions in a hidden tab', () => {
  const socket = join()
  socket.receive({ type: 'player', player: { id: 'remote', profile, pose, seq: 1 } })
  socket.receive({ type: 'reaction', id: 'remote', reaction: 'bravo' })
  expect(network.reactions.get('remote')?.reaction).toBe('bravo')
  socket.receive({ type: 'leave', id: 'remote' })
  expect(network.reactions.size).toBe(0)
  doc.hidden = true
  expect(network.sendReaction('hello')).toBe(false)
  socket.receive({ type: 'reaction', id: 'local', reaction: 'hello' })
  expect(network.reactions.size).toBe(0)
})

it('sends activity changes once and restores the current activity after reconnect', () => {
  const socket = join()
  network.setActivity('book')
  network.setActivity('book')
  expect(socket.sent.filter((m: any) => m.type === 'activity')).toEqual([{ type: 'activity', activity: 'book' }])
  socket.receive({ type: 'welcome', id: 'local', spawn: pose, players: [] })
  network.setActivity('book')
  network.setActivity(null)
  expect(socket.sent.filter((m: any) => m.type === 'activity').slice(-2)).toEqual([{ type: 'activity', activity: 'book' }, { type: 'activity', activity: null }])
})

it('keeps walking through a reconnect instead of snapping back to the last server position', () => {
  const socket = join()
  network.update({ ...pose, x: 900, moving: true }, profile, true, 100)
  socket.close()
  // The visitor kept moving while offline.
  network.update({ ...pose, x: 960, moving: false }, profile, true, 5_000)
  socket.open()
  socket.receive({
    type: 'welcome',
    id: 'local',
    spawn: { ...pose, x: 900 },
    players: [{ id: 'local', profile, pose: { ...pose, x: 900 }, seq: 3 }],
  })
  expect(network.takeSpawn()).toBeNull()
  expect(socket.sent.at(-1)).toMatchObject({ type: 'move', seq: 4, pose: { x: 960 } })
})

it('stops reconnecting and asks for a reload when the room reports another protocol version', () => {
  const socket = join()
  socket.receive({ type: 'outdated' })
  expect(network.status.state).toBe('outdated')
  network.update(pose, profile, true, 1_000)
  expect(sockets).toHaveLength(1)
})
