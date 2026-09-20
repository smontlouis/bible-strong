import type Phaser from 'phaser'
import type { Point } from './world'

const ROOT = './assets/avatars/blob'
const FRAME_COUNT = 24
const FRAME_RATE = 24
const CYCLE_MS = (FRAME_COUNT / FRAME_RATE) * 1000
// Side frames need more transparent padding to contain their exaggerated poses.
// Match visible body/eye size, rather than rendering both padded sheets at 52px.
const DISPLAY_SIZE = { down: 52, up: 52, right: 65 } as const
type Facing = 'down' | 'up' | 'right' | 'left'

export function loadBlobAvatar(scene: Phaser.Scene) {
  for (const direction of ['down', 'up', 'right']) {
    scene.load.spritesheet(`blob-${direction}`, `${ROOT}/${direction}.png`, {
      frameWidth: 256,
      frameHeight: 256,
    })
    scene.load.image(`blob-idle-${direction}`, `${ROOT}/idle-${direction}.png`)
  }
}

/** The frame includes the hop: its origin stays anchored to the ground. */
export class BlobAvatar {
  private facing: Facing = 'down'
  private elapsed = 0

  reset() {
    this.facing = 'down'
    this.elapsed = 0
  }

  update(
    sprite: Phaser.GameObjects.Image,
    direction: Point,
    moving: boolean,
    reducedMotion: boolean,
    delta: number
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
      if (facing !== this.facing) this.elapsed = 0
      this.facing = facing
    }
    const animated = moving && !reducedMotion
    this.elapsed = animated ? (this.elapsed + Math.min(delta, 50)) % CYCLE_MS : 0
    const sheet = this.facing === 'left' ? 'right' : this.facing
    const texture = `blob-${animated ? '' : 'idle-'}${sheet}`
    const frame = animated ? Math.floor((this.elapsed * FRAME_RATE) / 1000) % FRAME_COUNT : '__BASE'
    if (sprite.texture.key !== texture) sprite.setTexture(texture, frame)
    else if (String(sprite.frame.name) !== String(frame)) sprite.setFrame(frame)
    sprite
      .setFlipX(this.facing === 'left')
      .setOrigin(0.5, sheet === 'right' ? 218 / 224 : 550 / 576)
      .setDisplaySize(DISPLAY_SIZE[sheet], DISPLAY_SIZE[sheet])
  }
}
