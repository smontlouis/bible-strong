import { beforeEach, describe, expect, it } from 'vitest'
import {
  emptyGames,
  GameEngine,
  GameFault,
  MAX_GAMES,
  REJOIN_MS,
  START_DELAY_MS,
  type Effect,
  type Round,
  type Visitor,
} from './engine'
import { parseGameAction, type GameAction, type GameOptions } from '../../src/games-protocol'
const options: GameOptions = {
  kind: 'quiz',
  language: 'fr',
  difficulty: 'medium',
  subject: 'mixed',
  testament: 'both',
}
const rounds: Round[] = Array.from({ length: 5 }, (_, i) => ({
  question: `Question ${i}`,
  clues: ['premier indice', 'deuxième indice', 'dernier indice'],
  answer: `Pierre${i}`,
  aliases: [`Peter${i}`],
  choices: [`Pierre${i}`, 'Paul', 'Jean', 'Marc'],
  explanation: 'Une explication biblique.',
  evidence: 'Tu es Pierre.',
  reference: 'Matthieu 16:18',
  url: 'https://web.bible-strong.app/',
}))
let now: number, visitors: Visitor[], engine: GameEngine
beforeEach(() => {
  now = 1_000_000
  visitors = ['a', 'b', 'c', 'd', 'e'].map(id => ({
    id,
    profile: { name: id, avatar: 'nova', color: '#73cdd0' },
    x: 836,
    y: 500,
    present: true,
  }))
  engine = new GameEngine(
    emptyGames(),
    () => visitors,
    () => now
  )
})
const command = (id: string, action: GameAction) => engine.command(id, action)
/** Generation completes, then the 3 · 2 · 1 countdown elapses before the first question opens. */
function launch(...args: Parameters<GameEngine['generated']>) {
  const g = engine.data.games.find(item => item.id === args[0].gameId)
  engine.generated(...args)
  if (g?.startsAt !== undefined && g.startsAt > now) now = g.startsAt
}
function join(id: string) {
  command('a', { action: 'invite', target: id })
  const invitation = engine.snapshot(id).invitations[0].id
  command(id, { action: 'accept', invitation })
}
function lobby(size = 2) {
  command('a', { action: 'create', options })
  for (const id of ['b', 'c', 'd'].slice(0, size - 1)) join(id)
}
function start(size = 2) {
  lobby(size)
  const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
  launch(effect, structuredClone(rounds))
  return engine.data.games[0]
}
function answer(id: string, text: string) {
  const g = engine.data.games[0]
  return command(id, { action: 'answer', gameId: g.id, round: g.round, text }) as Extract<
    Effect,
    { type: 'evaluate' }
  >
}
function fails(code: string, fn: () => unknown) {
  try {
    fn()
    throw new Error('Expected rejection')
  } catch (e) {
    expect(e).toBeInstanceOf(GameFault)
    expect((e as GameFault).code).toBe(code)
  }
}
describe('invitations and lobby', () => {
  it('does not let a backgrounded visitor create or join a new game', () => {
    visitors[0].present = false
    fails('not_ready', () => command('a', { action: 'create', options }))
    visitors[0].present = true
    command('a', { action: 'create', options })
    command('a', { action: 'invite', target: 'b' })
    visitors[1].present = false
    fails('not_ready', () =>
      command('b', { action: 'accept', invitation: engine.snapshot('b').invitations[0].id })
    )
  })
  it('supports exactly 2, 3 or 4 players and private targeted invitations', () => {
    lobby(4)
    expect(engine.data.games[0].players).toHaveLength(4)
    fails('full', () => command('a', { action: 'invite', target: 'e' }))
    expect(engine.snapshot('e').invitations).toEqual([])
  })
  it('requires proximity, prevents self invitations and expires invitations', () => {
    lobby()
    visitors[2].x = 100
    fails('too_far', () => command('a', { action: 'invite', target: 'c' }))
    fails('unavailable', () => command('a', { action: 'invite', target: 'a' }))
    command('a', { action: 'invite', target: 'd' })
    const invite = engine.snapshot('d').invitations[0]
    now += 60_001
    fails('expired', () => command('d', { action: 'accept', invitation: invite.id }))
  })
  it('does not let another visitor accept an invitation or join two games', () => {
    lobby()
    command('a', { action: 'invite', target: 'c' })
    const invite = engine.snapshot('c').invitations[0]
    fails('expired', () => command('d', { action: 'accept', invitation: invite.id }))
    fails('busy', () => command('b', { action: 'create', options }))
  })
  it('enforces host authority and two present participants', () => {
    command('a', { action: 'create', options })
    fails('not_ready', () => command('a', { action: 'start' }))
    join('b')
    fails('not_host', () => command('b', { action: 'start' }))
    engine.presence('b', false)
    fails('not_ready', () => command('a', { action: 'start' }))
  })
  it('transfers host and permits a new invitation after host departure', () => {
    lobby(3)
    command('a', { action: 'leave' })
    expect(engine.data.games[0].host).toBe('b')
    command('b', { action: 'invite', target: 'd' })
    expect(engine.snapshot('d').invitations).toHaveLength(1)
  })
  it('resolves crossed invitations without placing a participant in multiple games', () => {
    command('a', { action: 'create', options })
    command('a', { action: 'invite', target: 'b' })
    command('b', { action: 'create', options })
    // Both lobbies are still waiting: each host may invite the other.
    expect(engine.snapshot('b').invitations).toHaveLength(1)
    command('b', { action: 'invite', target: 'a' })
    command('a', { action: 'accept', invitation: engine.snapshot('a').invitations[0].id })
    expect(engine.data.games).toHaveLength(1)
    expect(engine.data.games[0].players.map(p => p.id)).toEqual(['b', 'a'])
    // A's own lobby is gone, and so is the invitation it had sent to B.
    engine.tick()
    expect(engine.snapshot('b').invitations).toHaveLength(0)
  })
})
describe('round authority and privacy', () => {
  it.each([2, 3, 4])('completes five rounds with %i players and retains the final scores', size => {
    const g = start(size)
    for (let round = 0; round < 5; round++) {
      for (const p of g.players) answer(p.id, `Pierre${round}`)
      expect(g.phase).toBe('reveal')
      command('a', { action: 'next' })
    }
    expect(g.phase).toBe('finished')
    expect(g.players.map(p => p.score)).toEqual(Array(size).fill(5))
  })
  it('ignores the obsolete AI generation budget for catalogue selection', () => {
    lobby()
    for (let i = 0; i < 60; i++) engine.data.limits[`budget:${i}`] = now + 60_000
    expect(command('a', { action: 'start' })?.type).toBe('generate')
  })
  it('hides answers, future clues, evidence and other answers before reveal', () => {
    start()
    answer('a', 'Pierre0')
    const view = engine.snapshot('b').game!
    expect(view.clues).toEqual(['premier indice'])
    expect(view.result).toBeUndefined()
    expect(JSON.stringify(view)).not.toContain('Pierre0')
    expect(JSON.stringify(view)).not.toContain('dernier indice')
    now += 15_000
    expect(engine.snapshot('b').game!.clues).toHaveLength(2)
  })
  it('awards points once, accepts accents/case and prevents duplicate submission', () => {
    const g = start()
    answer('a', ' PÍERRE0 ')
    answer('a', 'wrong')
    answer('b', 'Peter0')
    expect(g.phase).toBe('reveal')
    expect(g.players.map(p => p.score)).toEqual([1, 1])
    engine.tick()
    expect(g.players.map(p => p.score)).toEqual([1, 1])
    fails('not_ready', () => answer('a', 'Pierre0'))
  })
  it('reveals as soon as every player has answered or run out of attempts', () => {
    const g = start()
    for (let i = 0; i < 3; i++) engine.evaluated(answer('a', `vague ${i}`), 'clarify')
    expect(engine.snapshot('a').game?.ownAnswer?.retriesLeft).toBe(0)
    expect(g.phase).toBe('question')
    answer('b', 'Pierre0')
    expect(g.phase).toBe('reveal')
    expect(g.players.map(p => p.score)).toEqual([0, 1])
  })
  it('ignores stale generation results after departure or timeout', () => {
    lobby()
    const e = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
    command('b', { action: 'leave' })
    launch(e, rounds)
    expect(engine.data.games[0].phase).toBe('finished')
  })
  it('rejects answers from a previous round and non-host next requests', () => {
    const g = start()
    answer('a', 'Pierre0')
    answer('b', 'Pierre0')
    fails('not_host', () => command('b', { action: 'next' }))
    command('a', { action: 'next' })
    fails('not_ready', () =>
      command('a', { action: 'answer', gameId: g.id, round: 0, text: 'Pierre0' })
    )
  })
  it('validates easy quiz choices without evaluator calls', () => {
    lobby()
    const g = engine.data.games[0]
    g.options.kind = 'quiz'
    g.options.difficulty = 'easy'
    const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
    launch(effect, rounds)
    fails('invalid', () => answer('a', 'Unknown'))
    expect(answer('a', 'Paul')).toBeUndefined()
    expect(g.answers.a.status).toBe('wrong')
  })
  it('limits ambiguous retries and keeps a technical failure from counting as wrong', () => {
    const g = start()
    for (let i = 0; i < 3; i++) {
      const e = answer('a', `something ${i}`)
      engine.evaluated(e, 'unavailable')
    }
    fails('rate_limited', () => answer('a', 'Pierre0'))
    answer('b', 'Pierre0')
    now += 60_001
    engine.tick()
    expect(g.phase).toBe('reveal')
    expect(g.void).toBe(true)
    expect(g.players.map(p => p.score)).toEqual([0, 0])
  })
  it('ignores duplicate and outdated evaluation callbacks', () => {
    const g = start()
    const old = answer('a', 'Peter')
    engine.evaluated(old, 'clarify')
    const next = answer('a', 'Petr')
    engine.evaluated(old, 'correct')
    expect(g.answers.a.status).toBe('pending')
    engine.evaluated(next, 'correct')
    answer('b', 'Pierre0')
    engine.evaluated(next, 'correct')
    expect(g.players.map(p => p.score)).toEqual([1, 1])
  })
  it('lets timely submissions finish evaluating after the round deadline', () => {
    const g = start()
    now += 59_000
    const e = answer('a', 'Petr')
    answer('b', 'Pierre0')
    now += 2000
    engine.tick()
    expect(g.phase).toBe('question')
    engine.evaluated(e, 'correct')
    expect(g.phase).toBe('reveal')
    expect(g.players[0].score).toBe(1)
  })
  it('expires lost evaluation jobs and voids the round', () => {
    const g = start()
    answer('a', 'Petr')
    answer('b', 'Pierre0')
    now += 61_000
    engine.tick()
    expect(g.phase).toBe('reveal')
    expect(g.void).toBe(true)
  })
})
describe('disconnects and persistence', () => {
  it('freezes clues/deadline and restores them on rejoin', () => {
    const g = start()
    now += 10_000
    engine.presence('b', false)
    now += 50_000
    engine.tick()
    expect(engine.snapshot('a').game!.clues).toHaveLength(1)
    const view = engine.snapshot('a').game!
    expect(view.deadline - view.pausedAt!).toBe(50_000)
    engine.presence('b', true)
    expect(g.pausedAt).toBeNull()
    expect(g.deadline - now).toBe(50_000)
  })
  it('waits for every absent player, and ignores a late completion after evaluation expiry', () => {
    const g = start(4)
    const e = answer('a', 'Petr')
    engine.presence('b', false)
    now += 5_000
    engine.presence('c', false)
    now += 10_000
    engine.tick()
    engine.evaluated(e, 'correct')
    expect(g.answers.a.status).toBe('unavailable')
    engine.presence('b', true)
    expect(g.pausedAt).not.toBeNull()
    engine.presence('c', true)
    expect(g.pausedAt).toBeNull()
    expect(g.deadline - now).toBe(60_000)
  })
  it('continues with two survivors and transfers an absent host after 90 seconds', () => {
    const g = start(3)
    engine.presence('a', false)
    now += REJOIN_MS + 1
    engine.tick()
    expect(g.players.map(p => p.id)).toEqual(['b', 'c'])
    expect(g.host).toBe('b')
    expect(g.phase).toBe('question')
    expect(g.pausedAt).toBeNull()
  })
  it('ends gracefully when only one player remains', () => {
    const g = start()
    engine.presence('b', false)
    now += REJOIN_MS + 1
    engine.tick()
    expect(g.phase).toBe('finished')
    expect(g.reason).toBe('not_enough_players')
  })
  it('restores pending game/answer state from durable JSON and applies a result once', () => {
    start()
    const e = answer('a', 'Petr')
    engine = new GameEngine(
      JSON.parse(JSON.stringify(engine.data)),
      () => visitors,
      () => now
    )
    engine.evaluated(e, 'correct')
    answer('b', 'Pierre0')
    expect(engine.snapshot('a').game!.players[0].score).toBe(1)
  })
  it('cleans up empty games, expired summaries and expired rate limits', () => {
    start()
    command('a', { action: 'leave' })
    command('b', { action: 'leave' })
    now += 60 * 60_000
    engine.tick()
    expect(engine.data.games).toEqual([])
    expect(engine.nextWake()).toBeNull()
    expect(engine.data.limits).toEqual({})
  })
})

