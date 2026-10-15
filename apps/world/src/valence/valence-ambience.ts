import Phaser from 'phaser'
import type { Point } from '../world'
import type { EffectToggle, LayoutPoint, ValenceEffects } from './valence-documents'
import { valenceOccluders } from './valence-occluders'
import { VALENCE_HEIGHT, VALENCE_WIDTH } from './valence-world'

// Late-afternoon light from the west; the mistral pushes smoke and leaves toward the south.
const WIND = { x: -0.35, y: 0.18 }

type Particle = {
  image: Phaser.GameObjects.Image
  life: number
  age: number
  vx: number
  vy: number
  spin: number
  sway: number
  phase: number
  kind: 'smoke' | 'leaf' | 'mote' | 'glint' | 'current'
  scale: number
  opacity: number
}

export function inside(point: Point, polygon: readonly LayoutPoint[]) {
  let result = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i],
      [bx, by] = polygon[j]
    if (ay > point.y !== by > point.y && point.x < ((bx - ax) * (point.y - ay)) / (by - ay) + ax)
      result = !result
  }
  return result
}

function texture(scene: Phaser.Scene, key: string, size: number, draw: (c: CanvasRenderingContext2D) => void) {
  if (scene.textures.exists(key)) return
  const canvas = scene.textures.createCanvas(key, size, size)!
  draw(canvas.getContext())
  canvas.refresh()
}

/** The effects document shared with the workshop; `revision` changes on every edit. */
export type EffectsModel = { effects: ValenceEffects; revision: number }

