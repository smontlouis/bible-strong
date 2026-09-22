import { AssetReveal } from './asset-reveal'
import type Phaser from 'phaser'
import fish from './generated/fish-tile.json'
import duck from './generated/duck-tile.json'
import fishWest from './generated/fish-west-tile.json'
import cat from './generated/cat-tile.json'
import livingWorld from './generated/living-world.json'

export const ambientTileManifests = [fish, duck, fishWest, cat, ...livingWorld]

export function loadAmbientTiles(scene: Phaser.Scene, tiles = ambientTileManifests) {
  for (const tile of tiles)
    scene.load.atlas(
      tile.id,
      `./assets/ambience/${tile.id}/atlas.webp`,
      `./assets/ambience/${tile.id}/atlas.json`
    )
}

/** Source-aligned ambient sprites and water patches; original tile borders remain untouched. */
export class AmbientTiles {
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private readonly patches: {
    tile: typeof fish
    sprite: Phaser.GameObjects.Sprite
    reveal: AssetReveal
  }[]

  constructor(scene: Phaser.Scene, tiles = ambientTileManifests) {
    this.patches = tiles.map(tile => {
      const key = `${tile.id}-loop`
      if (!scene.anims.exists(key))
        scene.anims.create({
          key,
          frames: Array.from({ length: tile.frameCount }, (_, i) => ({
            key: tile.id,
            frame: `ambient-${i}`,
          })),
          frameRate: tile.frameRate,
          repeat: -1,
          repeatDelay: 0,
        })
      const sprite = scene.add
        .sprite(tile.x, tile.y, tile.id, 'ambient-0')
        .setOrigin(0)
        .setDisplaySize(tile.width, tile.height)
        .setDepth(tile.depth)
        .play(key)
      sprite.anims.pause()
      sprite.setVisible(false).setAlpha(0)
      return { tile, sprite, reveal: new AssetReveal() }
    })
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, paused: boolean, delta = 0) {
    const width = camera.width / camera.zoom,
      height = camera.height / camera.zoom
    const left = camera.scrollX + camera.width / 2 - width / 2
    const top = camera.scrollY + camera.height / 2 - height / 2
    for (const { tile, sprite, reveal } of this.patches) {
      const visible =
        tile.x < left + width &&
        tile.x + tile.width > left &&
        tile.y < top + height &&
        tile.y + tile.height > top
      sprite.setVisible(visible && !this.reducedMotion.matches)
      sprite.setAlpha(reveal.update(delta, visible && !paused, this.reducedMotion.matches))
      if (!visible || paused || this.reducedMotion.matches) sprite.anims.pause()
      else sprite.anims.resume()
    }
  }
}