describe('Who am I: duel and clue race', () => {
  function who(size = 2) {
    lobby(size)
    engine.data.games[0].options.kind = 'who'
    const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
    launch(
      effect,
      rounds.map(r => ({ ...r, clues: ['one', 'two', 'three', 'four'] }))
    )
    return engine.data.games[0]
  }
  function submit(id: string, text: string, zone = engine.data.games[0].who!.zone) {
    const g = engine.data.games[0]
    return command(id, { action: 'answer', gameId: g.id, round: g.round, zone, text }) as Extract<
      Effect,
      { type: 'evaluate' }
    >
  }
  it('alternates 20/20/12/8-second turns, with four private progressive clues', () => {
    const g = who()
    expect(engine.snapshot('a').game?.who).toMatchObject({
      mode: 'duel',
      points: 4,
      active: 'a',
      eligible: ['a'],
    })
    expect(engine.snapshot('a').game?.clues).toEqual(['one'])
    fails('not_ready', () => submit('b', 'Pierre0'))
    for (const [ms, zone, active, points] of [
      [20_000, 1, 'b', 3],
      [20_000, 2, 'a', 2],
      [12_000, 3, 'b', 1],
    ] as const) {
      now += ms
      engine.tick()
      expect(engine.snapshot('a').game?.who).toMatchObject({ zone, active, points })
      expect(engine.snapshot('a').game?.clues).toHaveLength(zone + 1)
    }
    now += 8_000
    engine.tick()
    expect(g.phase).toBe('reveal')
    expect(g.players.map(p => p.score)).toEqual([0, 0])
    command('a', { action: 'next' })
    expect(g.who?.active).toBe('b')
  })
  it('passes the rest of four-point time to B, followed by B’s full three-point zone', () => {
    const g = who()
    now += 5_000
    const e = submit('a', 'Paul')
    now += 7_000
    engine.evaluated(e, 'wrong')
    expect(g.deadline - now).toBe(15_000)
    expect(g.who?.active).toBe('b')
    expect(engine.snapshot('a').game?.ownAnswer?.status).toBe('wrong')
    fails('not_ready', () => submit('a', 'Pierre0'))
    now += 15_000
    engine.tick()
    expect(g.who).toMatchObject({ active: 'b', zone: 1 })
    expect(g.deadline - now).toBe(20_000)
    submit('b', 'Peter0')
    expect(g.phase).toBe('reveal')
    expect(g.players.map(p => p.score)).toEqual([0, 3])
  })
  it('ends immediately for a correct answer and scores exactly once', () => {
    const g = who()
    submit('a', 'Pierre0')
    expect(g.phase).toBe('reveal')
    expect(g.players[0].score).toBe(4)
    fails('not_ready', () => submit('a', 'Pierre0'))
    engine.tick()
    expect(g.players[0].score).toBe(4)
  })
  it.each([3, 4])(
    'gives %i players one wrong attempt per clue and advances when all are blocked',
    size => {
      const g = who(size)
      expect(g.who?.mode).toBe('race')
      for (const id of ['a', 'b', 'c', 'd'].slice(0, size)) {
        engine.evaluated(submit(id, 'Paul'), 'wrong')
        if (id !== g.players.at(-1)!.id) fails('not_ready', () => submit(id, 'Pierre0'))
      }
      expect(g.who?.zone).toBe(1)
      expect(engine.snapshot('a').game?.who?.eligible).toHaveLength(size)
      fails('not_ready', () => submit('a', 'Pierre0', 0))
      submit('a', 'Pierre0')
      expect(g.players[0].score).toBe(3)
    }
  )
  it('resolves receipt order even if a later exact match or evaluator finishes first', () => {
    const g = who(4)
    const first = submit('a', 'Pière')
    const second = submit('b', 'Pierr')
    submit('c', 'Pierre0')
    engine.evaluated(second, 'correct')
    expect(g.phase).toBe('question')
    expect(engine.snapshot('b').game?.ownAnswer?.status).toBe('pending')
    now += 5_000
    engine.evaluated(first, 'correct')
    expect(g.who?.winner).toBe('a')
    expect(g.players.map(p => p.score)).toEqual([4, 0, 0, 0])
    engine.evaluated(second, 'correct')
    expect(g.players[0].score).toBe(4)
  })
  it('allows the next queued correct answer to win when the first is wrong', () => {
    const g = who(3)
    const first = submit('a', 'Paul')
    submit('b', 'Pierre0')
    engine.evaluated(first, 'wrong')
    expect(g.who?.winner).toBe('b')
    expect(g.players.map(p => p.score)).toEqual([0, 4, 0])
  })
  it('does not penalize a provider failure or award a later answer unfairly', () => {
    const g = who(3)
    const first = submit('a', 'Pière')
    submit('b', 'Pierre0')
    engine.evaluated(first, 'unavailable')
    expect(g.phase).toBe('reveal')
    expect(g.void).toBe(true)
    expect(g.players.map(p => p.score)).toEqual([0, 0, 0])
  })
  it('expires evaluations, ignores late callbacks, and survives persisted reloads', () => {
    who(3)
    const first = submit('a', 'Pière')
    now += 12_000
    engine = new GameEngine(
      JSON.parse(JSON.stringify(engine.data)),
      () => visitors,
      () => now
    )
    engine.tick()
    expect(engine.data.games[0].phase).toBe('reveal')
    expect(engine.data.games[0].void).toBe(true)
    engine.evaluated(first, 'correct')
    expect(engine.data.games[0].players[0].score).toBe(0)
  })
  it('freezes overlapping evaluation and absence only once', () => {
    const g = who()
    now += 4_000
    const e = submit('a', 'Paul')
    now += 3_000
    engine.presence('b', false)
    now += 2_000
    engine.evaluated(e, 'wrong')
    now += 10_000
    engine.presence('b', true)
    expect(g.deadline - now).toBe(16_000)
    expect(g.who?.frozenAt).toBeNull()
    expect(g.who?.active).toBe('b')
    now += 16_000
    engine.tick()
    expect(g.who?.zone).toBe(1)
  })
  it('resumes correctly when the player returns before evaluation finishes', () => {
    const g = who()
    now += 2_000
    const e = submit('a', 'Paul')
    now += 1_000
    engine.presence('b', false)
    now += 1_000
    engine.presence('b', true)
    now += 1_000
    engine.evaluated(e, 'wrong')
    expect(g.deadline - now).toBe(18_000)
    expect(g.who?.frozenAt).toBeNull()
  })
  it('bounds clarification retries and passes the turn without losing the draft in the snapshot', () => {
    const g = who()
    for (let i = 0; i < 3; i++) engine.evaluated(submit('a', `Simon ${i}`), 'clarify')
    expect(g.who?.active).toBe('b')
    expect(engine.snapshot('a').game?.ownAnswer).toMatchObject({ text: 'Simon 2', retriesLeft: 0 })
    fails('not_ready', () => submit('a', 'Pierre0'))
    engine.evaluated(submit('b', 'Paul'), 'wrong')
    expect(g.who?.zone).toBe(1)
  })
  it('keeps race mode during a departure and selects duel for the following round', () => {
    const g = who(3)
    command('c', { action: 'leave' })
    expect(g.who?.mode).toBe('race')
    submit('a', 'Pierre0')
    command('a', { action: 'next' })
    expect(g.who?.mode).toBe('duel')
    expect(g.who?.active).toBe('b')
  })
  it('catches up a delayed alarm without extending any zones', () => {
    const g = who()
    now += 53_000
    engine.tick()
    expect(g.who?.zone).toBe(3)
    expect(g.deadline - now).toBe(7_000)
  })
})

