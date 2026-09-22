import {
  createSoloRun,
  SOLO_MAX_QUESTIONS,
  pauseSolo,
  resumeSolo,
  submitSolo,
  settleSolo,
  tickSolo,
  soloRemaining,
  type SoloRun,
} from '../../src/solo-game'
import { START_DELAY_MS, WHO_ZONE_MS } from '../../src/games-protocol'
import type { AvatarProfile } from '../../src/avatar-profile'
import type {
  AnswerStatus,
  GameAction,
  GameError,
  GameMember,
  GameOptions,
  GamesSnapshot,
  GameView,
} from '../../src/games-protocol'

export const INVITE_MS = 60_000
export const REJOIN_MS = 90_000
export { START_DELAY_MS }
export const MAX_GAMES = 50
const ROUND_MS = 60_000
export type Round = {
  catalogueId?: string
  sources?: { reference: string; url: string }[]
  question: string
  clues: string[]
  choices: string[]
  answer: string
  aliases: string[]
  explanation: string
  reference: string
  url: string
  evidence: string
}
type Answer = {
  zone?: number
  sequence?: number
  processed?: boolean
  text: string
  status: AnswerStatus
  operation: string
  attempts: number
  expires: number
}
type WhoRound = {
  mode: 'duel' | 'race'
  order: string[]
  zone: number
  active: string | null
  sequence: number
  frozenAt: number | null
  winner?: string
  awarded?: number
}
export type Game = {
  soloAnswers?: { round: number; text: string; status: 'correct' | 'wrong' | 'skipped' }[]
  soloFeedback?: GameView['soloFeedback']
  solo?: SoloRun
  who?: WhoRound
  id: string
  host: string
  options: GameOptions
  phase: GameView['phase']
  players: GameMember[]
  rounds: Round[]
  round: number
  answers: Record<string, Answer>
  deadline: number
  started: number
  pausedAt: number | null
  operation?: string
  updated: number
  reason?: GameView['reason']
  void?: boolean
  /** The first question opens at this time; answers and clocks wait for it. */
  startsAt?: number
  /** Absence time each player has already spent pausing this game (at most REJOIN_MS). */
  pauseUsed?: Record<string, number>
  /** Scores frozen when the game ends, so later departures do not rewrite the podium. */
  standings?: GameMember[]
}
type Invitation = { id: string; gameId: string; from: string; to: string; expires: number }
export type GameData = { games: Game[]; invitations: Invitation[]; limits: Record<string, number> }
export type Visitor = {
  historyId?: string
  id: string
  profile: AvatarProfile
  x: number
  y: number
  present: boolean
}
export type Effect =
  | {
      type: 'generate'
      gameId: string
      operation: string
      options: GameOptions
      count?: number
      players?: string[]
      exclude?: string[]
    }
  | {
      type: 'evaluate'
      gameId: string
      round: number
      player: string
      operation: string
      text: string
      content: Round
    }
export class GameFault extends Error {
  constructor(public code: GameError) {
    super(code)
  }
}
const fail = (code: GameError): never => {
  throw new GameFault(code)
}
export function normalizeAnswer(text: string) {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}
export const emptyGames = (): GameData => ({ games: [], invitations: [], limits: {} })

