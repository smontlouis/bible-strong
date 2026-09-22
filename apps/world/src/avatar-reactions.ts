import type Phaser from 'phaser'
import type { WorldMultiplayer } from './multiplayer'
import { REACTIONS, REACTION_DURATION_MS, reactionAsset } from './reactions'

export function loadReactions(scene: Phaser.Scene) {
  for (const id of REACTIONS)
    for (const layer of ['body', 'detail'] as const)
      scene.load.image(`reaction-${id}-${layer}`, reactionAsset(id, layer))
}

/** Transient, screen-sized bubbles follow interpolated positions, above scenery. */
export class AvatarReactions {
  private visuals = new Map<
    string,
    { body: Phaser.GameObjects.Image; detail: Phaser.GameObjects.Image }
  >()
  constructor(private scene: Phaser.Scene) {}
  update(
    network: WorldMultiplayer,
    local: { x: number; y: number; color: string },
    now: number,
    scaleX: number,
    scaleY: number,
    reducedMotion: boolean
  ) {
    network.expireReactions(now)
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
          body: this.scene.add.image(0, 0, `reaction-${event.reaction}-body`).setDepth(4100),
          detail: this.scene.add.image(0, 0, `reaction-${event.reaction}-detail`).setDepth(4101),
        }
        this.visuals.set(id, visual)
      }
      const age = now - event.startedAt
      const enter = reducedMotion ? 1 : Math.min(1, age / 160)
      const alpha = reducedMotion ? 1 : Math.min(enter, (REACTION_DURATION_MS - age) / 250)
      const size = 48 * (reducedMotion ? 1 : 0.8 + 0.2 * (1 - (1 - enter) ** 3))
      for (const layer of ['body', 'detail'] as const) {
        visual[layer]
          .setTexture(`reaction-${event.reaction}-${layer}`)
          .setPosition(pose.x, pose.y - 30 - 34 * scaleY)
          .setDisplaySize(size * scaleX, size * scaleY)
          .setAlpha(Math.max(0, alpha))
      }
      visual.body.setTint(Number.parseInt(color.slice(1), 16))
    }
  }
}
