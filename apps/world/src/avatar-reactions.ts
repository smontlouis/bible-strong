import { ACTIVITIES, activityBadgeSvg, isAvatarActivity } from './avatar-activity'
import type Phaser from 'phaser'
import type { AvatarTrack } from './remote-avatars'
import type { AvatarActivity } from './avatar-activity'
import type { ReactionId } from './reactions'
import { REACTIONS, REACTION_DURATION_MS, reactionAsset } from './reactions'

export function loadReactions(scene: Phaser.Scene) {
  for (const activity of ACTIVITIES)
    scene.load.svg(
      `activity-${activity}`,
      `data:image/svg+xml;base64,${btoa(activityBadgeSvg(activity))}`
    )
  for (const id of REACTIONS)
    for (const layer of ['body', 'detail'] as const)
      scene.load.image(`reaction-${id}-${layer}`, reactionAsset(id, layer))
}

/** Transient, screen-sized bubbles follow interpolated positions, above scenery. */
export class AvatarReactions {
  private badges = new Map<string, { image: Phaser.GameObjects.Image; startedAt: number }>()
  private visuals = new Map<
    string,
    {
      body: Phaser.GameObjects.Image
      detail: Phaser.GameObjects.Image
      startedAt: number
      angle: number
    }
  >()
  constructor(private scene: Phaser.Scene) {}
  update(
    network: {
      playerId: string | null
      activity: AvatarActivity | null
      remotes: ReadonlyMap<string, AvatarTrack & { player: { activity?: AvatarActivity | null } }>
      reactions: ReadonlyMap<string, { reaction: ReactionId; startedAt: number }>
      expireReactions: (now: number) => void
    },
    local: { x: number; y: number; color: string },
    now: number,
    scaleX: number,
    scaleY: number,
    reducedMotion: boolean
  ) {
    network.expireReactions(now)
    // Share reaction anchoring, interpolation and screen sizing; reactions take priority.
    const activities = new Map<string, { activity: string; x: number; y: number }>()
    if (network.playerId && isAvatarActivity(network.activity))
      activities.set(network.playerId, { ...local, activity: network.activity })
    for (const [id, remote] of network.remotes)
      if (isAvatarActivity(remote.player.activity))
        activities.set(id, { ...remote.sample(now), activity: remote.player.activity })
    for (const [id, badge] of this.badges)
      if (!activities.has(id) || network.reactions.has(id)) {
        badge.image.destroy()
        this.badges.delete(id)
      }
    for (const [id, activity] of activities) {
      if (network.reactions.has(id)) continue
      let badge = this.badges.get(id)
      if (!badge) {
        badge = {
          image: this.scene.add.image(0, 0, `activity-${activity.activity}`).setDepth(4100),
          startedAt: now,
        }
        this.badges.set(id, badge)
      }
      const t = reducedMotion ? 1 : Math.min(1, (now - badge.startedAt) / 220)
      const pop = reducedMotion ? 1 : 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2
      const pulse = reducedMotion
        ? 1
        : 1 +
          (0.04 * (1 - Math.cos((Math.max(0, now - badge.startedAt - 220) * Math.PI * 2) / 2400))) /
            2
      badge.image
        .setTexture(`activity-${activity.activity}`)
        .setPosition(activity.x, activity.y - 30 - 34 * scaleY)
        .setDisplaySize(32 * scaleX * pop * pulse, 35 * scaleY * pop * pulse)
    }
    for (const [id, visual] of this.visuals) {
      if (!network.reactions.has(id)) {
        visual.body.destroy()
        visual.detail.destroy()
        this.visuals.delete(id)
      }
    }
    for (const [id, event] of network.reactions) {
      const remote = network.remotes.get(id)
      const pose = id === network.playerId ? local : remote?.sample(now)
      const color = id === network.playerId ? local.color : remote?.player.profile.color
      if (!pose || !color) continue
      let visual = this.visuals.get(id)
      if (!visual) {
        visual = {
          startedAt: event.startedAt,
          angle: Math.random() * 20 - 10,
          body: this.scene.add.image(0, 0, `reaction-${event.reaction}-body`).setDepth(4100),
          detail: this.scene.add.image(0, 0, `reaction-${event.reaction}-detail`).setDepth(4101),
        }
        this.visuals.set(id, visual)
      }
      if (visual.startedAt !== event.startedAt) {
        visual.startedAt = event.startedAt
        visual.angle = Math.random() * 20 - 10
      }
      const angle = reducedMotion ? 0 : visual.angle
      const radians = (angle * Math.PI) / 180
      const age = Math.max(0, now - event.startedAt)
      const drift = reducedMotion ? 0 : 42 * Math.min(1, age / REACTION_DURATION_MS)
      const enter = reducedMotion ? 1 : Math.min(1, age / 160)
      const alpha = reducedMotion ? 1 : Math.min(enter, (REACTION_DURATION_MS - age) / 900)
      const size = 48 * (reducedMotion ? 1 : 0.8 + 0.2 * (1 - (1 - enter) ** 3))
      for (const layer of ['body', 'detail'] as const) {
        visual[layer]
          .setTexture(`reaction-${event.reaction}-${layer}`)
          .setAngle(angle)
          .setPosition(
            pose.x + Math.sin(radians) * drift * scaleX,
            pose.y - 30 - (34 + Math.cos(radians) * drift) * scaleY
          )
          .setDisplaySize(size * scaleX, size * scaleY)
          .setAlpha(Math.max(0, alpha) * (remote?.opacity ?? 1))
      }
      visual.body.setTint(Number.parseInt(color.slice(1), 16))
    }
  }
}