/** Pure server authority; adapters persist the result before delivering snapshots. */
export class GameEngine {
  constructor(
    public data: GameData,
    private visitors: () => Visitor[],
    private now: () => number = Date.now,
    private uuid: () => string = () => crypto.randomUUID()
  ) {}
  private current(id: string) {
    return this.data.games.find(g => g.players.some(p => p.id === id))
  }
  private visitor(id: string) {
    return this.visitors().find(v => v.id === id)
  }
  private finish(g: Game, reason?: GameView['reason']) {
    g.phase = 'finished'
    g.reason = reason
    g.pausedAt = null
    g.standings = g.players.map(p => ({ ...p, absentSince: null }))
    g.deadline = this.now() + 10 * 60_000
    g.updated = this.now()
  }
  private begin(g: Game) {
    g.phase = 'question'
    g.answers = {}
    g.void = false
    delete g.startsAt
    g.started = this.now()
    g.deadline = this.now() + ROUND_MS
    if (g.options.kind === 'who' && g.rounds[g.round]?.clues.length === 4) {
      const order = g.players.map(p => p.id)
      g.who = {
        mode: order.length === 2 ? 'duel' : 'race',
        order,
        zone: 0,
        active: order.length === 2 ? order[g.round % 2] : null,
        sequence: 0,
        frozenAt: null,
      }
      g.deadline = this.now() + WHO_ZONE_MS[0]
    }
    g.updated = this.now()
  }
  private reveal(g: Game) {
    if (g.phase !== 'question') return
    for (const p of g.players)
      if (!g.answers[p.id])
        g.answers[p.id] = { text: '', status: 'skipped', attempts: 0, expires: 0, operation: '' }
    g.void =
      !g.who?.winner &&
      Object.values(g.answers).some(a => a.status === 'unavailable' || a.status === 'pending')
    // A race was already won: slower answers still being checked no longer matter.
    if (g.who?.winner)
      for (const a of Object.values(g.answers))
        if (a.status === 'pending') {
          a.status = 'skipped'
          a.processed = true
        }
    if (!g.void)
      for (const p of g.players) {
        if (g.who ? g.who.winner === p.id : g.answers[p.id]?.status === 'correct')
          p.score += g.who?.awarded ?? 1
      }
    g.phase = 'reveal'
    g.deadline = this.now() + 120_000
    g.updated = this.now()
  }
  private completed(g: Game) {
    // A player with no attempt left (three clarifications or failed checks) is done too;
    // otherwise the round would idle until its deadline with nothing left to submit.
    return (
      !g.who &&
      g.players.every(p => {
        const a = g.answers[p.id]
        return (
          !!a &&
          a.status !== 'pending' &&
          (['correct', 'wrong', 'skipped'].includes(a.status) || a.attempts >= 3)
        )
      })
    )
  }
  private remove(id: string) {
    const g = this.current(id)
    if (!g) return
    g.players = g.players.filter(p => p.id !== id)
    delete g.answers[id]
    if (g.host === id)
      g.host = g.players.find(p => p.absentSince === null)?.id ?? g.players[0]?.id ?? ''
    // Only this player's own lobby invitations become meaningless; invitations they received
    // stay valid, since leaving a finished game is exactly how a visitor accepts a new one.
    this.data.invitations = this.data.invitations.filter(i => !(i.from === id && i.gameId === g.id))
    if (!g.players.length) {
      this.data.games = this.data.games.filter(item => item !== g)
      return
    }
    // Apply verdicts that arrived during a pause before the game may end for lack of players.
    this.unpause(g)
    if (g.phase === 'question' && g.pausedAt === null && this.completed(g)) this.reveal(g)
    if (g.phase !== 'lobby' && g.phase !== 'finished' && g.players.length < 2)
      this.finish(g, 'not_enough_players')
  }
  /** Visitors may receive and accept invitations until their own game actually starts. */
  private available(g: Game) {
    return g.phase === 'lobby' || g.phase === 'finished'
  }
  /** Pause time a player may still hold: REJOIN_MS in total per game, never renewed. */
  private pauseLeft(g: Game, p: GameMember, now = this.now()) {
    const used = g.pauseUsed?.[p.id] ?? 0
    return Math.max(0, REJOIN_MS - used - (p.absentSince === null ? 0 : now - p.absentSince))
  }
  private pausing(g: Game, now = this.now()) {
    return g.players.some(p => p.absentSince !== null && this.pauseLeft(g, p, now) > 0)
  }
  private unpause(g: Game) {
    const now = this.now()
    if (g.pausedAt !== null && !this.pausing(g, now)) {
      // A player who used up their pause no longer holds the others back.
      const end = Math.min(
        now,
        ...g.players
          .filter(p => p.absentSince !== null)
          .map(p => p.absentSince! + REJOIN_MS - (g.pauseUsed?.[p.id] ?? 0))
      )
      const duration = Math.max(0, end - g.pausedAt)
      if (!g.who || g.phase !== 'question') {
        g.deadline += duration
        g.started += duration
      }
      if (g.startsAt !== undefined && g.startsAt > g.pausedAt) g.startsAt += duration
      g.pausedAt = null
    }
    this.settleWho(g)
  }
  presence(id: string, present: boolean) {
    this.tick()
    const now = this.now()
    const g = this.current(id),
      p = g?.players.find(p => p.id === id)
    if (!g || !p) return
    if (g.phase === 'finished') {
      // Coming back to the summary must cancel the pending removal of an absent player.
      if (present) p.absentSince = null
      return
    }
    if (g.solo) {
      p.absentSince = present ? null : (p.absentSince ?? now)
      if (present) resumeSolo(g.solo, 'away', now)
      else pauseSolo(g.solo, 'away', now)
      return
    }
    if (present) {
      if (p.absentSince !== null && (g.phase === 'question' || g.phase === 'reveal')) {
        const used = g.pauseUsed?.[p.id] ?? 0
        ;(g.pauseUsed ??= {})[p.id] = Math.min(REJOIN_MS, used + now - p.absentSince)
      }
      p.absentSince = null
      this.unpause(g)
      if (g.phase === 'question' && g.pausedAt === null && this.completed(g)) this.reveal(g)
    } else if (p.absentSince === null) {
      p.absentSince = now
      if ((g.phase === 'question' || g.phase === 'reveal') && this.pauseLeft(g, p, now) > 0)
        g.pausedAt ??= now
      this.settleWho(g)
    }
  }
  /** Free a slot from games nobody is playing: finished ones, then absent solo runs and lobbies. */
  private evictIdle() {
    const present = (id: string) => this.visitor(id)?.present === true
    const candidates = this.data.games
      .filter(
        g =>
          g.phase === 'finished' ||
          ((g.solo || g.phase === 'lobby') && !g.players.some(p => present(p.id)))
      )
      .sort(
        (a, b) =>
          Number(b.phase === 'finished') - Number(a.phase === 'finished') || a.updated - b.updated
      )
    const victim = candidates[0]
    if (!victim) return
    this.data.games = this.data.games.filter(g => g !== victim)
    this.data.invitations = this.data.invitations.filter(i => i.gameId !== victim.id)
  }
  command(id: string, action: GameAction): Effect | undefined {
    const now = this.now()
    this.tick()
    const visitor = this.visitor(id)
    if (!visitor) return fail('unavailable')
    let g = this.current(id)
    if (action.action === 'sync') return
    if (action.action === 'leave') {
      this.remove(id)
      return
    }
    if (!visitor.present && action.action !== 'decline') return fail('not_ready')
    if (action.action === 'create') {
      if (g && g.phase !== 'finished') return fail('busy')
      if ((this.data.limits[`create:${id}`] ?? 0) > now) return fail('rate_limited')
      if (!g && this.data.games.length >= MAX_GAMES) this.evictIdle()
      if (!g && this.data.games.length >= MAX_GAMES) return fail('full')
      if (g) this.remove(id)
      this.data.limits[`create:${id}`] = now + 10_000
      this.data.games.push({
        id: this.uuid(),
        host: id,
        options: { ...action.options },
        ...(action.options.mode === 'solo' ? { solo: createSoloRun() } : {}),
        phase: 'lobby',
        players: [{ id, profile: visitor.profile, score: 0, absentSince: null }],
        rounds: [],
        round: 0,
        answers: {},
        started: now,
        deadline: now + (action.options.mode === 'solo' ? 24 * 60 * 60_000 : 10 * 60_000),
        pausedAt: null,
        updated: now,
      })
      // Received invitations stay valid: a lobby that has not started can still be swapped.
      return
    }
    if (action.action === 'accept' || action.action === 'decline') {
      const invite = this.data.invitations.find(i => i.id === action.invitation && i.to === id)
      if (!invite) return fail('expired')
      if (action.action === 'decline') {
        this.data.invitations = this.data.invitations.filter(i => i !== invite)
        return
      }
      // A lobby that has not started, or a finished summary, can be swapped for this one.
      if (g && !this.available(g)) return fail('busy')
      const target = this.data.games.find(
        item => item.id === invite.gameId && item.phase === 'lobby'
      )
      if (!target) return fail('expired')
      if (g === target) return
      if (target.players.length >= 4) return fail('full')
      if (g) this.remove(id)
      target.players.push({ id, profile: visitor.profile, score: 0, absentSince: null })
      this.data.invitations = this.data.invitations.filter(i => i.to !== id)
      return
    }
    if (!g) return fail('expired')
    if (g.solo) return this.soloCommand(g, id, action)
    if (action.action === 'invite') {
      if (g.phase !== 'lobby' || g.host !== id) return fail('not_host')
      if (g.players.length >= 4) return fail('full')
      const target = this.visitor(action.target)
      if (!target?.present || target.id === id) return fail('unavailable')
      const other = this.current(target.id)
      if (other === g || (other && !this.available(other))) return fail('busy')
      if (Math.hypot(target.x - visitor.x, target.y - visitor.y) > 180) return fail('too_far')
      if (
        (this.data.limits[`invite:${id}:${target.id}`] ?? 0) > now ||
        this.data.invitations.filter(i => i.to === target.id).length >= 3
      )
        return fail('rate_limited')
      this.data.limits[`invite:${id}:${target.id}`] = now + INVITE_MS
      this.data.invitations.push({
        id: this.uuid(),
        gameId: g.id,
        from: id,
        to: target.id,
        expires: now + INVITE_MS,
      })
      return
    }
    if (action.action === 'start') {
      if (g.host !== id) return fail('not_host')
      if (
        g.phase !== 'lobby' ||
        g.players.length < 2 ||
        g.players.some(p => p.absentSince !== null)
      )
        return fail('not_ready')
      g.phase = 'generating'
      g.operation = this.uuid()
      g.deadline = now + 15_000
      delete g.reason
      this.data.invitations = this.data.invitations.filter(i => i.gameId !== g!.id)
      return {
        type: 'generate',
        gameId: g.id,
        operation: g.operation,
        options: g.options,
        players: g.players.map(p => this.visitor(p.id)?.historyId ?? p.id),
      }
    }
    if (action.action === 'next') {
      if (g.host !== id) return fail('not_host')
      if (g.phase !== 'reveal' || g.pausedAt !== null) return fail('not_ready')
      if (g.round === 4) this.finish(g)
      else {
        g.round++
        this.begin(g)
      }
      return
    }
    if (action.action === 'answer') {
      if (
        g.id !== action.gameId ||
        g.round !== action.round ||
        g.phase !== 'question' ||
        g.pausedAt !== null ||
        (g.startsAt ?? 0) > now ||
        (g.who?.frozenAt ?? now) >= g.deadline
      )
        return fail('not_ready')
      if (g.who && (action.zone !== g.who.zone || !this.whoEligible(g, id)))
        return fail('not_ready')
      const previous = g.who && g.answers[id]?.zone !== g.who.zone ? undefined : g.answers[id]
      if (previous && ['pending', 'correct', 'wrong'].includes(previous.status)) return
      if (previous && previous.attempts >= 3) return fail('rate_limited')
      const r = g.rounds[g.round]
      if (
        g.options.kind === 'quiz' &&
        g.options.difficulty === 'easy' &&
        r.choices.length > 0 &&
        !r.choices.includes(action.text)
      )
        return fail('invalid')
      const exact = [r.answer, ...r.aliases].some(
        a => normalizeAnswer(a) === normalizeAnswer(action.text)
      )
      const choice =
        g.options.kind === 'quiz' && g.options.difficulty === 'easy' && r.choices.length > 0
      const a: Answer = {
        text: action.text,
        status: exact ? 'correct' : choice ? 'wrong' : 'pending',
        operation: this.uuid(),
        attempts: (previous?.attempts ?? 0) + 1,
        expires: now + 12_000,
      }
      if (g.who) {
        a.zone = g.who.zone
        a.sequence = ++g.who.sequence
      }
      g.answers[id] = a
      this.settleWho(g)
      if (this.completed(g)) this.reveal(g)
      if (a.status === 'pending')
        return {
          type: 'evaluate',
          gameId: g.id,
          round: g.round,
          player: id,
          operation: a.operation,
          text: a.text,
          content: r,
        }
    }
  }
  private soloVerdict(
    g: Game,
    a: Answer,
    status: 'correct' | 'wrong' | 'clarify' | 'unavailable' | 'skipped'
  ): Effect | undefined {
    if (!g.solo || !settleSolo(g.solo, a.operation, status, this.now())) return
    g.players[0].score = g.solo.best
    if (status === 'correct' || status === 'wrong' || status === 'skipped') {
      ;(g.soloAnswers ??= []).push({ round: g.round, text: a.text, status })
      g.soloFeedback = { round: g.round, status, at: this.now() }
      if (g.solo.outcome) this.finish(g)
      else return this.advanceSolo(g)
    }
  }
  private advanceSolo(g: Game): Effect | undefined {
    if (g.round + 1 >= SOLO_MAX_QUESTIONS) {
      g.solo!.outcome = 'exhausted'
      g.solo!.runningSince = null
      this.finish(g)
      return
    }
    g.round++
    g.answers = {}
    resumeSolo(g.solo!, 'feedback', this.now())
    if (g.round >= g.rounds.length) return this.prepareSolo(g)
    g.phase = 'question'
    g.deadline = this.now() + 24 * 60 * 60_000
  }
  private prepareSolo(g: Game): Effect {
    const now = this.now()
    pauseSolo(g.solo!, 'preparing', now)
    g.phase = 'generating'
    g.operation = this.uuid()
    g.deadline = now + 15_000
    delete g.reason
    return {
      type: 'generate',
      gameId: g.id,
      operation: g.operation,
      options: g.options,
      players: g.players.map(p => this.visitor(p.id)?.historyId ?? p.id),
      exclude: g.rounds.map(r => r.catalogueId ?? r.answer),
      count: SOLO_MAX_QUESTIONS - g.rounds.length,
    }
  }
  private soloCommand(g: Game, id: string, action: GameAction): Effect | undefined {
    const run = g.solo!,
      now = this.now()
    if (id !== g.host) return fail('not_host')
    if (action.action === 'pause-solo') {
      pauseSolo(run, 'menu', now)
      return
    }
    if (action.action === 'resume-solo') {
      resumeSolo(run, 'menu', now)
      return
    }
    if (action.action === 'invite') return fail('not_ready')
    if (action.action === 'start') {
      if (g.phase !== 'lobby') return fail('not_ready')
      return this.prepareSolo(g)
    }
    if (action.action === 'next') {
      if (run.outcome || run.pauses.includes('away')) return fail('not_ready')
      // Resume a persisted pre-continuous round without displaying its correction.
      if (g.phase === 'reveal') return this.advanceSolo(g)
      if (g.phase !== 'question' || !['clarify', 'unavailable'].includes(g.answers[id]?.status))
        return fail('not_ready')
      resumeSolo(run, 'feedback', now)
      resumeSolo(run, 'technical', now)
      delete g.answers[id]
      return
    }
    if (action.action === 'pass') {
      if (
        g.phase !== 'question' ||
        action.gameId !== g.id ||
        action.round !== g.round ||
        (g.startsAt ?? 0) > now
      )
        return fail('not_ready')
      const operation = this.uuid()
      if (!submitSolo(run, operation, now)) return fail('not_ready')
      const a: Answer = { text: '', status: 'skipped', operation, attempts: 1, expires: now }
      g.answers[id] = a
      return this.soloVerdict(g, a, 'skipped')
    }
    if (action.action === 'answer') {
      if (
        g.phase !== 'question' ||
        action.gameId !== g.id ||
        action.round !== g.round ||
        (g.startsAt ?? 0) > now
      )
        return fail('not_ready')
      const r = g.rounds[g.round]
      const operation = this.uuid()
      if (!submitSolo(run, operation, now)) return fail('not_ready')
      const exact = [r.answer, ...r.aliases].some(
        a => normalizeAnswer(a) === normalizeAnswer(action.text)
      )
      const a: Answer = {
        text: action.text,
        status: exact ? 'correct' : 'pending',
        operation,
        attempts: 1,
        expires: now + 12_000,
      }
      g.answers[id] = a
      if (a.status === 'pending')
        return {
          type: 'evaluate',
          gameId: g.id,
          round: g.round,
          player: id,
          operation,
          text: a.text,
          content: r,
        }
      return this.soloVerdict(g, a, a.status as 'correct' | 'wrong')
    }
  }
  generated(effect: Extract<Effect, { type: 'generate' }>, rounds: Round[] | null) {
    const g = this.data.games.find(g => g.id === effect.gameId)
    if (
      !g ||
      g.phase !== 'generating' ||
      g.operation !== effect.operation ||
      g.deadline <= this.now()
    )
      return
    if (
      !rounds ||
      (g.solo
        ? !rounds.length || rounds.length > SOLO_MAX_QUESTIONS - g.rounds.length
        : rounds.length !== 5)
    ) {
      g.phase = 'lobby'
      g.reason = 'generation_failed'
      g.deadline = this.now() + (g.solo ? 24 * 60 * 60_000 : 10 * 60_000)
      return
    }
    if (g.solo) {
      const identity = (r: Round) => r.catalogueId ?? normalizeAnswer(r.answer)
      const previous = new Set(g.rounds.map(identity))
      const fresh = rounds.filter(r => !previous.has(identity(r)))
      if (!fresh.length) {
        g.phase = 'lobby'
        g.reason = 'generation_failed'
        g.deadline = this.now() + 24 * 60 * 60_000
        return
      }
      const first = g.rounds.length === 0
      g.rounds.push(...fresh)
      g.phase = 'question'
      g.answers = {}
      g.deadline = this.now() + 24 * 60 * 60_000
      resumeSolo(g.solo, 'preparing', this.now())
      if (first) {
        // The 120 s clock starts after the countdown, not while it plays.
        g.startsAt = this.now() + START_DELAY_MS
        if (g.solo.runningSince !== null) g.solo.runningSince = g.startsAt
      }
      return
    }
    g.rounds = rounds
    this.begin(g)
    g.startsAt = this.now() + START_DELAY_MS
    g.deadline += START_DELAY_MS
    g.started += START_DELAY_MS
    if (this.pausing(g)) g.pausedAt = this.now()
    this.settleWho(g)
  }
  evaluated(
    effect: Extract<Effect, { type: 'evaluate' }>,
    status: 'correct' | 'wrong' | 'clarify' | 'unavailable'
  ) {
    const g = this.data.games.find(g => g.id === effect.gameId),
      a = g?.answers[effect.player]
    if (
      !g ||
      g.phase !== 'question' ||
      g.round !== effect.round ||
      !a ||
      a.operation !== effect.operation ||
      a.status !== 'pending'
    )
      return
    a.status = status
    if (g.solo) {
      return this.soloVerdict(g, a, status)
    }
    this.settleWho(g)
    if (g.pausedAt === null && this.completed(g)) this.reveal(g)
  }
  private whoEligible(g: Game, id: string) {
    const w = g.who
    if (!w || !g.players.some(p => p.id === id)) return false
    const a = g.answers[id]
    const used =
      a?.zone === w.zone && (a.attempts >= 3 || ['pending', 'correct', 'wrong'].includes(a.status))
    return !used && (w.mode === 'race' || w.active === id)
  }
  private advanceWho(g: Game, at: number) {
    const w = g.who!
    if (w.zone === 3) {
      this.reveal(g)
      return
    }
    w.zone++
    w.active = w.mode === 'duel' ? w.order[(g.round + w.zone) % 2] : null
    g.deadline = at + WHO_ZONE_MS[w.zone]
    // Catch up after a delayed alarm without adding free time to the round.
    if (g.deadline <= this.now()) this.advanceWho(g, g.deadline)
  }
  private settleWho(g: Game) {
    const w = g.who
    if (!w || g.phase !== 'question') return
    // Process submissions in receipt order, never in provider completion order.
    for (const [id, a] of Object.entries(g.answers).sort(
      ([, a], [, b]) => (a.sequence ?? 0) - (b.sequence ?? 0)
    )) {
      if (a.zone !== w.zone || a.processed) continue
      if (a.status === 'pending') break
      if (g.pausedAt !== null) break
      a.processed = true
      if (a.status === 'correct') {
        w.winner = id
        w.awarded = 4 - w.zone
        this.reveal(g)
        return
      }
      if (a.status === 'unavailable') {
        this.reveal(g)
        return
      }
      if (w.mode === 'duel' && (a.status === 'wrong' || a.attempts >= 3))
        w.active = g.players.find(p => p.id !== id)?.id ?? null
    }
    const frozen = g.pausedAt !== null || Object.values(g.answers).some(a => a.status === 'pending')
    if (frozen) w.frozenAt ??= this.now()
    else if (w.frozenAt !== null) {
      g.deadline += this.now() - w.frozenAt
      w.frozenAt = null
    }
    if (!frozen && !g.players.some(p => this.whoEligible(g, p.id))) this.advanceWho(g, this.now())
  }
  tick() {
    const now = this.now()
    this.data.invitations = this.data.invitations.filter(
      i => i.expires > now && this.data.games.some(g => g.id === i.gameId && g.phase === 'lobby')
    )
    for (const [key, until] of Object.entries(this.data.limits))
      if (until <= now) delete this.data.limits[key]
    for (const g of [...this.data.games]) {
      if (g.solo) {
        const a = g.answers[g.host]
        if (a?.status === 'pending' && a.expires <= now) {
          a.status = 'unavailable'
          this.soloVerdict(g, a, 'unavailable')
        }
        tickSolo(g.solo, now)
        if (g.solo.outcome && g.phase !== 'finished') this.finish(g)
        if (g.phase === 'generating' && g.deadline <= now) {
          g.phase = 'lobby'
          g.reason = 'generation_failed'
          g.deadline = now + 24 * 60 * 60_000
        } else if (g.deadline <= now) this.data.games = this.data.games.filter(item => item !== g)
        continue
      }
      for (const p of [...g.players])
        if (p.absentSince !== null && p.absentSince + REJOIN_MS <= now) this.remove(p.id)
      if (!this.data.games.includes(g)) continue
      if (g.phase === 'question')
        for (const a of Object.values(g.answers))
          if (a.status === 'pending' && a.expires <= now) a.status = 'unavailable'
      this.unpause(g)
      if (g.pausedAt !== null || (g.phase === 'question' && g.who?.frozenAt != null)) continue
      if (g.phase === 'question' && g.pausedAt === null && this.completed(g)) this.reveal(g)
      if (g.deadline > now) continue
      if (g.phase === 'generating') {
        g.phase = 'lobby'
        g.reason = 'generation_failed'
        g.deadline = now + 10 * 60_000
      } else if (g.phase === 'question') {
        if (g.who) this.advanceWho(g, g.deadline)
        else if (!Object.values(g.answers).some(a => a.status === 'pending')) this.reveal(g)
      } else if (g.phase === 'reveal') {
        if (g.round === 4) this.finish(g)
        else {
          g.round++
          this.begin(g)
        }
      } else this.data.games = this.data.games.filter(item => item !== g)
    }
  }
  nextWake() {
    const now = this.now(),
      times = this.data.invitations.map(i => i.expires)
    for (const g of this.data.games) {
      if (g.solo) {
        times.push(Math.max(now + 1000, g.deadline))
        if (g.solo.runningSince !== null) times.push(now + soloRemaining(g.solo, now))
        for (const a of Object.values(g.answers)) if (a.status === 'pending') times.push(a.expires)
        continue
      }
      if (g.pausedAt === null && !(g.phase === 'question' && g.who?.frozenAt != null)) {
        times.push(Math.max(now + 1000, g.deadline))
        if (g.phase === 'question' && !g.who)
          for (const offset of [15_000, 30_000])
            if (g.started + offset > now) times.push(g.started + offset)
      }
      for (const p of g.players)
        if (p.absentSince !== null) {
          times.push(p.absentSince + REJOIN_MS)
          const left = this.pauseLeft(g, p, now)
          if (left > 0 && g.pausedAt !== null) times.push(now + left)
        }
      for (const a of Object.values(g.answers)) if (a.status === 'pending') times.push(a.expires)
    }
    return times.length ? Math.min(...times) : null
  }
  snapshot(id: string): GamesSnapshot {
    const g = this.current(id),
      now = this.now()
    const invitations = this.data.invitations
      .filter(i => i.to === id && i.expires > now)
      .flatMap(i => {
        const game = this.data.games.find(g => g.id === i.gameId),
          from = game?.players.find(p => p.id === i.from)
        return game && from
          ? [
              {
                id: i.id,
                gameId: game.id,
                from: from.profile,
                options: game.options,
                expires: i.expires,
              },
            ]
          : []
      })
    if (!g) return { game: null, invitations, now }
    const view: GameView = {
      ...(g.solo ? { solo: structuredClone(g.solo) } : {}),
      id: g.id,
      host: g.host,
      options: g.options,
      phase: g.phase,
      players: g.players.map(p => ({ ...p })),
      round: g.round,
      total: g.solo ? g.rounds.length : 5,
      deadline: g.deadline,
      pausedAt: g.pausedAt,
      pausedUntil:
        g.pausedAt === null
          ? null
          : Math.max(
              now,
              ...g.players
                .filter(p => p.absentSince !== null && this.pauseLeft(g, p, now) > 0)
                .map(p => now + this.pauseLeft(g, p, now))
            ),
      ...(g.startsAt !== undefined ? { startsAt: g.startsAt } : {}),
      ...(g.standings ? { standings: g.standings.map(p => ({ ...p })) } : {}),
      invited: this.data.invitations.filter(i => i.gameId === g.id).map(i => i.to),
      answered: Object.keys(g.answers),
      reason: g.reason,
    }
    const r = g.rounds[g.round]
    if (r && ['question', 'reveal', 'finished'].includes(g.phase)) {
      view.question = r.question
      view.clues = r.clues.slice(
        0,
        g.phase === 'question'
          ? g.who
            ? g.who.zone + 1
            : Math.min(3, 1 + Math.floor(Math.max(0, (g.pausedAt ?? now) - g.started) / 15_000))
          : g.who
            ? 4
            : 3
      )
      if (
        !g.solo &&
        g.options.kind === 'quiz' &&
        g.options.difficulty === 'easy' &&
        r.choices.length > 0
      )
        view.choices = r.choices
      if (g.who)
        view.who = {
          mode: g.who.mode,
          zone: g.who.zone,
          points: 4 - g.who.zone,
          active: g.who.active,
          eligible:
            g.phase === 'question'
              ? g.players.filter(p => this.whoEligible(g, p.id)).map(p => p.id)
              : [],
          checking: Object.entries(g.answers)
            .filter(([, a]) => g.phase === 'question' && a.zone === g.who!.zone && !a.processed)
            .map(([id]) => id),
          frozenAt: g.who.frozenAt,
          winner: g.who.winner,
          awarded: g.who.awarded,
        }
      const a = g.answers[id]
      if (a)
        view.ownAnswer = {
          zone: a.zone,
          text: a.text,
          retriesLeft: Math.max(0, 3 - (g.who && a.zone !== g.who.zone ? 0 : a.attempts)),
          status:
            !g.solo && (a.status === 'correct' || (!g.who && a.status === 'wrong'))
              ? g.phase === 'question'
                ? 'pending'
                : a.status
              : a.status,
        }
      if (!g.solo && g.phase !== 'question')
        view.result = {
          answer: r.answer,
          explanation: r.explanation,
          reference: r.reference,
          url: r.url,
          ...(r.sources ? { sources: r.sources } : {}),
          void: !!g.void,
          answers: Object.entries(g.answers).map(([id, a]) => ({
            id,
            text: a.text,
            status: a.status,
          })),
        }
    }
    if (g.solo) {
      if (g.soloFeedback) view.soloFeedback = { ...g.soloFeedback }
      if (g.phase === 'finished') {
        const answers: {
          round: number
          text: string
          status: 'correct' | 'wrong' | 'skipped' | 'timeout'
        }[] = [...(g.soloAnswers ?? [])]
        if (g.solo.outcome === 'timeout' && r && !answers.some(a => a.round === g.round))
          answers.push({ round: g.round, text: '', status: 'timeout' })
        view.soloReviewIncomplete = (g.soloAnswers?.length ?? 0) < g.solo.answered
        view.soloReview = answers.flatMap(a => {
          const content = g.rounds[a.round]
          return content
            ? [
                {
                  ...a,
                  question: content.question,
                  answer: content.answer,
                  explanation: content.explanation,
                  sources: content.sources ?? [{ reference: content.reference, url: content.url }],
                },
              ]
            : []
        })
      }
    }
    return { game: view, invitations, now }
  }
}
