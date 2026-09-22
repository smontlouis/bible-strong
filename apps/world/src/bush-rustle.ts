import type Phaser from 'phaser'
import { isReactiveBush, prepareBushCutout } from './bush-cutouts'

export type BushShape = { x: number; y: number; width: number; height: number }
export type BushContact = { x: number; y: number; moving: boolean }
export type BushMask = { width: number; height: number; alpha: Uint8ClampedArray }

// Feet plus a small contact margin, in source-map coordinates (independent of zoom).
export function touchesBush(shape: BushShape, mask: BushMask, avatar: BushContact): boolean {
  if (!avatar.moving) return false
  const x = avatar.x - shape.x
  const y = avatar.y - 4 - shape.y
  const radius = 12
  if (x < -radius || y < -radius || x > shape.width + radius || y > shape.height + radius)
    return false
  for (let py = Math.max(0, Math.floor(y - radius)); py < Math.min(mask.height, y + radius); py++) {
    for (
      let px = Math.max(0, Math.floor(x - radius));
      px < Math.min(mask.width, x + radius);
      px++
    ) {
      if (
        (px - x) ** 2 + (py - y) ** 2 <= radius ** 2 &&
        mask.alpha[(py * mask.width + px) * 4 + 3] > 96
      )
        return true
    }
  }
  return false
}

type Foreground = {
  object: BushShape & { id: string; baseY: number }
  image: Phaser.GameObjects.Image
}
type Bush = Foreground & {
  mask: BushMask
  rope?: Phaser.GameObjects.Rope
  phase: number
  cooldown: number
}
type Leaf = { image: Phaser.GameObjects.Ellipse; age: number; vx: number; vy: number; spin: number }

export class BushRustle {
  private bushes: Bush[] = []
  private leaves: Leaf[] = []

  constructor(
    private readonly scene: Phaser.Scene,
    foreground: Foreground[]
  ) {
    this.add(foreground)
    // Fixed pool: concurrent visitors cannot create unbounded particles.
    for (let i = 0; i < 64; i++) {
      const image = scene.add
        .ellipse(0, 0, 4.6, 2.4, [0x9dcf50, 0xc5df72, 0xe0e994][i % 3])
        .setStrokeStyle(0.6, 0x365d30, 0.9)
        .setVisible(false)
      this.leaves.push({ image, age: 1, vx: 0, vy: 0, spin: 0 })
    }
  }

  add(foreground: Foreground[]) {
    const scene = this.scene
    for (const entry of foreground) {
      if (!isReactiveBush(entry.object.id)) continue
      const { object, image } = entry
      prepareBushCutout(scene, object.id, image)
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(object.width)
      canvas.height = Math.ceil(object.height)
      const context = canvas.getContext('2d', { willReadFrequently: true })!
      context.drawImage(
        image.texture.getSourceImage() as HTMLImageElement,
        0,
        0,
        canvas.width,
        canvas.height
      )
      const mask = {
        width: canvas.width,
        height: canvas.height,
        alpha: context.getImageData(0, 0, canvas.width, canvas.height).data,
      }
      // A slightly larger overlay conceals the still illustration beneath the moving canopy.
      image.setOrigin(0.5, 1).setPosition(object.x + object.width / 2, object.y + object.height)
      image.setDisplaySize(object.width * 1.07, object.height * 1.04)
      let rope: Phaser.GameObjects.Rope | undefined
      if (scene.game.renderer.type === 2) {
        rope = scene.add
          .rope(image.x, image.y, image.texture.key, undefined, [
            { x: -object.width / 2, y: 0 },
            { x: object.width / 2, y: 0 },
          ])
          .setDepth(image.depth)
          .setAlpha(image.alpha)
        image.setVisible(false)
      }
      const bush = { ...entry, mask, rope, phase: this.bushes.length * 1.73, cooldown: 0 }
      this.bushes.push(bush)
      this.pose(bush, 0)
    }
  }

  private pose(bush: Bush, sway: number) {
    const w = bush.object.width * 1.07
    const h = bush.object.height * 1.04
    if (bush.rope) {
      // Two triangle-strip edges: shear the canopy while keeping its base planted.
      bush.rope.vertices.set([-w / 2 + sway, -h, -w / 2, 0, w / 2 + sway, -h, w / 2, 0])
      bush.rope.dirty = false
    } else {
      bush.image.setRotation(sway / h)
    }
  }

  update(delta: number, avatars: BushContact[], disabled: boolean) {
    const dt = Math.min(delta, 50) / 1000
    for (const bush of this.bushes) {
      bush.rope?.setAlpha(bush.image.alpha)
      const contact = disabled
        ? undefined
        : avatars.find(avatar => touchesBush(bush.object, bush.mask, avatar))
      if (!contact) {
        this.pose(bush, 0)
        bush.cooldown = 0
        continue
      }
      bush.phase += dt * 19
      const sway = Math.sin(bush.phase) * Math.min(1.3, bush.object.width * 0.018)
      this.pose(bush, sway)
      bush.cooldown -= dt
      if (bush.cooldown <= 0) {
        bush.cooldown = 0.22
        for (let i = 0; i < 3; i++) {
          const leaf = this.leaves.find(item => item.age >= 1)
          if (!leaf) break
          leaf.age = 0
          leaf.vx = (Math.random() - 0.5) * 36
          leaf.vy = -28 - Math.random() * 14
          leaf.spin = (Math.random() - 0.5) * 8
          leaf.image
            .setPosition(
              Math.max(
                bush.object.x + 2,
                Math.min(bush.object.x + bush.object.width - 2, contact.x)
              ),
              Math.max(
                bush.object.y + 3,
                Math.min(bush.object.y + bush.object.height - 3, contact.y - 9)
              )
            )
            .setDepth(Math.max(contact.y, bush.object.baseY) + 1)
            .setAlpha(1)
            .setRotation(Math.random() * Math.PI)
            .setVisible(true)
        }
      }
    }
    for (const leaf of this.leaves) {
      if (disabled) leaf.age = 1
      if (leaf.age >= 1) {
        leaf.image.setVisible(false)
        continue
      }
      leaf.age += dt / 0.75
      leaf.vy += dt * 35
      leaf.image
        .setPosition(leaf.image.x + leaf.vx * dt, leaf.image.y + leaf.vy * dt)
        .setRotation(leaf.image.rotation + leaf.spin * dt)
        // Stay opaque during takeoff, then fade at the end of the flight.
        .setAlpha(Math.max(0, Math.min(1, (1 - leaf.age) / 0.45)))
    }
  }
}
