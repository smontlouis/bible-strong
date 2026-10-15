import { avatarTint, type AvatarTone } from './avatar-tone'
import type Phaser from 'phaser'
import type { BushContact } from './bush-rustle'
import { BlobAvatar } from './blob-avatar'
import type { AvatarProfile } from './avatar-profile'
import type { Pose } from './multiplayer-protocol'

export type AvatarTrack = {
  player: { profile: AvatarProfile }
  sample: (now: number) => Pose
  opacity?: number
}

type Visual = {
  sprite: Phaser.GameObjects.Image
  shadow: Phaser.GameObjects.Ellipse
  label: Phaser.GameObjects.Text
  animation: BlobAvatar
}

export class RemoteAvatars {
  readonly contacts: BushContact[] = []
  private avatars = new Map<string, Visual>()
  constructor(
    private scene: Phaser.Scene,
    private resolution: number,
    /** Valence draws visitors smaller, labels them in sepia and ages their colours. */
    private look: { scale: number; shadow: number; text: string; background: string; tone?: AvatarTone } = {
      scale: 1,
      shadow: 0x183c45,
      text: '#193d49',
      background: '#fff9ea',
    }
  ) {}
  update(
    network: { remotes: ReadonlyMap<string, AvatarTrack> },
    now: number,
    delta: number,
    reducedMotion: boolean,
    labelScaleX: number,
    labelScaleY: number,
    labelAlpha: number,
    allowLoading = true
  ) {
    this.contacts.length = 0
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
          shadow: this.scene.add
            .ellipse(0, 0, 30 * this.look.scale, 10 * this.look.scale, this.look.shadow, 0.25)
            .setDepth(-1),
          label: this.scene.add
            .text(0, 0, '', {
              fontFamily: 'Pulp, sans-serif',
              fontSize: '12px',
              color: this.look.text,
              backgroundColor: this.look.background,
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
      const distance = Math.hypot(pose.x - visual.sprite.x, pose.y - visual.sprite.y)
      this.contacts.push({
        x: pose.x,
        y: pose.y,
        moving: pose.moving && distance > 0.01 && distance < 100,
      })
      visual.sprite.setPosition(pose.x, pose.y)
      const { profile } = track.player
      // Prime orientation even for a visitor who was already stationary when we joined.
      if (!pose.moving)
        visual.animation.update(
          visual.sprite,
          { x: pose.dx, y: pose.dy },
          true,
          true,
          0,
          profile.avatar,
          allowLoading
        )
      visual.animation.update(
        visual.sprite,
        { x: pose.dx, y: pose.dy },
        pose.moving,
        reducedMotion,
        delta,
        profile.avatar,
        allowLoading
      )
      if (this.look.scale !== 1)
        visual.sprite.setDisplaySize(
          visual.sprite.displayWidth * this.look.scale,
          visual.sprite.displayHeight * this.look.scale
        )
      visual.sprite
        .setPosition(pose.x, pose.y)
        .setDepth(pose.y)
        .setTint(avatarTint(profile.color, this.look.tone))
        .setAlpha(track.opacity ?? 1)
      visual.shadow.setPosition(pose.x, pose.y).setAlpha(track.opacity ?? 1)
      if (visual.label.text !== profile.name) visual.label.setText(profile.name)
      visual.label
        .setPosition(pose.x, pose.y + 5 * labelScaleY)
        .setScale(labelScaleX, labelScaleY)
        .setAlpha(labelAlpha * (track.opacity ?? 1))
        .setVisible(labelAlpha > 0.01)
    }
  }
}
