import type { SoloRun } from './solo-game'
import type { AvatarProfile } from './avatar-profile'

export type GameOptions = {
  mode?: 'solo' | 'together'
  kind: 'who' | 'quiz'
  difficulty: 'easy' | 'medium' | 'hard'
  subject: 'people' | 'places' | 'objects' | 'mixed'
  testament: 'old' | 'new' | 'both'
  language: 'fr' | 'en'
}
export type GameAction =
  | { action: 'create'; options: GameOptions }
  | { action: 'invite'; target: string }
  | { action: 'accept' | 'decline'; invitation: string }
  | { action: 'start' | 'leave' | 'next' | 'sync' | 'pause-solo' | 'resume-solo' }
  | { action: 'pass'; gameId: string; round: number }
  | { action: 'answer'; gameId: string; round: number; zone?: number; text: string }
export type GameError =
  | 'busy'
  | 'expired'
  | 'full'
  | 'not_host'
  | 'not_ready'
  | 'too_far'
  | 'unavailable'
  | 'rate_limited'
  | 'invalid'
export type AnswerStatus = 'pending' | 'correct' | 'wrong' | 'clarify' | 'unavailable' | 'skipped'
export type GameMember = {
  id: string
  profile: AvatarProfile
  score: number
  absentSince: number | null
}
export type GameInvitation = {
  id: string
  gameId: string
  from: AvatarProfile
  options: GameOptions
  expires: number
}
export const WHO_ZONE_MS = [20_000, 20_000, 12_000, 8_000] as const
export type WhoView = {
  mode: 'duel' | 'race'
  zone: number
  points: number
  active: string | null
  eligible: string[]
  checking: string[]
  frozenAt: number | null
  winner?: string
  awarded?: number
}
export type GameView = {
  solo?: SoloRun
  who?: WhoView
  id: string
  host: string
  options: GameOptions
  phase: 'lobby' | 'generating' | 'question' | 'reveal' | 'finished'
  players: GameMember[]
  round: number
  total: number
  pausedAt: number | null
  pausedUntil: number | null
  deadline: number
  question?: string
  clues?: string[]
  choices?: string[]
  invited: string[]
  answered: string[]
  ownAnswer?: { zone?: number; text: string; status: AnswerStatus; retriesLeft: number }
  result?: {
    answer: string
    explanation: string
    reference: string
    url: string
    void: boolean
    answers: { id: string; text: string; status: AnswerStatus }[]
  }
  reason?: 'generation_failed' | 'not_enough_players' | 'expired'
}
export type GamesSnapshot = { game: GameView | null; invitations: GameInvitation[]; now: number }

export function parseGameAction(value: unknown): GameAction | null {
  if (!value || typeof value !== 'object') return null
  const m = value as Record<string, unknown>
  const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(v)
  if (m.action === 'create') {
    const o = m.options as GameOptions | undefined
    if (
      !o ||
      !['who', 'quiz'].includes(o.kind) ||
      (o.mode !== undefined && !['solo', 'together'].includes(o.mode)) ||
      (o.mode === 'solo' && o.kind !== 'quiz') ||
      !['easy', 'medium', 'hard'].includes(o.difficulty) ||
      !['people', 'places', 'objects', 'mixed'].includes(o.subject) ||
      !['old', 'new', 'both'].includes(o.testament) ||
      !['fr', 'en'].includes(o.language)
    )
      return null
    return {
      action: 'create',
      options: {
        ...(o.mode ? { mode: o.mode } : {}),
        kind: o.kind,
        difficulty: o.difficulty,
        subject: o.subject,
        testament: o.testament,
        language: o.language,
      },
    }
  }
  if (m.action === 'invite' && id(m.target)) return { action: 'invite', target: m.target }
  if ((m.action === 'accept' || m.action === 'decline') && id(m.invitation))
    return { action: m.action, invitation: m.invitation }
  if (
    m.action === 'start' ||
    m.action === 'leave' ||
    m.action === 'next' ||
    m.action === 'sync' ||
    m.action === 'pause-solo' ||
    m.action === 'resume-solo'
  )
    return { action: m.action }
  if (
    m.action === 'pass' &&
    id(m.gameId) &&
    Number.isInteger(m.round) &&
    Number(m.round) >= 0 &&
    Number(m.round) < 50
  )
    return { action: 'pass', gameId: m.gameId, round: Number(m.round) }
  if (
    m.action === 'answer' &&
    id(m.gameId) &&
    Number.isInteger(m.round) &&
    Number(m.round) >= 0 &&
    Number(m.round) < 50 &&
    typeof m.text === 'string' &&
    m.text.trim().length > 0 &&
    m.text.length <= 160 &&
    (m.zone === undefined ||
      (Number.isInteger(m.zone) && Number(m.zone) >= 0 && Number(m.zone) <= 3))
  )
    return {
      action: 'answer',
      gameId: m.gameId,
      round: Number(m.round),
      ...(m.zone === undefined ? {} : { zone: Number(m.zone) }),
      text: m.text.trim(),
    }
  return null
}
