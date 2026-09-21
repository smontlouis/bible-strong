import type { AvatarId } from './avatar-profile'
import type Phaser from 'phaser'
import type { Point } from './world'

const ROOT = './assets/avatars'
const FRAME_RATE = 24
const STOP_GRACE_MS = 120
// Side frames need more transparent padding to contain their exaggerated poses.
// Match visible body/eye size, rather than rendering both padded sheets at 52px.
const DISPLAY_SIZE = { down: 52, up: 52, right: 65 } as const
type Facing = 'down' | 'up' | 'right' | 'left'

export function loadBlobAvatar(scene: Phaser.Scene) {
  for (const shape of ['blob', 'short-slime', 'rounded-square']) {
    for (const direction of ['down', 'up', 'right']) {
      scene.load.spritesheet(`${shape}-${direction}`, `${ROOT}/${shape}/${direction}.png`, {
        frameWidth: 256,
        frameHeight: 256,
      })
      scene.load.image(`${shape}-idle-${direction}`, `${ROOT}/${shape}/idle-${direction}.png`)
    }
  }
}

/** The frame includes the hop: its origin stays anchored to the ground. */
export class BlobAvatar {
  private facing: Facing = 'down'
  private elapsed = 0
  private stoppedFor = STOP_GRACE_MS

  reset() {
    this.facing = 'down'
    this.elapsed = 0
    this.stoppedFor = STOP_GRACE_MS
  }

  update(
    sprite: Phaser.GameObjects.Image,
    direction: Point,
    moving: boolean,
    reducedMotion: boolean,
    delta: number,
    avatar: AvatarId
  ) {
    if (moving) {
      const facing =
        Math.abs(direction.x) >= Math.abs(direction.y) && direction.x !== 0
          ? direction.x < 0
            ? 'left'
            : 'right'
          : direction.y < 0
            ? 'up'
            : 'down'
      this.facing = facing
    }
    // Opposite keys can briefly cancel each other during a turn.
    this.stoppedFor = moving ? 0 : this.stoppedFor + delta
    const animated = !reducedMotion && (moving || this.stoppedFor < STOP_GRACE_MS)
    const frameCount = avatar === 'nova' ? 24 : 15
    const cycleMs = (frameCount / FRAME_RATE) * 1000
    this.elapsed = animated
      ? (this.elapsed + (moving ? Math.min(delta, 50) : 0)) % cycleMs
      : 0
    const sheet = this.facing === 'left' ? 'right' : this.facing
    const shape = avatar === 'nova' ? 'blob' : avatar
    const texture = `${shape}-${animated ? '' : 'idle-'}${sheet}`
    const frame = animated ? Math.floor((this.elapsed * FRAME_RATE) / 1000) % frameCount : '__BASE'
    if (sprite.texture.key !== texture) sprite.setTexture(texture, frame)
    else if (String(sprite.frame.name) !== String(frame)) sprite.setFrame(frame)
    sprite
      .setFlipX(this.facing === 'left')
      .setOrigin(
        0.5,
        avatar !== 'nova'
          ? 233 / 256
          : sheet === 'right'
            ? 218 / 224
            : 550 / 576
      )
      .setDisplaySize(
        avatar !== 'nova' ? 52 : DISPLAY_SIZE[sheet],
        avatar !== 'nova' ? 52 : DISPLAY_SIZE[sheet]
      )
  }
}
