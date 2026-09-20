import type { Player, Pose } from './multiplayer-protocol'

type Sample = { time: number; pose: Pose }
const DELAY = 100
/** Network snapshots stay outside React; the scene samples them at its own frame rate. */
export class RemoteTrack {
  samples: Sample[] = []
  constructor(
    public player: Player,
    time: number
  ) {
    this.push(player, time)
  }
  push(player: Player, time: number) {
    if (this.samples.length && player.seq < this.player.seq) return
    const last = this.samples.at(-1)
    this.player = player
    // Home/reset and reconnections must not animate a journey through water.
    if (last && Math.hypot(last.pose.x - player.pose.x, last.pose.y - player.pose.y) > 100)
      this.samples = []
    this.samples.push({ time, pose: player.pose })
    if (this.samples.length > 12) this.samples.shift()
  }
  sample(now: number): Pose {
    const target = now - DELAY
    while (this.samples.length > 2 && this.samples[1].time <= target) this.samples.shift()
    const a = this.samples[0],
      b = this.samples[1]
    if (b && target < b.time) {
      const t = Math.max(0, Math.min(1, (target - a.time) / Math.max(1, b.time - a.time)))
      const moving = Math.hypot(b.pose.x - a.pose.x, b.pose.y - a.pose.y) > 0.01
      return {
        ...b.pose,
        x: a.pose.x + (b.pose.x - a.pose.x) * t,
        y: a.pose.y + (b.pose.y - a.pose.y) * t,
        moving,
      }
    }
    const last = this.samples.at(-1)!
    // Hold the last known position on packet loss; never drift through obstacles.
    return { ...last.pose, moving: last.pose.moving && now - last.time < 250 }
  }
}
