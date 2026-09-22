import type { AvatarId } from './avatar-profile'
import type Phaser from 'phaser'
import type { Point } from './world'
import { isInView } from './lazy-scene-assets'

const ROOT = './assets/avatars'
const FRAME_RATE = 24
const STOP_GRACE_MS = 120
// Side frames need more transparent padding to contain their exaggerated poses.
// Match visible body/eye size, rather than rendering both padded sheets at 52px.
const DISPLAY_SIZE = { down: 52, up: 52, right: 65 } as const
type Facing = 'down' | 'up' | 'right' | 'left'

export function loadBlobAvatar(scene: Phaser.Scene) {
  for (const shape of ['blob', 'short-slime', 'rounded-square', 'cloud', 'triangle']) {
    for (const direction of ['down', 'up', 'right']) {
      scene.load.image(`${shape}-idle-${direction}`, `${ROOT}/${shape}/idle-${direction}.png`)
    }
  }
}

const requestedSheets = new WeakMap<Phaser.Scene, Set<string>>()

/** Failed optional sheets stay on their idle pose rather than retrying every frame. */
function requestSheet(scene: Phaser.Scene, shape: string, direction: string) {
  let requested = requestedSheets.get(scene)
  if (!requested) {
    requested = new Set()
    requestedSheets.set(scene, requested)
  }
  const key = `${shape}-${direction}`
  if (requested.has(key) || scene.textures.exists(key)) return
  requested.add(key)
  scene.load.spritesheet(key, `${ROOT}/${shape}/${direction}.png`, {
    frameWidth: 256,
    frameHeight: 256,
  })
  if (!scene.load.isLoading() && scene.load.isReady()) scene.load.start()
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
    avatar: AvatarId,
    allowLoading = true
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
    const floating = avatar === 'cloud'
    const frameRate = floating ? 12 : FRAME_RATE
    const animated = !reducedMotion && (floating || moving || this.stoppedFor < STOP_GRACE_MS)
    const frameCount = avatar === 'nova' ? 24 : 15
    const cycleMs = (frameCount / frameRate) * 1000
    this.elapsed = animated
      ? (this.elapsed + (moving || floating ? Math.min(delta, 50) : 0)) % cycleMs
      : 0
    const sheet = this.facing === 'left' ? 'right' : this.facing
    const shape = avatar === 'nova' ? 'blob' : avatar
    if (
      animated &&
      allowLoading &&
      isInView(
        { x: sprite.x - 33, y: sprite.y - 65, width: 66, height: 70 },
        sprite.scene.cameras.main
      )
    )
      requestSheet(sprite.scene, shape, sheet)
    const sheetReady = animated && sprite.scene.textures.exists(`${shape}-${sheet}`)
    const texture = `${shape}-${sheetReady ? '' : 'idle-'}${sheet}`
    const frame = sheetReady ? Math.floor((this.elapsed * frameRate) / 1000) % frameCount : '__BASE'
    if (sprite.texture.key !== texture) sprite.setTexture(texture, frame)
    else if (String(sprite.frame.name) !== String(frame)) sprite.setFrame(frame)
    sprite
      .setFlipX(this.facing === 'left')
      .setOrigin(0.5, avatar !== 'nova' ? 233 / 256 : sheet === 'right' ? 218 / 224 : 550 / 576)
      .setDisplaySize(
        avatar !== 'nova' ? 52 : DISPLAY_SIZE[sheet],
        avatar !== 'nova' ? 52 : DISPLAY_SIZE[sheet]
      )
  }
}