it('preserves and validates the submitted clue zone at the transport boundary', () => {
  const action = { action: 'answer', gameId: 'test-game', round: 0, zone: 2, text: ' Moïse ' }
  expect(parseGameAction(action)).toEqual({ ...action, text: 'Moïse' })
  for (const zone of [-1, 4, 1.5, '2', null])
    expect(parseGameAction({ ...action, zone })).toBeNull()
})
it('finishes legacy three-clue games with their existing scoring rules', () => {
  lobby()
  const g = engine.data.games[0]
  g.options.kind = 'who'
  const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
  launch(effect, rounds)
  expect(g.who).toBeUndefined()
  answer('a', 'Pierre0')
  answer('b', 'Pierre0')
  expect(g.players.map(p => p.score)).toEqual([1, 1])
  command('a', { action: 'next' })
  expect(g.who).toBeUndefined()
})

describe('solo four in a row under room authority', () => {
  function solo() {
    command('a', { action: 'create', options: { ...options, mode: 'solo' } })
    const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
    launch(effect, structuredClone(rounds))
    return engine.data.games[0]
  }
  it('starts alone, keeps answers private, and wins after four consecutive answers', () => {
    const g = solo()
    expect(engine.snapshot('a').game?.result).toBeUndefined()
    expect(engine.snapshot('a').game?.choices).toBeUndefined()
    fails('not_ready', () => command('a', { action: 'invite', target: 'b' }))
    for (let i = 0; i < 4; i++) {
      answer('a', `Pierre${i}`)
      expect(g.solo?.streak).toBe(i + 1)
      if (i < 3) {
        expect(g.phase).toBe('question')
        expect(g.round).toBe(i + 1)
        expect(g.solo?.pauses).toEqual([])
        expect(engine.snapshot('a').game?.soloReview).toBeUndefined()
      }
    }
    expect(g.phase).toBe('finished')
    expect(g.solo?.outcome).toBe('won')
    expect(engine.snapshot('a').game?.soloReview?.map(item => item.answer)).toEqual([
      'Pierre0',
      'Pierre1',
      'Pierre2',
      'Pierre3',
    ])
    expect(engine.snapshot('a').game?.result).toBeUndefined()
  })
  it('preserves a paused run beyond the multiplayer rejoin window', () => {
    const g = solo()
    now += 10000
    engine.presence('a', false)
    now += REJOIN_MS + 50000
    engine.tick()
    expect(engine.data.games).toContain(g)
    expect(g.solo?.remainingMs).toBe(110000)
    engine.presence('a', true)
    answer('a', 'Pierre0')
    expect(g.solo?.streak).toBe(1)
  })
  it('can retry an unavailable check without losing the series or charging verification time', () => {
    const g = solo()
    answer('a', 'Pierre0')
    const effect = answer('a', 'petre')
    now += 12001
    engine.tick()
    expect(g.solo?.streak).toBe(1)
    expect(g.solo?.remainingMs).toBe(120000)
    command('a', { action: 'next' })
    engine.evaluated(effect, 'wrong')
    expect(g.solo?.streak).toBe(1)
    answer('a', 'Pierre1')
    expect(g.solo?.streak).toBe(2)
  })
  it('refills questions without recycling round IDs, answers, or charging preparation time', () => {
    const g = solo()
    let effect!: Extract<Effect, { type: 'generate' }>
    for (let i = 0; i < 5; i++)
      effect = engine.evaluated(answer('a', 'wrong'), 'wrong') as typeof effect
    expect(effect.exclude).toHaveLength(5)
    expect(g.round).toBe(5)
    now += 10000
    launch(
      effect,
      rounds.map((r, i) => ({ ...r, answer: `New${i}`, aliases: [] }))
    )
    expect(g.solo?.remainingMs).toBe(120000)
    expect(engine.snapshot('a').game?.result).toBeUndefined()
    fails('not_ready', () =>
      command('a', { action: 'answer', gameId: g.id, round: 0, text: 'Pierre0' })
    )
    answer('a', 'New0')
    expect(g.solo?.streak).toBe(1)
  })
})

