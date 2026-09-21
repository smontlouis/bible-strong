import type Phaser from 'phaser'
import book from './generated/central-book.json'

const textureKey = (page: string) => `central-book-${page}`

export function loadCentralBook(scene: Phaser.Scene) {
  for (const page of book.pages)
    scene.load.atlas(
      textureKey(page.key),
      `./assets/ambience/central-book/${page.key}.webp`,
      `./assets/ambience/central-book/${page.key}.json`
    )
}

/** A local clock keeps both page turns and random rests frozen when inactive. */
export class CentralBook {
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private readonly sprite: Phaser.GameObjects.Image
  private readonly frames = book.pages.flatMap(page =>
    Array.from({ length: page.frameCount }, (_, index) => ({
      key: textureKey(page.key),
      frame: `book-${page.firstFrame + index}`,
    }))
  )
  private elapsed = 0
  private rest = 0
  private frame = 0

  constructor(scene: Phaser.Scene) {
    this.sprite = scene.add.image(book.x, book.y, this.frames[0].key, this.frames[0].frame)
      .setOrigin(0).setDisplaySize(book.width, book.height).setDepth(book.depth)
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, delta: number, paused: boolean) {
    const width = camera.width / camera.zoom, height = camera.height / camera.zoom
    const left = camera.scrollX + camera.width / 2 - width / 2
    const top = camera.scrollY + camera.height / 2 - height / 2
    const visible = book.x < left + width && book.x + book.width > left &&
      book.y < top + height && book.y + book.height > top
    this.sprite.setVisible(visible && !this.reducedMotion.matches)
    if (!visible || paused || this.reducedMotion.matches) return

    // Ignore long gaps after a suspended tab; no wall-clock timers outlive the scene.
    let step = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 100)) : 0
    if (this.rest > 0) {
      const consumed = Math.min(this.rest, step)
      this.rest -= consumed
      step -= consumed
      if (this.rest > 0) return
    }
    this.elapsed += step
    const duration = book.frameCount / book.frameRate * 1000
    let nextFrame: number
    if (this.elapsed >= duration) {
      this.elapsed = 0
      this.rest = 2000 + Math.random() * 3000
      nextFrame = book.frameCount - 1
    } else {
      nextFrame = Math.floor(this.elapsed * book.frameRate / 1000)
    }
    if (nextFrame !== this.frame) {
      this.frame = nextFrame
      // Reuse the first texture for the final hold: no compression difference at restart.
      const frame = this.frames[nextFrame === book.frameCount - 1 ? 0 : nextFrame]
      this.sprite.setTexture(frame.key, frame.frame)
    }
  }
}
