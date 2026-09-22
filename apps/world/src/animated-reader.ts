import { AssetReveal } from './asset-reveal'
import Phaser from 'phaser'
import { occlusionDepth } from './occlusion-depth'
export interface ReaderManifest {
  synchronize?: boolean
  frameRate: number
  x: number
  y: number
  width: number
  height: number
  depth: number
  pages: { key: string; firstFrame: number; frameCount: number }[]
}

const textureKey = (id: string, page: string) => `${id}-${page}`

export function loadReader(scene: Phaser.Scene, id: string, manifest: ReaderManifest) {
  for (const page of manifest.pages) {
    scene.load.atlas(
      textureKey(id, page.key),
      `./assets/characters/${id}/${page.key}.webp`,
      `./assets/characters/${id}/${page.key}.json`
    )
  }
}

export class AnimatedReader {
  private readonly sprite: Phaser.GameObjects.Sprite
  private readonly reveal = new AssetReveal()
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  constructor(
    scene: Phaser.Scene,
    private readonly id: string,
    private readonly manifest: ReaderManifest
  ) {
    const animationKey = `${id}-reading`
    const frames = manifest.pages.flatMap(page =>
      Array.from({ length: page.frameCount }, (_, index) => ({
        key: textureKey(id, page.key),
        frame: `reader-${String(page.firstFrame + index).padStart(3, '0')}`,
      }))
    )
    if (!scene.anims.exists(animationKey))
      scene.anims.create({ key: animationKey, frames, frameRate: manifest.frameRate, repeat: -1 })
    this.sprite = scene.add
      .sprite(manifest.x, manifest.y, frames[0].key, frames[0].frame)
      .setAlpha(0)
      .setOrigin(0)
      .setDisplaySize(manifest.width, manifest.height)
      // Same ground anchor as the desk, just above its cutout so fingers cover paper.
      .setDepth(manifest.depth)
      .play(animationKey)
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, paused: boolean, avatarX: number, delta = 0) {
    const manifest = this.manifest
    this.sprite.setDepth(occlusionDepth(this.id, manifest.depth, avatarX))
    const width = camera.width / camera.zoom
    const height = camera.height / camera.zoom
    const left = camera.scrollX + camera.width / 2 - width / 2
    const top = camera.scrollY + camera.height / 2 - height / 2
    const visible =
      manifest.x + manifest.width > left &&
      manifest.x < left + width &&
      manifest.y + manifest.height > top &&
      manifest.y < top + height
    this.sprite.setAlpha(this.reveal.update(delta, visible && !paused, this.reducedMotion.matches))
    this.sprite.setVisible(visible)
    if (this.reducedMotion.matches) {
      this.sprite.anims.pause(this.sprite.anims.currentAnim!.frames[0])
    } else if (paused || (!visible && !manifest.synchronize)) {
      this.sprite.anims.pause()
    } else {
      this.sprite.anims.resume()
    }
  }
}