/** Light procedural life drawn in map coordinates. Paused, hidden and reduced-motion safe. */
export class ValenceAmbience {
  private readonly particles: Particle[] = []
  private readonly pool: Phaser.GameObjects.Image[] = []
  private smokeTimers: number[] = []
  private leafTimer = 0
  private moteTimer = 0
  private glintTimer = 0
  private currentTimer = 0
  private readonly trees: { x: number; y: number; width: number }[]
  private clouds: { image: Phaser.GameObjects.Image; vx: number; vy: number; scale: number }[] = []
  private revision = -1

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly model: EffectsModel
  ) {
    texture(scene, 'v-puff', 64, c => {
      const g = c.createRadialGradient(32, 32, 2, 32, 32, 31)
      g.addColorStop(0, 'rgba(92, 72, 56, 0.55)')
      g.addColorStop(0.55, 'rgba(110, 90, 72, 0.28)')
      g.addColorStop(1, 'rgba(120, 100, 80, 0)')
      c.fillStyle = g
      c.fillRect(0, 0, 64, 64)
    })
    texture(scene, 'v-leaf', 32, c => {
      c.translate(16, 16)
      c.rotate(-0.5)
      c.beginPath()
      c.moveTo(-11, 0)
      c.quadraticCurveTo(0, -8, 11, 0)
      c.quadraticCurveTo(0, 8, -11, 0)
      c.closePath()
      c.fillStyle = '#b07a3c'
      c.fill()
      c.lineWidth = 1.6
      c.strokeStyle = '#4a2e17'
      c.stroke()
      c.beginPath()
      c.moveTo(-9, 0)
      c.lineTo(9, 0)
      c.lineWidth = 1
      c.stroke()
    })
    texture(scene, 'v-mote', 16, c => {
      const g = c.createRadialGradient(8, 8, 0, 8, 8, 8)
      g.addColorStop(0, 'rgba(255, 244, 214, 1)')
      g.addColorStop(0.4, 'rgba(255, 226, 160, 0.6)')
      g.addColorStop(1, 'rgba(255, 220, 150, 0)')
      c.fillStyle = g
      c.fillRect(0, 0, 16, 16)
    })
    texture(scene, 'v-glint', 32, c => {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16)
      g.addColorStop(0, 'rgba(255, 250, 232, 0.95)')
      g.addColorStop(0.5, 'rgba(255, 240, 205, 0.35)')
      g.addColorStop(1, 'rgba(255, 240, 205, 0)')
      c.fillStyle = g
      c.fillRect(0, 0, 32, 32)
    })
    texture(scene, 'v-current', 64, c => {
      // A short curved ink stroke of current, pale on the brown water.
      c.lineCap = 'round'
      c.strokeStyle = 'rgba(255, 244, 222, 0.85)'
      c.lineWidth = 2.4
      c.beginPath()
      c.moveTo(6, 34)
      c.bezierCurveTo(20, 26, 40, 40, 58, 30)
      c.stroke()
      c.strokeStyle = 'rgba(92, 62, 34, 0.45)'
      c.lineWidth = 1.4
      c.beginPath()
      c.moveTo(14, 40)
      c.bezierCurveTo(26, 35, 38, 44, 50, 38)
      c.stroke()
    })
    texture(scene, 'v-cloud', 128, c => {
      const g = c.createRadialGradient(64, 64, 6, 64, 64, 63)
      g.addColorStop(0, 'rgba(58, 36, 20, 0.5)')
      g.addColorStop(0.6, 'rgba(58, 36, 20, 0.22)')
      g.addColorStop(1, 'rgba(58, 36, 20, 0)')
      c.fillStyle = g
      c.fillRect(0, 0, 128, 128)
    })
    this.trees = valenceOccluders
      .filter(o => o.id.startsWith('tree'))
      .map(o => ({ x: o.x + o.width / 2, y: o.y + o.height * 0.35, width: o.width }))
  }

  private sync() {
    if (this.revision === this.model.revision) return
    this.revision = this.model.revision
    const { smoke, clouds } = this.model.effects
    this.smokeTimers = smoke.map((source, index) => this.smokeTimers[index] ?? Math.random() * source.rate)
    const count = clouds.enabled ? Math.round(clouds.density) : 0
    while (this.clouds.length > count) this.clouds.pop()!.image.destroy()
    while (this.clouds.length < count) {
      const image = this.scene.add
        .image(Math.random() * VALENCE_WIDTH, Math.random() * VALENCE_HEIGHT, 'v-cloud')
        .setDepth(2500)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
      this.clouds.push({ image, vx: 4 + Math.random() * 3, vy: 2.4 + Math.random() * 1.5, scale: 3.4 + Math.random() * 2.4 })
    }
  }

  private take(key: string) {
    const image = this.pool.pop() ?? this.scene.add.image(0, 0, key)
    return image.setTexture(key).setVisible(true).setAngle(0).setBlendMode(Phaser.BlendModes.NORMAL)
  }

  private spawn(particle: Omit<Particle, 'age'>) {
    this.particles.push({ ...particle, age: 0 })
  }

  private onWater(point: Point) {
    const { river, exclusions } = this.model.effects
    return inside(point, river) && !exclusions.some(zone => inside(point, zone))
  }

  /** Spawns on water near the view; `setting.density` is events per second. */
  private waterSpawn(
    timer: number,
    setting: EffectToggle,
    dt: number,
    near: (p: Point) => boolean,
    make: (p: Point) => void
  ) {
    if (!setting.enabled || setting.density <= 0) return 0
    timer -= dt
    if (timer > 0) return timer
    const { river } = this.model.effects
    const xs = river.map(p => p[0]),
      ys = river.map(p => p[1])
    const left = Math.min(...xs),
      top = Math.min(...ys)
    const width = Math.max(...xs) - left,
      height = Math.max(...ys) - top
    for (let attempt = 0; attempt < 8; attempt++) {
      const point = { x: left + Math.random() * width, y: top + Math.random() * height }
      if (!this.onWater(point) || !near(point)) continue
      make(point)
      break
    }
    return 1000 / setting.density
  }

  /** A short golden burst where a pioneer object is picked up. */
  burst(point: Point, reducedMotion: boolean) {
    if (reducedMotion) return
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3
      const speed = 28 + Math.random() * 34
      const image = this.take('v-mote')
        .setDepth(2600)
        .setPosition(point.x, point.y - 10)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.spawn({
        image,
        life: 700 + Math.random() * 400,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.7 - 18,
        spin: 0,
        sway: 0,
        phase: 0,
        kind: 'mote',
        scale: 0.45 + Math.random() * 0.35,
        opacity: 1,
      })
    }
  }

  update(
    camera: Phaser.Cameras.Scene2D.Camera,
    delta: number,
    paused: boolean,
    reducedMotion: boolean,
    editing = false
  ) {
    this.sync()
    if (reducedMotion) {
      for (const p of this.particles.splice(0)) this.release(p)
      for (const cloud of this.clouds) cloud.image.setVisible(false)
      return
    }
    // In the workshop the preview keeps running even though the visit is paused.
    if (paused && !editing) return
    const effects = this.model.effects
    const dt = Math.min(delta, 50)
    const seconds = dt / 1000
    const view = camera.worldView
    const near = (p: Point, margin = 120) =>
      p.x > view.x - margin && p.x < view.right + margin && p.y > view.y - margin && p.y < view.bottom + margin

    for (const cloud of this.clouds) {
      const { image } = cloud
      image
        .setVisible(true)
        .setAlpha(effects.clouds.opacity)
        .setScale(cloud.scale * 1.6 * effects.clouds.size, cloud.scale * effects.clouds.size)
      image.x += cloud.vx * effects.clouds.speed * seconds
      image.y += cloud.vy * effects.clouds.speed * seconds
      if (image.x > VALENCE_WIDTH + 260 || image.y > VALENCE_HEIGHT + 200) {
        image.x = -260 - Math.random() * 200
        image.y = Math.random() * VALENCE_HEIGHT * 0.8 - 100
      }
    }

    effects.smoke.forEach((source, index) => {
      this.smokeTimers[index] -= dt
      if (this.smokeTimers[index] > 0 || !near(source, 200)) return
      this.smokeTimers[index] = source.rate * (0.7 + Math.random() * 0.6)
      const image = this.take('v-puff').setDepth(2400).setPosition(source.x, source.y)
      this.spawn({
        image,
        life: 4200 + Math.random() * 1600,
        vx: WIND.x * 10 + (Math.random() - 0.5) * 3,
        vy: -9 - Math.random() * 4,
        spin: (Math.random() - 0.5) * 20,
        sway: 2,
        phase: Math.random() * 6,
        kind: 'smoke',
        scale: source.size,
        opacity: 0.85,
      })
    })

    const { leaves, motes } = effects
    this.leafTimer -= dt
    if (leaves.enabled && leaves.density > 0 && this.leafTimer <= 0 && this.trees.length) {
      this.leafTimer = (1000 / leaves.density) * (0.6 + Math.random() * 0.8)
      const candidates = this.trees.filter(tree => near(tree))
      const tree = candidates[Math.floor(Math.random() * candidates.length)]
      if (tree) {
        const x = tree.x + (Math.random() - 0.5) * tree.width * 0.7
        const image = this.take('v-leaf').setDepth(2300).setPosition(x, tree.y)
        this.spawn({
          image,
          life: (5200 + Math.random() * 2400) / Math.max(0.2, leaves.speed),
          vx: WIND.x * 14 * leaves.speed,
          vy: (9 + Math.random() * 5) * leaves.speed,
          spin: (Math.random() - 0.5) * 160,
          sway: 9 + Math.random() * 6,
          phase: Math.random() * 6,
          kind: 'leaf',
          scale: (0.24 + Math.random() * 0.12) * leaves.size,
          opacity: leaves.opacity,
        })
      }
    }

    this.moteTimer -= dt
    if (motes.enabled && motes.density > 0 && this.moteTimer <= 0) {
      this.moteTimer = 1000 / motes.density
      const image = this.take('v-mote')
        .setDepth(2450)
        .setPosition(view.x + Math.random() * view.width, view.y + Math.random() * view.height)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.spawn({
        image,
        life: 3600 + Math.random() * 2600,
        vx: (3 + Math.random() * 4) * motes.speed,
        vy: (-1.5 - Math.random() * 2.5) * motes.speed,
        spin: 0,
        sway: 3,
        phase: Math.random() * 6,
        kind: 'mote',
        scale: (0.18 + Math.random() * 0.22) * motes.size,
        opacity: motes.opacity,
      })
    }

    const { glints, currents } = effects
    this.glintTimer = this.waterSpawn(this.glintTimer, glints, dt, p => near(p, 40), point => {
      const image = this.take('v-glint')
        .setDepth(-60)
        .setPosition(point.x, point.y)
        .setBlendMode(Phaser.BlendModes.ADD)
      this.spawn({
        image,
        life: 1400 + Math.random() * 1200,
        vx: glints.speed,
        vy: (7 + Math.random() * 4) * glints.speed,
        spin: 0,
        sway: 0,
        phase: 0,
        kind: 'glint',
        scale: (0.35 + Math.random() * 0.4) * glints.size,
        opacity: glints.opacity,
      })
    })
    this.currentTimer = this.waterSpawn(this.currentTimer, currents, dt, p => near(p, 60), point => {
      const image = this.take('v-current').setDepth(-58).setPosition(point.x, point.y)
      this.spawn({
        image,
        life: (2600 + Math.random() * 1800) / Math.max(0.2, currents.speed),
        vx: (2 + Math.random() * 2) * currents.speed,
        vy: (11 + Math.random() * 6) * currents.speed,
        spin: 0,
        sway: 1.5,
        phase: Math.random() * 6,
        kind: 'current',
        scale: (0.32 + Math.random() * 0.22) * currents.size,
        opacity: currents.opacity,
      })
    })

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.age += dt
      const t = p.age / p.life
      if (t >= 1) {
        this.release(p)
        this.particles.splice(i, 1)
        continue
      }
      const sway = Math.sin(p.phase + p.age / 520) * p.sway
      p.image.x += (p.vx + sway * 0.6) * seconds
      p.image.y += p.vy * seconds
      if (p.kind === 'smoke') {
        p.vx += WIND.x * 6 * seconds
        p.image
          .setScale(p.scale * (0.35 + t * 1.4))
          .setAlpha(p.opacity * Math.sin(Math.PI * Math.min(1, t * 1.2)))
        p.image.angle += p.spin * seconds
      } else if (p.kind === 'leaf') {
        p.image.angle += p.spin * seconds
        p.image.setScale(p.scale, p.scale * (0.55 + 0.45 * Math.abs(Math.sin(p.age / 260 + p.phase))))
        p.image.setAlpha(p.opacity * Math.min(1, t * 8, (1 - t) * 4))
      } else if (p.kind === 'mote') {
        p.image.setScale(p.scale).setAlpha(p.opacity * Math.sin(Math.PI * t))
      } else if (p.kind === 'current') {
        // Flow lines leave the water before they reach the quays.
        if (!this.onWater({ x: p.image.x, y: p.image.y })) p.age = Math.max(p.age, p.life * 0.85)
        p.image.setScale(p.scale * (1 + t * 0.4), p.scale).setAlpha(p.opacity * Math.sin(Math.PI * t))
      } else {
        p.image.setScale(p.scale * 2.2, p.scale * 0.45).setAlpha(p.opacity * Math.sin(Math.PI * t))
      }
    }
  }

  private release(p: Particle) {
    p.image.setVisible(false)
    this.pool.push(p.image)
  }
}