it('passes a solo question without AI and guards duplicate and stale passes', () => {
  command('a', { action: 'create', options: { ...options, mode: 'solo' } })
  const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
  launch(effect, structuredClone(rounds))
  const g = engine.data.games[0]
  answer('a', 'Pierre0')
  expect(command('a', { action: 'pass', gameId: g.id, round: 1 })).toBeUndefined()
  expect(g.solo?.streak).toBe(0)
  expect(g.solo?.best).toBe(1)
  expect(engine.snapshot('a').game?.soloFeedback?.status).toBe('skipped')
  expect(g.round).toBe(2)
  expect(engine.snapshot('a').game?.soloReview).toBeUndefined()
  fails('not_ready', () => command('a', { action: 'pass', gameId: g.id, round: 1 }))
})

it('holds the solo clock until both the game dialog and presence resume', () => {
  command('a', { action: 'create', options: { ...options, mode: 'solo' } })
  const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
  launch(effect, structuredClone(rounds))
  now += 10000
  command('a', { action: 'pause-solo' })
  engine.presence('a', false)
  now += 100000
  engine.presence('a', true)
  const g = engine.data.games[0]
  expect(g.solo?.remainingMs).toBe(110000)
  expect(g.solo?.runningSince).toBeNull()
  command('a', { action: 'resume-solo' })
  now += 10000
  engine.tick()
  expect(g.solo?.remainingMs).toBe(100000)
})

