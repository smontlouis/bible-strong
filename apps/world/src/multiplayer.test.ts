import { describe, expect, it } from 'vitest'
import { parseClientMessage, parsePose, type Player } from './multiplayer-protocol'
import { RemoteTrack } from './multiplayer-interpolation'
const player: Player = {
  id: 'visitor',
  profile: { name: 'Nova', avatar: 'nova', color: '#73cdd0' },
  pose: { x: 836, y: 542, dx: 1, dy: 0, moving: true },
  seq: 1,
}

describe('multiplayer protocol', () => {
  it('rejects malformed, oversized, incompatible and nonfinite input', () => {
    for (const raw of [
      'null',
      '{',
      'x'.repeat(1025),
      JSON.stringify({ type: 'join', version: 99, ...player }),
      JSON.stringify({ type: 'move', seq: -1, pose: player.pose }),
    ])
      expect(parseClientMessage(raw)).toBeNull()
    for (const pose of [
      { ...player.pose, x: Infinity },
      { ...player.pose, y: -1 },
      { ...player.pose, dx: 2 },
      { ...player.pose, moving: 'yes' },
    ])
      expect(parsePose(pose)).toBeNull()
  })
  it('sanitizes profiles and never accepts a client-supplied identity', () => {
    const parsed = parseClientMessage(
      JSON.stringify({
        type: 'join',
        version: 2,
        id: 'impersonation',
        profile: { ...player.profile, name: '  Nova\u0000  ' },
        pose: player.pose,
      })
    )
    expect(parsed).toEqual({ type: 'join', version: 2, profile: player.profile, pose: player.pose })
  })
})
describe('remote interpolation', () => {
  it('interpolates between snapshots, including the final stop', () => {
    const track = new RemoteTrack(player, 1000)
    track.push({ ...player, seq: 2, pose: { ...player.pose, x: 846, moving: false } }, 1100)
    expect(track.sample(1150).x).toBe(841)
    expect(track.sample(1150).moving).toBe(true)
    expect(track.sample(1200)).toMatchObject({ x: 846, moving: false })
  })
  it('holds on network stalls instead of drifting through scenery', () => {
    const track = new RemoteTrack(player, 1000)
    expect(track.sample(2000)).toMatchObject({ x: 836, moving: false })
  })
  it('ignores stale snapshots and snaps home teleports', () => {
    const track = new RemoteTrack(player, 1000)
    track.push({ ...player, seq: 0, pose: { ...player.pose, x: 5 } }, 1050)
    expect(track.sample(1100).x).toBe(836)
    track.push({ ...player, seq: 2, pose: { ...player.pose, x: 1000 } }, 1200)
    expect(track.sample(1200).x).toBe(1000)
  })
  it('bounds history for long-running sessions', () => {
    const track = new RemoteTrack(player, 1000)
    for (let i = 2; i < 1000; i++) track.push({ ...player, seq: i }, 1000 + i)
    expect(track.samples.length).toBeLessThanOrEqual(12)
  })
})
