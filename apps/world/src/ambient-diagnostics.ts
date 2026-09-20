import type Phaser from 'phaser'
import type { DiagnosticFilters } from './diagnostic-filters'
import type { AmbientRegion } from './world-ambience'
import { ambientTileManifests } from './ambient-tiles'

type Kind = AmbientRegion['kind'] | 'fish' | 'duck' | 'cat'
const names: Record<string, Record<Kind, string>> = {
  fr: {
    light: 'Lueur',
    particles: 'Particules',
    butterfly: 'Papillon',
    dragonfly: 'Libellule',
    fish: 'Poissons',
    duck: 'Canard',
    cat: 'Chat',
  },
  en: {
    light: 'Glow',
    particles: 'Particles',
    butterfly: 'Butterfly',
    dragonfly: 'Dragonfly',
    fish: 'Fish',
    duck: 'Duck',
    cat: 'Cat',
  },
  zh: {
    light: '灯光',
    particles: '粒子',
    butterfly: '蝴蝶',
    dragonfly: '蜻蜓',
    fish: '鱼群',
    duck: '鸭子',
    cat: '猫',
  },
}
const colors: Record<Kind, number> = {
  light: 0xffdc70,
  particles: 0xff8eea,
  butterfly: 0xc6ff74,
  dragonfly: 0x75ffe0,
  fish: 0x5bdcff,
  duck: 0xffbd70,
  cat: 0xffefac,
}

/** Diagnostic bounds are derived from the same regions that drive the effects. */
export class AmbientDiagnostics {
  private readonly graphics: Phaser.GameObjects.Graphics
  private readonly labels: (Phaser.GameObjects.Text | undefined)[] = []
  private readonly tiles: (Omit<AmbientRegion, 'kind'> & { kind: Kind })[]

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly getRegions: () => AmbientRegion[]
  ) {
    this.graphics = scene.add.graphics().setDepth(3100).setVisible(false)
    this.tiles = [
      ...ambientTileManifests.map(tile => ({
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
        kind: (tile.id.startsWith('fish')
          ? 'fish'
          : tile.id.startsWith('cat')
            ? 'cat'
            : 'duck') as Kind,
      })),
    ]
  }

  update(
    camera: Phaser.Cameras.Scene2D.Camera,
    enabled: boolean,
    language: string,
    filters?: DiagnosticFilters
  ) {
    this.graphics.setVisible(enabled)
    if (!enabled) {
      for (const label of this.labels) label?.setVisible(false)
      return
    }
    const translations = names[language] ?? names.fr
    const width = camera.width / camera.zoom,
      height = camera.height / camera.zoom
    const left = camera.scrollX + camera.width / 2 - width / 2
    const top = camera.scrollY + camera.height / 2 - height / 2
    this.graphics.clear()
    const counts: Partial<Record<Kind, number>> = {}
    const regions = [...this.getRegions(), ...this.tiles]
    for (const label of this.labels) label?.setVisible(false)
    for (const [index, region] of regions.entries()) {
      const count = (counts[region.kind] = (counts[region.kind] ?? 0) + 1)
      const visible =
        filters?.[region.kind] !== false &&
        region.x < left + width &&
        region.x + region.width > left &&
        region.y < top + height &&
        region.y + region.height > top
      let label = this.labels[index]
      if (!visible) {
        label?.setVisible(false)
        continue
      }
      if (!label)
        label = this.labels[index] = this.scene.add
          .text(region.x, region.y, '', {
            fontFamily: 'sans-serif',
            fontSize: '11px',
            color: '#ffffff',
            backgroundColor: '#142b39',
            padding: { x: 3, y: 2 },
          })
          .setDepth(3101)
      label
        .setPosition(region.x, region.y)
        .setVisible(true)
        .setText(`${translations[region.kind]} ${count}`)
        .setScale(1 / camera.zoom)
      this.graphics
        .fillStyle(colors[region.kind], 0.08)
        .fillRect(region.x, region.y, region.width, region.height)
        .lineStyle(1.5 / camera.zoom, colors[region.kind], 0.95)
        .strokeRect(region.x, region.y, region.width, region.height)
    }
  }
}