it('validates solo options and long-running round identifiers at the protocol boundary', () => {
  expect(
    parseGameAction({ action: 'create', options: { ...options, mode: 'solo' } })
  ).not.toBeNull()
  expect(
    parseGameAction({ action: 'create', options: { ...options, mode: 'solo', kind: 'who' } })
  ).toBeNull()
  expect(parseGameAction({ action: 'create', options: { ...options, mode: 'invalid' } })).toBeNull()
  expect(parseGameAction({ action: 'pass', gameId: 'test', round: 49 })).not.toBeNull()
  expect(parseGameAction({ action: 'pass', gameId: 'test', round: 50 })).toBeNull()
})

it('keeps solo time running after success, failure and pass, with a private persisted final review', () => {
  command('a', { action: 'create', options: { ...options, mode: 'solo' } })
  const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
  const reserve = Array.from({ length: 50 }, (_, i) => ({
    ...rounds[0],
    question: `Q${i}`,
    answer: `R${i}`,
    catalogueId: `q-${i}`,
  }))
  launch(effect, reserve)
  let g = engine.data.games[0]
  now += 1000
  answer('a', 'R0')
  const first = engine.snapshot('a').game!
  expect(first).toMatchObject({
    phase: 'question',
    round: 1,
    question: 'Q1',
    soloFeedback: { status: 'correct' },
  })
  expect(first.result).toBeUndefined()
  expect(first.soloReview).toBeUndefined()
  now += 2000
  const check = answer('a', 'wrong identity')
  now += 5000
  engine.evaluated(check, 'wrong')
  expect(g.round).toBe(2)
  expect(g.solo?.streak).toBe(0)
  expect(g.solo?.remainingMs).toBe(117000)
  now += 3000
  command('a', { action: 'pass', gameId: g.id, round: g.round })
  expect(g.round).toBe(3)
  expect(g.solo?.remainingMs).toBe(114000)
  // Recreation must retain the previous question outcomes, without leaking the reserve.
  engine = new GameEngine(
    JSON.parse(JSON.stringify(engine.data)),
    () => visitors,
    () => now
  )
  g = engine.data.games[0]
  now += 114000
  engine.tick()
  const final = engine.snapshot('a').game!
  expect(final.phase).toBe('finished')
  expect(final.solo?.outcome).toBe('timeout')
  expect(
    final.soloReview?.map(item => [item.question, item.text, item.status, item.answer])
  ).toEqual([
    ['Q0', 'R0', 'correct', 'R0'],
    ['Q1', 'wrong identity', 'wrong', 'R1'],
    ['Q2', '', 'skipped', 'R2'],
    ['Q3', '', 'timeout', 'R3'],
  ])
  expect(final.soloReview?.every(item => item.sources[0].url === rounds[0].url)).toBe(true)
  expect(JSON.stringify(final)).not.toContain('Q4')
  expect(final.soloReviewIncomplete).toBe(false)
})

