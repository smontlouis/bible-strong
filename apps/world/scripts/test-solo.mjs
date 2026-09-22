// Local-only real Gloo solo lifecycle smoke. Never sends commands to production.
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
const endpoint = process.env.WORLD_TEST_URL || 'ws://127.0.0.1:8791/parties/world-room/asi-europe'
assert(['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname))
let ws, heartbeat, snapshot, welcome, issue
async function until(check, name, timeout = 6000) {
  const started = Date.now()
  while (!check()) {
    if (Date.now() - started > timeout) throw new Error(`Timeout: ${name}`)
    await delay(50)
  }
}
async function connect(resumeToken) {
  snapshot = welcome = null
  ws = new WebSocket(endpoint)
  ws.addEventListener('message', event => {
    const m = JSON.parse(event.data)
    if (m.type === 'games') snapshot = m.snapshot
    if (m.type === 'welcome') welcome = m
    if (m.error) issue = m.error
  })
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  ws.send(
    JSON.stringify({
      type: 'join',
      version: 2,
      profile: { name: 'QA Solo', avatar: 'nova', color: '#73cdd0' },
      pose: { x: 780, y: 370, dx: 0, dy: 1, moving: false },
      ...(resumeToken ? { resumeToken } : {}),
    })
  )
  await until(() => welcome && snapshot, 'joined')
  heartbeat = setInterval(() => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }))
  }, 5000)
}
async function command(command) {
  await delay(350)
  issue = null
  ws.send(JSON.stringify({ type: 'game', command }))
}
async function main() {
  try {
    await connect()
    await command({
      action: 'create',
      options: {
        mode: 'solo',
        kind: 'quiz',
        difficulty: 'easy',
        subject: 'people',
        testament: 'both',
        language: 'fr',
      },
    })
    await until(() => snapshot.game?.solo, 'solo lobby')
    ws.send(JSON.stringify({ type: 'game', command: { action: 'pause-solo' } }))
    await until(() => snapshot.game.solo.pauses.includes('menu'), 'immediate dialog pause')
    ws.send(JSON.stringify({ type: 'game', command: { action: 'resume-solo' } }))
    await until(() => !snapshot.game.solo.pauses.includes('menu'), 'immediate dialog resume')
    assert.equal(issue, null, 'dialog presence must not consume the action cooldown')
    if (process.argv.includes('--lobby-only'))
      console.log('PASS: solo creation and immediate dialog pause/resume without rate limit errors')
    else {
      const id = snapshot.game.id,
        token = welcome.resumeToken
      await command({ action: 'start' })
      await until(() => snapshot.game?.phase === 'generating', 'generating')
      console.log('Solo generation running through Gloo Grounded…')
      await until(() => snapshot.game?.phase !== 'generating', 'grounded questions', 185000)
      assert.equal(snapshot.game.phase, 'question', issue || snapshot.game.reason)
      assert.equal(snapshot.game.players.length, 1)
      assert.equal(snapshot.game.result, undefined)
      assert.equal(snapshot.game.choices.length, 4)
      await command({ action: 'pause-solo' })
      await until(() => snapshot.game.solo.pauses.includes('menu'), 'paused')
      const remaining = snapshot.game.solo.remainingMs
      clearInterval(heartbeat)
      ws.close()
      await delay(1000)
      await connect(token)
      assert.equal(snapshot.game.id, id)
      assert.equal(snapshot.game.solo.remainingMs, remaining)
      await command({ action: 'resume-solo' })
      await until(() => snapshot.game.solo.pauses.length === 0, 'resumed')
      const text = snapshot.game.choices[0]
      await command({ action: 'answer', gameId: id, round: 0, text })
      await until(() => snapshot.game.phase === 'reveal', 'answer revealed')
      assert(snapshot.game.result.reference)
      assert.equal(snapshot.game.solo.answered, 1)
      assert.equal(snapshot.game.solo.streak, snapshot.game.ownAnswer.status === 'correct' ? 1 : 0)
      await command({ action: 'next' })
      await until(() => snapshot.game.phase === 'question', 'next question')
      assert.equal(snapshot.game.round, 1)
      assert.equal(snapshot.game.result, undefined)
      console.log(
        'PASS: live solo Gloo generation, private question, pause, session reconnect, scoring and next question'
      )
    }
  } finally {
    clearInterval(heartbeat)
    if (ws?.readyState === 1) {
      await command({ action: 'leave' })
      await until(() => !snapshot?.game, 'left own session')
    }
    ws?.close()
  }
}
// Node's WebSocket connection pool can keep its socket handle alive after close.
main().then(
  () => process.exit(0),
  error => {
    console.error(error)
    process.exit(1)
  }
)
