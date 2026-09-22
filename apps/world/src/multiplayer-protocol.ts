import { isAvatarActivity, type AvatarActivity } from './avatar-activity'
import { isReaction, type ReactionId } from './reactions'
import {
  parseGameAction,
  type GameAction,
  type GameError,
  type GamesSnapshot,
} from './games-protocol'
import { parseProfile, type AvatarProfile } from './avatar-profile'

export const ROOM = 'asi-europe'
export const PROTOCOL_VERSION = 2
export const SEND_INTERVAL = 1000 / 15
export const MAX_PLAYERS = 100
export type Pose = { x: number; y: number; dx: number; dy: number; moving: boolean }
export type Player = { id: string; profile: AvatarProfile; pose: Pose; seq: number; activity?: AvatarActivity | null }
export type ClientMessage =
  | { type: 'activity'; activity: AvatarActivity | null }
  | { type: 'reaction'; reaction: ReactionId }
  | { type: 'game'; command: GameAction }
  | {
      type: 'join'
      version: number
      profile: AvatarProfile
      pose: Pose
      resumeToken?: string
      gameHistoryId?: string
    }
  | { type: 'visibility'; hidden: boolean }
  | { type: 'move'; pose: Pose; seq: number; activity?: AvatarActivity | null }
  | { type: 'profile'; profile: AvatarProfile }
  | { type: 'ping' }
export type ServerMessage =
  | { type: 'reaction'; id: string; reaction: ReactionId }
  | { type: 'game-error'; error: GameError }
  | { type: 'games'; snapshot: GamesSnapshot; error?: GameError }
  | { type: 'welcome'; id: string; spawn: Pose; players: Player[]; resumeToken?: string }
  | { type: 'player'; player: Player }
  | { type: 'frame'; players: Player[] }
  | { type: 'leave'; id: string }
  | { type: 'pong' }
  | { type: 'full' }
  /** The page speaks another protocol version and must reload. */
  | { type: 'outdated' }
export type PresenceStatus = {
  state: 'connecting' | 'online' | 'offline' | 'full' | 'outdated'
  count: number
}
/** A join from another protocol version, reported instead of treated as garbage. */
export function isOutdatedJoin(raw: string) {
  if (raw.length > 4096) return false
  try {
    const m = JSON.parse(raw)
    return !!m && m.type === 'join' && m.version !== PROTOCOL_VERSION
  } catch {
    return false
  }
}

export function parsePose(value: unknown): Pose | null {
  if (!value || typeof value !== 'object') return null
  const p = value as Record<string, unknown>
  if (![p.x, p.y, p.dx, p.dy].every(n => typeof n === 'number' && Number.isFinite(n))) return null
  const { x, y, dx, dy } = p as Pose
  if (
    x < 0 ||
    x > 1671 ||
    y < 0 ||
    y > 941 ||
    Math.abs(dx) > 1 ||
    Math.abs(dy) > 1 ||
    typeof p.moving !== 'boolean'
  )
    return null
  return { x, y, dx, dy, moving: p.moving }
}

export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > 1024) return null
  try {
    const m = JSON.parse(raw)
    if (!m || typeof m !== 'object') return null
    if (m.type === 'game') {
      const command = parseGameAction(m.command)
      return command ? { type: 'game', command } : null
    }
    if (m.type === 'reaction')
      return isReaction(m.reaction) ? { type: 'reaction', reaction: m.reaction } : null
    if (m.type === 'activity')
      return m.activity === null || isAvatarActivity(m.activity) ? { type: 'activity', activity: m.activity } : null
    if (m.type === 'ping') return { type: 'ping' }
    if (m.type === 'visibility' && typeof m.hidden === 'boolean')
      return { type: 'visibility', hidden: m.hidden }
    if (m.type === 'join' && m.version === PROTOCOL_VERSION) {
      const profile = parseProfile(m.profile),
        pose = parsePose(m.pose)
      for (const token of [m.resumeToken, m.gameHistoryId])
        if (
          token !== undefined &&
          (typeof token !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token))
        )
          return null
      return profile && pose
        ? {
            type: 'join',
            version: PROTOCOL_VERSION,
            profile,
            pose,
            ...(m.gameHistoryId ? { gameHistoryId: m.gameHistoryId } : {}),
            ...(m.resumeToken ? { resumeToken: m.resumeToken } : {}),
          }
        : null
    }
    if (m.type === 'profile') {
      const profile = parseProfile(m.profile)
      return profile ? { type: 'profile', profile } : null
    }
    if (m.type === 'move' && Number.isSafeInteger(m.seq) && m.seq > 0) {
      const pose = parsePose(m.pose)
      return pose ? { type: 'move', pose, seq: m.seq } : null
    }
  } catch {
    /* Untrusted frames must never escape into the room. */
  }
  return null
}
