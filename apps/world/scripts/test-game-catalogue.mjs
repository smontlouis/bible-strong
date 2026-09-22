// Local-only real Worker/SQLite smoke. All answers come from the local editorial
// files in this test process; no test endpoint or answer key is added to the Worker.
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
const endpoint = process.env.WORLD_TEST_URL || 'ws://127.0.0.1:8791/parties/world-room/asi-europe'
assert(['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname), 'Local smoke only')
const load = async directory =>
  (
    await Promise.all(
      (await readdir(new URL(`../${directory}/`, import.meta.url)))
        .filter(name => name.endsWith('.json'))
        .map(async name =>
          JSON.parse(await readFile(new URL(`../${directory}/${name}`, import.meta.url), 'utf8'))
        )
    )
  ).flat()
const questions = await load('question-bank'),
  identities = await load('who-bank')
const clients = []
const historyId = crypto.randomUUID()
async function until(check, label, timeout = 6000) {
  const started = Date.now()
  while (!check()) {
    if (Date.now() - started > timeout) throw new Error(`Timeout: ${label}`)
    await delay(20)
  }
}
async function connect(name, history = crypto.randomUUID(), resumeToken) {
  const ws = new WebSocket(endpoint)
  const client = { ws, history, welcome: null, snapshot: null, error: null }
  clients.push(client)
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
  client.send = message => ws.send(JSON.stringify(message))
  client.command = async command => {
    await delay(280)
    client.error = null
    client.send({ type: 'game', command })
  }
  client.send({
    type: 'join',
    version: 2,
    profile: { name, avatar: 'nova', color: '#73cdd0' },
    pose: { x: 836, y: 542, dx: 0, dy: 1, moving: false },
    gameHistoryId: history,
    ...(resumeToken ? { resumeToken } : {}),
  })
  await until(() => client.welcome && client.snapshot, 'welcome')
  client.send({
    type: 'move',
    seq: Date.now(),
    pose: { x: 836, y: 542, dx: 0, dy: 1, moving: false },
  })
  client.heartbeat = setInterval(
    () => client.ws.readyState === 1 && client.send({ type: 'ping' }),
    5000
  )
  return client
}
const options = (kind, language = 'fr', mode = 'together') => ({
  kind,
  language,
  mode,
  difficulty: 'easy',
  testament: 'both',
  subject: 'mixed',
})
function answerFor(game) {
  const lang = game.options.language
  const entry =
    game.options.kind === 'who'
      ? identities.find(q => q.clues[0][lang] === game.clues[0])
      : questions.find(q => q[lang].question === game.question)
  assert(entry, 'Question comes from the curated catalogue')
  assert.equal(game.result, undefined)
  assert.equal(game.choices, undefined, 'New quiz questions use free text at every difficulty')
  assert.equal(game.answer, undefined)
  assert.equal(game.catalogueId, undefined)
  assert.equal(game.sources, undefined, 'Sources are revealed with the answer')
  if (game.options.kind === 'who') assert.equal(game.clues.length, 1)
  return entry[lang].answer
}
async function start(client) {
  const began = Date.now()
  await client.command({ action: 'start' })
  await until(
    () => client.snapshot.game.phase === 'question' || client.snapshot.game.reason,
    'catalogue selection'
  )
  assert.equal(client.snapshot.game.phase, 'question', client.error || client.snapshot.game.reason)
  console.log(`Catalogue batch ready in ${Date.now() - began}ms`)
}
async function close(client) {
  clearInterval(client.heartbeat)
  client.ws.close()
}
try {
  let solo = await connect('Catalogue Solo', historyId)
  await solo.command({ action: 'create', options: options('quiz', 'fr', 'solo') })
  await until(() => solo.snapshot.game?.phase === 'lobby', 'solo lobby')
  await start(solo)
  const firstQuestions = new Set()
  // Pause and resume the real persisted question after a transport replacement.
  await solo.command({ action: 'pause-solo' })
  await until(() => solo.snapshot.game.solo.pauses.includes('menu'), 'solo pause')
  const saved = solo.snapshot.game,
    token = solo.welcome.resumeToken
  await close(solo)
  await delay(100)
  solo = await connect('Catalogue Solo', historyId, token)
  assert.equal(solo.snapshot.game.id, saved.id)
  assert.equal(solo.snapshot.game.question, saved.question)
  assert.equal(solo.snapshot.game.solo.remainingMs, saved.solo.remainingMs)
  await solo.command({ action: 'resume-solo' })
  for (let i = 0; i < 5; i++) {
    const game = solo.snapshot.game
    answerFor(game)
    assert(!firstQuestions.has(game.question))
    firstQuestions.add(game.question)
    await solo.command({ action: 'pass', gameId: game.id, round: game.round })
    await until(
      () => solo.snapshot.game.phase === 'question' && solo.snapshot.game.round === i + 1,
      'automatic next question'
    )
  }
  assert(!firstQuestions.has(solo.snapshot.game.question))
  for (let i = 0; i < 4; i++) {
    const game = solo.snapshot.game,
      text = answerFor(game)
    await solo.command({ action: 'answer', gameId: game.id, round: game.round, text })
    await until(() => solo.snapshot.game.solo.streak === i + 1, 'exact solo answer')
    if (i < 3) {
      assert.equal(solo.snapshot.game.phase, 'question')
      assert.equal(solo.snapshot.game.round, game.round + 1)
      assert.equal(solo.snapshot.game.soloReview, undefined)
      assert.equal(solo.snapshot.game.solo.runningSince !== null, true)
    }
  }
  assert.equal(solo.snapshot.game.solo.streak, 4)
  assert.equal(solo.snapshot.game.phase, 'finished')
  assert.equal(solo.snapshot.game.soloReview.length, 9)
  assert.deepEqual(
    solo.snapshot.game.soloReview.map(item => item.status),
    [...Array(5).fill('skipped'), ...Array(4).fill('correct')]
  )
  assert(
    solo.snapshot.game.soloReview.every(item => item.sources.length && item.answer && item.question)
  )
  await solo.command({ action: 'leave' })
  await close(solo)
  for (const [kind, size, language] of [
    ['quiz', 2, 'fr'],
    ['who', 2, 'en'],
    ['who', 4, 'fr'],
  ]) {
    const group = []
    for (let i = 0; i < size; i++)
      group.push(await connect(`Catalogue ${kind} ${i}`, i === 0 ? historyId : undefined))
    const host = group[0]
    await host.command({ action: 'create', options: options(kind, language) })
    await until(() => host.snapshot.game?.phase === 'lobby', 'multiplayer lobby')
    for (const other of group.slice(1)) {
      await host.command({ action: 'invite', target: other.welcome.id })
      await until(() => other.snapshot.invitations.length, 'invite')
      await other.command({ action: 'accept', invitation: other.snapshot.invitations[0].id })
      await until(() => other.snapshot.game?.id === host.snapshot.game.id, 'accept')
    }
    await start(host)
    if (kind === 'quiz')
      assert(
        !firstQuestions.has(host.snapshot.game.question),
        'History survives a new avatar session'
      )
    group[1].send({ type: 'visibility', hidden: true })
    await until(() => host.snapshot.game.pausedAt !== null, 'multiplayer background pause')
    group[1].send({ type: 'visibility', hidden: false })
    await until(() => host.snapshot.game.pausedAt === null, 'multiplayer resume')
    for (let round = 0; round < 5; round++) {
      const game = host.snapshot.game,
        text = answerFor(game)
      const answering =
        kind === 'quiz' ? group : [group.find(c => game.who.eligible.includes(c.welcome.id))]
      for (const player of answering)
        await player.command({
          action: 'answer',
          gameId: game.id,
          round,
          text,
          ...(game.who ? { zone: game.who.zone } : {}),
        })
      await until(() => host.snapshot.game.phase === 'reveal', 'exact multiplayer reveal')
      assert.equal(host.snapshot.game.result.answer, text)
      assert.equal(host.snapshot.game.result.void, false)
      assert.equal(host.snapshot.game.result.sources.length, kind === 'who' ? 4 : 1)
      await host.command({ action: 'next' })
      await until(
        () => host.snapshot.game.phase === (round === 4 ? 'finished' : 'question'),
        'multiplayer next'
      )
    }
    if (kind === 'quiz') assert(group.every(c => c.snapshot.game.players.every(p => p.score === 5)))
    else
      assert.equal(
        host.snapshot.game.players.reduce((sum, p) => sum + p.score, 0),
        20
      )
    for (const player of group) {
      await player.command({ action: 'leave' })
      await close(player)
    }
    console.log(`PASS: ${kind}, ${size} players, ${language}, five catalogue rounds`)
  }
  console.log(
    'PASS: SQLite catalogue, continuous written solo, final review and win, resume, history, multiplayer, sources and private answers'
  )
} finally {
  for (const client of clients) await close(client)
}