it('does not reopen a solo round when an old verdict or submission arrives after auto-advance', () => {
  command('a', { action: 'create', options: { ...options, mode: 'solo' } })
  launch(
    command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>,
    rounds
  )
  const check = answer('a', 'misspelled')
  engine.evaluated(check, 'correct')
  engine.evaluated(check, 'wrong')
  const g = engine.data.games[0]
  expect(g.round).toBe(1)
  expect(g.solo?.streak).toBe(1)
  expect(g.soloAnswers).toHaveLength(1)
  fails('not_ready', () =>
    command('a', { action: 'answer', gameId: g.id, round: 0, text: rounds[0].answer })
  )
})

describe('audit fixes', () => {
  function duel() {
    lobby()
    engine.data.games[0].options.kind = 'who'
    const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
    engine.generated(
      effect,
      rounds.map(r => ({ ...r, clues: ['one', 'two', 'three', 'four'] }))
    )
    return engine.data.games[0]
  }
  it('opens the first question after the countdown, with its full clock', () => {
    const g = duel()
    expect(g.startsAt).toBe(now + START_DELAY_MS)
    expect(engine.snapshot('a').game?.startsAt).toBe(g.startsAt)
    const early = { action: 'answer', gameId: g.id, round: 0, zone: 0, text: 'Pierre0' } as const
    fails('not_ready', () => command('a', early))
    now = g.startsAt!
    expect(g.deadline - now).toBe(20_000)
    command('a', early)
    expect(g.phase).toBe('reveal')
    command('a', { action: 'next' })
    expect(g.startsAt).toBeUndefined()
  })
  it('starts the solo clock only after the countdown', () => {
    command('a', { action: 'create', options: { ...options, mode: 'solo' } })
    const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
    engine.generated(effect, structuredClone(rounds))
    const g = engine.data.games[0]
    fails('not_ready', () => answer('a', 'Pierre0'))
    now += START_DELAY_MS
    engine.tick()
    expect(g.solo?.remainingMs).toBe(120_000)
    now += 1_000
    engine.tick()
    expect(g.solo?.remainingMs).toBe(119_000)
  })
  it('limits the total pause a player can impose by hiding and showing again', () => {
    const g = start()
    for (let i = 0; i < 3; i++) {
      engine.presence('b', false)
      now += 40_000
      engine.presence('b', true)
    }
    // 90 s of pause spent: a further absence no longer stops the clock.
    engine.presence('b', false)
    expect(g.pausedAt).toBeNull()
    const deadline = g.deadline
    now += 10_000
    engine.tick()
    expect(g.deadline).toBe(deadline)
  })
  it('applies a verdict received during a pause before ending a two-player game', () => {
    const g = duel()
    now = g.startsAt!
    const check = command('a', {
      action: 'answer',
      gameId: g.id,
      round: 0,
      zone: 0,
      text: 'Pierr',
    }) as Extract<Effect, { type: 'evaluate' }>
    engine.presence('b', false)
    engine.evaluated(check, 'correct')
    now += REJOIN_MS
    engine.tick()
    expect(g.phase).toBe('finished')
    expect(g.players.find(p => p.id === 'a')?.score).toBe(4)
  })
  it('keeps the final podium when players leave the summary', () => {
    const g = start()
    g.players[0].score = 5
    g.round = 4
    g.phase = 'reveal'
    command('a', { action: 'next' })
    expect(g.phase).toBe('finished')
    command('a', { action: 'leave' })
    const view = engine.snapshot('b').game!
    expect(view.standings?.map(p => [p.id, p.score])).toEqual([
      ['a', 5],
      ['b', 0],
    ])
  })
  it('keeps invitations received by a player who leaves a finished game', () => {
    const g = start()
    engine.data.games[0].phase = 'finished'
    command('c', { action: 'create', options })
    command('c', { action: 'invite', target: 'b' })
    command('b', { action: 'leave' })
    expect(engine.snapshot('b').invitations).toHaveLength(1)
    expect(g.players.map(p => p.id)).toEqual(['a'])
  })
  it('cancels the removal of a player who comes back to the summary', () => {
    const g = start()
    engine.presence('b', false)
    g.phase = 'finished'
    now += 10_000
    engine.presence('b', true)
    now += REJOIN_MS
    engine.tick()
    expect(g.players.map(p => p.id)).toEqual(['a', 'b'])
  })
  it('does not turn a slower pending answer into a provider error after a race is won', () => {
    lobby(3)
    engine.data.games[0].options.kind = 'who'
    const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
    launch(
      effect,
      rounds.map(r => ({ ...r, clues: ['one', 'two', 'three', 'four'] }))
    )
    const g = engine.data.games[0]
    const first = command('a', {
      action: 'answer',
      gameId: g.id,
      round: 0,
      zone: 0,
      text: 'Pierr',
    }) as Extract<Effect, { type: 'evaluate' }>
    command('b', { action: 'answer', gameId: g.id, round: 0, zone: 0, text: 'Pier' })
    engine.evaluated(first, 'correct')
    expect(g.phase).toBe('reveal')
    now += 13_000
    engine.tick()
    expect(g.answers.b.status).not.toBe('unavailable')
    expect(g.void).toBe(false)
  })
  it('evicts abandoned solo runs instead of refusing every new game', () => {
    for (let i = 0; i < MAX_GAMES; i++) {
      const id = `ghost-${i}`
      visitors.push({ ...visitors[0], id, present: true })
      command(id, { action: 'create', options: { ...options, mode: 'solo' } })
      visitors = visitors.filter(v => v.id !== id)
      now += 11_000
    }
    expect(engine.data.games).toHaveLength(MAX_GAMES)
    command('a', { action: 'create', options })
    expect(engine.data.games).toHaveLength(MAX_GAMES)
    expect(engine.snapshot('a').game?.host).toBe('a')
  })
})

