import Phaser from 'phaser'
import { WIDTH, HEIGHT } from './world'
import { visibleWaterDecorations, WATER_CELL_SIZE } from './water-decorations'

// Decoration extends beyond the navigation document's original coordinate system.
export const SCENERY_MARGIN = 200
export const SCENERY_WIDTH = WIDTH + SCENERY_MARGIN * 2
export const SCENERY_HEIGHT = HEIGHT + SCENERY_MARGIN * 2

export class WorldBackground {
  private readonly water: Phaser.GameObjects.TileSprite
  private readonly decorations = new Map<string, Phaser.GameObjects.Image>()
  private visibleCells = ''

  constructor(private readonly scene: Phaser.Scene) {
    this.water = scene.add.tileSprite(0, 0, 1, 1, 'world-water').setOrigin(0).setDepth(-130)
    scene.add
      .image(-SCENERY_MARGIN, -SCENERY_MARGIN, 'world-shore')
      .setOrigin(0)
      .setDisplaySize(SCENERY_WIDTH, SCENERY_HEIGHT)
      .setDepth(-80)
  }

  update(camera: Phaser.Cameras.Scene2D.Camera) {
    // Calculate from current scroll/zoom: worldView is refreshed only during preRender.
    const width = Math.ceil(camera.width / camera.zoom) + 4
    const height = Math.ceil(camera.height / camera.zoom) + 4
    const left = Math.floor(camera.scrollX + camera.width / 2 - width / 2)
    const top = Math.floor(camera.scrollY + camera.height / 2 - height / 2)
    this.water.setPosition(left, top).setSize(width, height)
    // Anchor the repeat to world coordinates, including negative coordinates.
    this.water.setTilePosition(left, top)
    const cells = [left, top, left + width, top + height]
      .map(value => Math.floor(value / WATER_CELL_SIZE))
      .join(':')
    if (cells === this.visibleCells) return
    this.visibleCells = cells
    const needed = new Set<string>()
    for (const decoration of visibleWaterDecorations({ x: left, y: top, width, height })) {
      needed.add(decoration.key)
      if (this.decorations.has(decoration.key)) continue
      this.decorations.set(
        decoration.key,
        this.scene.add
          .image(decoration.x, decoration.y, `water-${decoration.variant}`)
          .setDisplaySize(decoration.size, decoration.size)
          .setDepth(-125)
      )
    }
    for (const [key, image] of this.decorations) {
      if (needed.has(key)) continue
      image.destroy()
      this.decorations.delete(key)
    }
  }
}
