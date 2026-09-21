import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const endpoint = process.env.WORLD_TEST_URL || 'ws://127.0.0.1:8792/parties/world-room/asi-europe'
const clients = []
const profile = { avatar: 'nova', name: 'QA visitor', color: '#73cdd0' }
const pose = { x: 836, y: 542, dx: 1, dy: 0, moving: false }
async function connect(join = true, resumeToken) {
  const ws = new WebSocket(endpoint)
  const client = { ws, messages: [], id: null, closed: null, received: 0 }
  clients.push(client)
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    client.received++
    if (message.type === 'frame') {
      for (const player of message.players)
        if (player.id !== client.id) client.messages.push({ type: 'player', player })
    } else client.messages.push(message)
    if (client.messages.length > 10000) client.messages.shift()
    if (message.type === 'welcome') client.id = message.id
  })
  ws.addEventListener('close', event => {
    client.closed = event.code
  })
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
    setTimeout(() => reject(new Error('Open timeout')), 5000).unref()
  })
  client.send = message => ws.send(JSON.stringify(message))
  if (join)
    client.send({
      type: 'join',
      version: 2,
      profile,
      pose,
      ...(resumeToken ? { resumeToken } : {}),
    })
  return client
}
async function until(predicate, label, timeout = 5000) {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error(`Timeout: ${label}`)
    await delay(10)
  }
}
try {
  const a = await connect(),
    b = await connect()
  await until(() => a.id && b.id, 'initial snapshots')
  assert.notEqual(a.id, b.id)
  const spawnA = a.messages.find(m => m.type === 'welcome').spawn
  const spawnB = b.messages.find(m => m.type === 'welcome').spawn
  assert(
    Math.abs(spawnA.x - spawnB.x) >= 70 || Math.abs(spawnA.y - spawnB.y) >= 56,
    'arrival footprints never overlap'
  )
  await until(
    () => a.messages.some(m => m.type === 'player' && m.player.id === b.id),
    'join broadcast'
  )
  assert(b.messages.find(m => m.type === 'welcome').players.some(p => p.id === a.id))
  a.send({ type: 'move', pose: { ...pose, x: 846, moving: true }, seq: 1 })
  await until(
    () =>
      b.messages.some(m => m.type === 'player' && m.player.id === a.id && m.player.pose.x === 846),
    'movement'
  )
  a.send({ type: 'profile', profile: { ...profile, avatar: 'short-slime', name: 'New name' } })
  await until(
    () => b.messages.some(m => m.type === 'player' && m.player.profile.name === 'New name'),
    'profile change'
  )
  a.send({ type: 'move', pose, seq: 1 })
  await delay(100)
  assert.equal(
    b.messages.filter(m => m.type === 'player' && m.player.id === a.id).at(-1).player.pose.x,
    846,
    'out-of-order movement ignored'
  )
  const token = a.messages.find(m => m.type === 'welcome').resumeToken
  assert(token)
  assert(!JSON.stringify(b.messages).includes(token), 'resume token is private')
  a.ws.close()
  await until(() => b.messages.some(m => m.type === 'leave' && m.id === a.id), 'leave broadcast')
  const rejoined = await connect(true, token)
  await until(() => rejoined.id, 'reconnection snapshot')
  assert.equal(rejoined.id, a.id, 'same identity after reconnect')
  assert.equal(
    rejoined.messages.find(m => m.type === 'welcome').spawn.x,
    846,
    'same position after reconnect'
  )
  const replacement = await connect(true, token)
  await until(() => replacement.id && rejoined.closed === 4001, 'replace stale connection')
  assert.equal(replacement.id, a.id)
  assert.equal(
    replacement.messages.find(m => m.type === 'welcome').players.filter(p => p.id === a.id).length,
    1,
    'no duplicate avatar'
  )
  const invalid = await connect()
  await until(() => invalid.id, 'invalid test join')
  invalid.send({ type: 'move', seq: 1, pose: { ...pose, x: -500 } })
  await until(() => invalid.closed === 4002, 'invalid coordinates rejected')
  const flood = await connect()
  await until(() => flood.id, 'flood test join')
  for (let i = 0; i < 45; i++) flood.send({ type: 'ping' })
  await until(() => flood.closed === 4009, 'message rate limit')
  for (const c of clients) c.ws.close()
  await delay(200)
  console.log(
    'PASS: snapshots, joins, movement, profile changes, stale sequences, departures, reconnect, validation, rate limits'
  )

  const arrivals = await Promise.all(Array.from({ length: 30 }, () => connect()))
  await until(
    () => arrivals.every(c => c.id || c.messages.some(m => m.type === 'full')),
    'simultaneous spawn reservations'
  )
  const spawns = arrivals.flatMap(c =>
    c.messages.filter(m => m.type === 'welcome').map(m => m.spawn)
  )
  assert(spawns.length > 5)
  for (let i = 0; i < spawns.length; i++)
    for (let j = i + 1; j < spawns.length; j++) {
      assert(
        Math.abs(spawns[i].x - spawns[j].x) >= 70 || Math.abs(spawns[i].y - spawns[j].y) >= 56,
        'simultaneous arrivals do not overlap'
      )
    }
  for (const c of arrivals) c.ws.close()
  await delay(200)
  console.log(
    `PASS: ${spawns.length} simultaneous arrivals without overlap; crowded island rejects excess arrivals`
  )

  const load = []
  for (let i = 0; i < 30; i++) {
    const c = await connect()
    await until(() => c.id, 'arrival')
    c.send({ type: 'move', seq: 1, pose: { ...pose, x: 200, y: 250 } })
    await until(() => c.messages.some(m => m.type === 'welcome'), 'load visitor')
    await delay(20)
    load.push(c)
  }
  await until(() => load.every(c => c.id), '30 visitors joined')
  for (const c of load) c.messages = []
  let seq = 1
  const start = performance.now()
  const timer = setInterval(() => {
    seq++
    for (const c of load)
      c.send({ type: 'move', seq, pose: { ...pose, moving: true, x: 836 + seq / 10 } })
  }, 1000 / 15)
  await delay(5000)
  clearInterval(timer)
  await until(
    () =>
      load.every(
        c =>
          new Set(
            c.messages
              .filter(m => m.type === 'player' && m.player.seq === seq)
              .map(m => m.player.id)
          ).size ===
          load.length - 1
      ),
    'all clients receive final positions'
  )
  assert(
    load.every(c => !c.closed),
    'load test connections remain healthy'
  )
  const delivered = load.reduce((n, c) => n + c.messages.length, 0)
  console.log(
    `PASS: 30 visitors at 15 Hz for ${((performance.now() - start) / 1000).toFixed(1)}s; ${delivered} delivered updates; all final positions received`
  )
  for (const c of load) c.ws.close()
  await delay(200)
  const capacity = []
  for (let i = 0; i < 100; i++) {
    const c = await connect()
    await until(() => c.id, 'capacity arrival')
    c.send({ type: 'move', seq: 1, pose: { ...pose, x: 200, y: 250 } })
    await delay(20)
    capacity.push(c)
  }
  await until(() => capacity.every(c => c.id), 'room capacity')
  const excess = await connect()
  await until(() => excess.messages.some(m => m.type === 'full'), 'room full feedback')
  console.log('PASS: 100-visitor room capacity; excess visitor receives full status')
} finally {
  for (const c of clients) c.ws.close()
}