describe('invitations before a game starts', () => {
  it('invites a visitor waiting in another lobby and moves them on accept', () => {
    command('c', { action: 'create', options })
    command('d', { action: 'create', options })
    command('d', { action: 'invite', target: 'e' })
    const other = engine.data.games.find(g => g.host === 'd')!
    command('e', { action: 'accept', invitation: engine.snapshot('e').invitations[0].id })
    // C hosts a lobby with nobody yet; D hosts one with a guest. Both can still be invited.
    lobby()
    command('a', { action: 'invite', target: 'c' })
    command('a', { action: 'invite', target: 'd' })
    command('d', { action: 'accept', invitation: engine.snapshot('d').invitations[0].id })
    const mine = engine.data.games.find(g => g.host === 'a')!
    expect(mine.players.map(p => p.id)).toEqual(['a', 'b', 'd'])
    // D's former lobby keeps its guest, who becomes host.
    expect(other.players.map(p => p.id)).toEqual(['e'])
    expect(other.host).toBe('e')
    expect(engine.snapshot('c').invitations).toHaveLength(1)
  })
  it('keeps visitors in a started game or already in the lobby out of reach', () => {
    const g = start()
    command('c', { action: 'create', options })
    fails('busy', () => command('c', { action: 'invite', target: 'a' }))
    g.phase = 'lobby'
    fails('busy', () => command('a', { action: 'invite', target: 'b' }))
  })
  it('refuses an invitation received before the visitor’s own game started', () => {
    command('c', { action: 'create', options })
    lobby()
    command('c', { action: 'invite', target: 'a' })
    const invitation = engine.snapshot('a').invitations[0].id
    const effect = command('a', { action: 'start' }) as Extract<Effect, { type: 'generate' }>
    launch(effect, structuredClone(rounds))
    fails('busy', () => command('a', { action: 'accept', invitation }))
  })
})
