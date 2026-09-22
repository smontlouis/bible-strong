import { WHO_ZONE_MS } from '../../src/games-protocol'
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
const ROUND_MS = 60_000
export type Round = {
  researchQuestion?: string
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
}
type Invitation = { id: string; gameId: string; from: string; to: string; expires: number }
export type GameData = { games: Game[]; invitations: Invitation[]; limits: Record<string, number> }
export type Visitor = { id: string; profile: AvatarProfile; x: number; y: number; present: boolean }
export type Effect =
  | { type: 'generate'; gameId: string; operation: string; options: GameOptions }
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
    g.deadline = this.now() + 10 * 60_000
    g.updated = this.now()
  }
  private begin(g: Game) {
    g.phase = 'question'
    g.answers = {}
    g.void = false
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
    return !g.who && g.players.every(p => ['correct', 'wrong'].includes(g.answers[p.id]?.status))
  }
  private remove(id: string) {
    const g = this.current(id)
    if (!g) return
    g.players = g.players.filter(p => p.id !== id)
    delete g.answers[id]
    if (g.host === id)
      g.host = g.players.find(p => p.absentSince === null)?.id ?? g.players[0]?.id ?? ''
    if (!g.players.length) this.data.games = this.data.games.filter(item => item !== g)
    else if (g.phase !== 'lobby' && g.phase !== 'finished' && g.players.length < 2)
      this.finish(g, 'not_enough_players')
    this.data.invitations = this.data.invitations.filter(i => i.from !== id && i.to !== id)
    this.unpause(g)
    if (g.phase === 'question' && g.pausedAt === null && this.completed(g)) this.reveal(g)
  }
  private unpause(g: Game) {
    if (g.pausedAt !== null && g.players.every(p => p.absentSince === null)) {
      const duration = this.now() - g.pausedAt
      if (!g.who || g.phase !== 'question') {
        g.deadline += duration
        g.started += duration
      }
      g.pausedAt = null
    }
    this.settleWho(g)
  }
  presence(id: string, present: boolean) {
    this.tick()
    const g = this.current(id),
      p = g?.players.find(p => p.id === id)
    if (!g || !p || g.phase === 'finished') return
    if (present) {
      p.absentSince = null
      this.unpause(g)
      if (g.phase === 'question' && g.pausedAt === null && this.completed(g)) this.reveal(g)
    } else if (p.absentSince === null) {
      p.absentSince = this.now()
      if (g.phase === 'question' || g.phase === 'reveal') g.pausedAt ??= this.now()
      this.settleWho(g)
    }
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
      if (this.data.games.length >= 50 && !g) return fail('full')
      if (g) this.remove(id)
      this.data.limits[`create:${id}`] = now + 10_000
      this.data.games.push({
        id: this.uuid(),
        host: id,
        options: { ...action.options },
        phase: 'lobby',
        players: [{ id, profile: visitor.profile, score: 0, absentSince: null }],
        rounds: [],
        round: 0,
        answers: {},
        started: now,
        deadline: now + 10 * 60_000,
        pausedAt: null,
        updated: now,
      })
      this.data.invitations = this.data.invitations.filter(i => i.to !== id)
      return
    }
    if (action.action === 'accept' || action.action === 'decline') {
      const invite = this.data.invitations.find(i => i.id === action.invitation && i.to === id)
      if (!invite) return fail('expired')
      if (action.action === 'decline') {
        this.data.invitations = this.data.invitations.filter(i => i !== invite)
        return
      }
      if (g && g.phase !== 'finished') return fail('busy')
      const target = this.data.games.find(
        item => item.id === invite.gameId && item.phase === 'lobby'
      )
      if (!target) return fail('expired')
      if (target.players.length >= 4) return fail('full')
      if (g) this.remove(id)
      target.players.push({ id, profile: visitor.profile, score: 0, absentSince: null })
      this.data.invitations = this.data.invitations.filter(i => i.to !== id)
      return
    }
    if (!g) return fail('expired')
    if (action.action === 'invite') {
      if (g.phase !== 'lobby' || g.host !== id) return fail('not_host')
      if (g.players.length >= 4) return fail('full')
      const target = this.visitor(action.target)
      if (!target?.present || target.id === id) return fail('unavailable')
      if (
        this.current(target.id)?.phase !== undefined &&
        this.current(target.id)?.phase !== 'finished'
      )
        return fail('busy')
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
      if (
        (this.data.limits[`generate:${id}`] ?? 0) > now ||
        this.data.games.filter(g => g.phase === 'generating').length >= 3 ||
        Object.keys(this.data.limits).filter(key => key.startsWith('budget:')).length >= 60
      )
        return fail('rate_limited')
      this.data.limits[`generate:${id}`] = now + 60_000
      g.phase = 'generating'
      g.operation = this.uuid()
      this.data.limits[`budget:${g.operation}`] = now + 60 * 60_000
      g.deadline = now + 180_000
      delete g.reason
      this.data.invitations = this.data.invitations.filter(i => i.gameId !== g!.id)
      return { type: 'generate', gameId: g.id, operation: g.operation, options: g.options }
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
        !r.choices.includes(action.text)
      )
        return fail('invalid')
      const exact = [r.answer, ...r.aliases].some(
        a => normalizeAnswer(a) === normalizeAnswer(action.text)
      )
      const choice = g.options.kind === 'quiz' && g.options.difficulty === 'easy'
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
  generated(effect: Extract<Effect, { type: 'generate' }>, rounds: Round[] | null) {
    const g = this.data.games.find(g => g.id === effect.gameId)
    if (
      !g ||
      g.phase !== 'generating' ||
      g.operation !== effect.operation ||
      g.deadline <= this.now()
    )
      return
    if (!rounds || rounds.length !== 5) {
      g.phase = 'lobby'
      g.reason = 'generation_failed'
      g.deadline = this.now() + 10 * 60_000
      return
    }
    g.rounds = rounds
    this.begin(g)
    if (g.players.some(p => p.absentSince !== null)) g.pausedAt = this.now()
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
      for (const p of [...g.players])
        if (p.absentSince !== null && p.absentSince + REJOIN_MS <= now) this.remove(p.id)
      for (const a of Object.values(g.answers))
        if (a.status === 'pending' && a.expires <= now) a.status = 'unavailable'
      this.settleWho(g)
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
      if (g.pausedAt === null && !(g.phase === 'question' && g.who?.frozenAt != null)) {
        times.push(Math.max(now + 1000, g.deadline))
        if (g.phase === 'question' && !g.who)
          for (const offset of [15_000, 30_000])
            if (g.started + offset > now) times.push(g.started + offset)
      }
      for (const p of g.players) if (p.absentSince !== null) times.push(p.absentSince + REJOIN_MS)
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
      id: g.id,
      host: g.host,
      options: g.options,
      phase: g.phase,
      players: g.players.map(p => ({ ...p })),
      round: g.round,
      total: 5,
      deadline: g.deadline,
      pausedAt: g.pausedAt,
      pausedUntil:
        g.pausedAt === null
          ? null
          : Math.min(
              ...g.players.filter(p => p.absentSince !== null).map(p => p.absentSince! + REJOIN_MS)
            ),
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
            : Math.min(3, 1 + Math.floor(((g.pausedAt ?? now) - g.started) / 15_000))
          : g.who
            ? 4
            : 3
      )
      if (g.options.kind === 'quiz' && g.options.difficulty === 'easy') view.choices = r.choices
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
            a.status === 'correct' || (!g.who && a.status === 'wrong')
              ? g.phase === 'question'
                ? 'pending'
                : a.status
              : a.status,
        }
      if (g.phase !== 'question')
        view.result = {
          answer: r.answer,
          explanation: r.explanation,
          reference: r.reference,
          url: r.url,
          void: !!g.void,
          answers: Object.entries(g.answers).map(([id, a]) => ({
            id,
            text: a.text,
            status: a.status,
          })),
        }
    }
    return { game: view, invitations, now }
  }
}
