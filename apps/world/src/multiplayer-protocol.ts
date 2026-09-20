import { parseProfile, type AvatarProfile } from './avatar-profile'

export const ROOM = 'asi-europe'
export const PROTOCOL_VERSION = 2
export const SEND_INTERVAL = 1000 / 15
export const MAX_PLAYERS = 100
export type Pose = { x: number; y: number; dx: number; dy: number; moving: boolean }
export type Player = { id: string; profile: AvatarProfile; pose: Pose; seq: number }
export type ClientMessage =
  | { type: 'join'; version: number; profile: AvatarProfile; pose: Pose }
  | { type: 'move'; pose: Pose; seq: number }
  | { type: 'profile'; profile: AvatarProfile }
  | { type: 'ping' }
export type ServerMessage =
  | { type: 'welcome'; id: string; spawn: Pose; players: Player[] }
  | { type: 'player'; player: Player }
  | { type: 'frame'; players: Player[] }
  | { type: 'leave'; id: string }
  | { type: 'pong' }
  | { type: 'full' }
export type PresenceStatus = { state: 'connecting' | 'online' | 'offline' | 'full'; count: number }

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
    if (m.type === 'ping') return { type: 'ping' }
    if (m.type === 'join' && m.version === PROTOCOL_VERSION) {
      const profile = parseProfile(m.profile),
        pose = parsePose(m.pose)
      return profile && pose ? { type: 'join', version: PROTOCOL_VERSION, profile, pose } : null
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
