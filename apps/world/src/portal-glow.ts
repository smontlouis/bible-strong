import Phaser from 'phaser'

type Area = { x: number; y: number; width: number; height: number }
type Spark = { image: Phaser.GameObjects.Arc; age: number; offset: number; life: number }

/** A slow, breathing light in a portal's opening, with a few sparks rising through it. */
export class PortalGlow {
  private readonly light: Phaser.GameObjects.Graphics
  private readonly sparks: Spark[] = []

  constructor(
    scene: Phaser.Scene,
    private readonly area: Area,
    depth: number,
    private readonly color = 0xffd98a
  ) {
    this.light = scene.add.graphics().setDepth(depth).setBlendMode(Phaser.BlendModes.ADD)
    for (let i = 0; i < 8; i++) {
      const image = scene.add
        .circle(0, 0, 0.8, color, 1)
        .setDepth(depth + 0.01)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false)
      this.sparks.push({ image, age: i / 8, offset: 0, life: 1 })
    }
  }

  update(time: number, delta: number, reducedMotion: boolean) {
    const { x, y, width, height } = this.area
    const breath = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(time / 700)
    const g = this.light.clear()
    for (let ring = 6; ring >= 1; ring--) {
      const k = ring / 6
      g.fillStyle(this.color, 0.03 + (0.06 + 0.05 * breath) * (1 - k))
      g.fillEllipse(x, y, width * (0.5 + 0.55 * k), height * (0.5 + 0.55 * k))
    }
    for (const spark of this.sparks) {
      if (reducedMotion) {
        spark.image.setVisible(false)
        continue
      }
      spark.age += delta / 1000 / spark.life
      if (spark.age >= 1) {
        spark.age = 0
        spark.life = 1.6 + Math.random() * 1.4
        spark.offset = (Math.random() - 0.5) * width * 0.7
      }
      const t = spark.age
      spark.image
        .setVisible(true)
        .setPosition(x + spark.offset + Math.sin(t * 6 + spark.offset) * 2, y + height * 0.45 - t * height * 0.95)
        .setAlpha(Math.sin(t * Math.PI) * 0.9)
    }
  }

  destroy() {
    this.light.destroy()
    for (const spark of this.sparks) spark.image.destroy()
  }
}
