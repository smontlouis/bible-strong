import type Phaser from 'phaser'
import { BlobAvatar } from './blob-avatar'
import type { WorldMultiplayer } from './multiplayer'

type Visual = {
  sprite: Phaser.GameObjects.Image
  shadow: Phaser.GameObjects.Ellipse
  label: Phaser.GameObjects.Text
  animation: BlobAvatar
}

export class RemoteAvatars {
  private avatars = new Map<string, Visual>()
  constructor(
    private scene: Phaser.Scene,
    private resolution: number
  ) {}
  update(
    network: WorldMultiplayer,
    now: number,
    delta: number,
    reducedMotion: boolean,
    labelScaleX: number,
    labelScaleY: number,
    labelAlpha: number
  ) {
    for (const [id, visual] of this.avatars) {
      if (!network.remotes.has(id)) {
        visual.sprite.destroy()
        visual.shadow.destroy()
        visual.label.destroy()
        this.avatars.delete(id)
      }
    }
    for (const [id, track] of network.remotes) {
      let visual = this.avatars.get(id)
      if (!visual) {
        visual = {
          sprite: this.scene.add.image(0, 0, 'blob-idle-down'),
          shadow: this.scene.add.ellipse(0, 0, 30, 10, 0x183c45, 0.25).setDepth(-1),
          label: this.scene.add
            .text(0, 0, '', {
              fontFamily: 'Pulp, sans-serif',
              fontSize: '12px',
              color: '#193d49',
              backgroundColor: '#fff9ea',
              padding: { x: 5, y: 3 },
            })
            .setOrigin(0.5, 0)
            .setResolution(this.resolution)
            .setDepth(4000),
          animation: new BlobAvatar(),
        }
        this.avatars.set(id, visual)
      }
      const pose = track.sample(now)
      const { profile } = track.player
      // Prime orientation even for a visitor who was already stationary when we joined.
      if (!pose.moving)
        visual.animation.update(
          visual.sprite,
          { x: pose.dx, y: pose.dy },
          true,
          true,
          0,
          profile.avatar
        )
      visual.animation.update(
        visual.sprite,
        { x: pose.dx, y: pose.dy },
        pose.moving,
        reducedMotion,
        delta,
        profile.avatar
      )
      visual.sprite
        .setPosition(pose.x, pose.y)
        .setDepth(pose.y)
        .setTint(Number.parseInt(profile.color.slice(1), 16))
      visual.shadow.setPosition(pose.x, pose.y)
      if (visual.label.text !== profile.name) visual.label.setText(profile.name)
      visual.label
        .setPosition(pose.x, pose.y + 5 * labelScaleY)
        .setScale(labelScaleX, labelScaleY)
        .setAlpha(labelAlpha)
        .setVisible(labelAlpha > 0.01)
    }
  }
}
