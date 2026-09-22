// Local-only multiplayer lifecycle smoke. Add --live-ai to call the configured provider.
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

const endpoint = process.env.WORLD_TEST_URL || 'ws://127.0.0.1:8791/parties/world-room/asi-europe'
if (!['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname))
  throw new Error('Use a local test room')
const clients = []
async function until(check, label, timeout = 5000) {
  const started = Date.now()
  while (!check()) {
    if (Date.now() - started > timeout) throw new Error(`Timeout: ${label}`)
    await delay(25)
  }
}
async function connect(name, resumeToken) {
  const ws = new WebSocket(endpoint)
  const client = { ws, name, snapshot: null, welcome: null, error: null, heartbeat: null }
  clients.push(client)
  client.send = message => ws.send(JSON.stringify(message))
  client.command = async command => {
    // Exercise normal human interaction, respecting the transport rate limit.
    await delay(300)
    client.error = null
    client.send({ type: 'game', command })
  }
  ws.addEventListener('message', event => {
    const m = JSON.parse(event.data)
    if (m.type === 'welcome') client.welcome = m
    if (m.type === 'games') client.snapshot = m.snapshot
    if (m.error) client.error = m.error
  })
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  const pose = { x: 836, y: 542, dx: 0, dy: 1, moving: false }
  client.send({
    type: 'join',
    version: 2,
    profile: { name, avatar: 'nova', color: '#73cdd0' },
    pose,
    ...(resumeToken ? { resumeToken } : {}),
  })
  await until(() => client.welcome && client.snapshot, 'joined game transport')
  client.send({ type: 'move', seq: Date.now(), pose })
  client.heartbeat = setInterval(() => {
    if (ws.readyState === 1) client.send({ type: 'ping' })
  }, 5000)
  return client
}
try {
  const a = await connect('QA Games A'),
    b = await connect('QA Games B'),
    c = await connect('QA Games C'),
    d = await connect('QA Games D')
  await a.command({
    action: 'create',
    options: {
      kind: process.env.WORLD_GAME_KIND || 'who',
      difficulty: 'easy',
      language: process.env.WORLD_GAME_LANGUAGE || 'fr',
      subject: 'mixed',
      testament: 'both',
    },
  })
  await until(() => a.snapshot.game, 'create lobby')
  for (const player of [b, c, d]) {
    await a.command({ action: 'invite', target: player.welcome.id })
    await until(() => player.snapshot.invitations.length, 'private invitation')
    await player.command({ action: 'accept', invitation: player.snapshot.invitations[0].id })
    await until(() => player.snapshot.game, 'accept invitation')
  }
  assert.equal(a.snapshot.game.players.length, 4)
  await b.command({ action: 'start' })
  await until(() => b.error, 'host authority')
  assert.equal(b.error, 'not_host')
  const oldId = d.welcome.id,
    gameId = d.snapshot.game.id,
    token = d.welcome.resumeToken
  d.ws.close()
  const resumed = await connect('QA Games D', token)
  assert.equal(resumed.welcome.id, oldId)
  assert.equal(resumed.snapshot.game.id, gameId)
  assert.equal(resumed.snapshot.game.players.length, 4)
  if (process.argv.includes('--live-ai')) {
    await a.command({ action: 'start' })
    await until(() => a.snapshot.game.phase === 'generating', 'generation started')
    a.send({ type: 'move', seq: Date.now(), pose: { x: 840, y: 542, dx: 0, dy: 1, moving: false } })
    await until(() => a.snapshot.game.phase !== 'generating', 'live generation', 185_000)
    assert.equal(a.snapshot.game.phase, 'question', 'generated content must pass verification')
    b.send({ type: 'visibility', hidden: true })
    await until(() => a.snapshot.game.pausedAt !== null, 'background pause')
    const remaining = a.snapshot.game.deadline - a.snapshot.game.pausedAt
    await delay(1200)
    b.send({ type: 'visibility', hidden: false })
    await until(() => a.snapshot.game.pausedAt === null, 'foreground resume')
    assert(Math.abs(a.snapshot.game.deadline - a.snapshot.now - remaining) < 200)
    for (let round = 0; round < 5; round++) {
      assert.equal(a.snapshot.game.round, round)
      assert.equal(a.snapshot.game.result, undefined, 'answer key stays private')
      for (const player of [a, b, c, resumed]) {
        const g = player.snapshot.game
        await player.command({
          action: 'answer',
          gameId,
          round,
          ...(g.who ? { zone: g.who.zone } : {}),
          text: g.choices?.[0] || 'Je ne sais pas',
        })
      }
      await until(() => a.snapshot.game.phase === 'reveal', 'answer evaluation and reveal', 105_000)
      assert(a.snapshot.game.result.reference)
      await a.command({ action: 'next' })
      await until(() => a.snapshot.game.phase !== 'reveal', 'next round')
    }
    assert.equal(a.snapshot.game.phase, 'finished')
    console.log(
      'PASS: live AI, private questions, background pause/resume, five rounds, final scores'
    )
  } else {
    await a.command({ action: 'leave' })
    await until(() => b.snapshot.game.host === b.welcome.id, 'host transfer')
  }
  console.log('PASS: four-player lobby, invitations, host authority, session resume')
} finally {
  for (const client of clients) {
    clearInterval(client.heartbeat)
    if (client.ws.readyState === 1) client.send({ type: 'game', command: { action: 'leave' } })
    client.ws.close()
  }
}
