import Phaser from 'phaser'
import type { Point } from '../world'
import { valenceOccluders } from './valence-occluders'
import { VALENCE_HEIGHT, VALENCE_WIDTH } from './valence-world'

// Late-afternoon light from the west; the mistral pushes smoke and leaves toward the south.
const WIND = { x: -0.35, y: 0.18 }
const SMOKE_SOURCES: { x: number; y: number; rate: number; size: number }[] = [
  { x: 1611, y: 196, rate: 260, size: 1.25 },
  { x: 1421, y: 60, rate: 1300, size: 0.7 },
  { x: 1494, y: 70, rate: 1500, size: 0.7 },
  { x: 1239, y: 362, rate: 1700, size: 0.6 },
]
/** The Rhône, west of the quays; the bridge pylon is left out. */
const RIVER: Point[] = [
  { x: 0, y: 150 },
  { x: 330, y: 135 },
  { x: 290, y: 230 },
  { x: 255, y: 330 },
  { x: 240, y: 450 },
  { x: 210, y: 560 },
  { x: 165, y: 660 },
  { x: 155, y: 760 },
  { x: 195, y: 860 },
  { x: 235, y: 941 },
  { x: 0, y: 941 },
]
const PYLON = { x: 92, y: 205, width: 85, height: 225 }

type Particle = {
  image: Phaser.GameObjects.Image
  life: number
  age: number
  vx: number
  vy: number
  spin: number
  sway: number
  phase: number
  kind: 'smoke' | 'leaf' | 'mote' | 'glint' | 'cloud' | 'current'
  scale: number
}

function inside(point: Point, polygon: Point[]) {
  let result = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j]
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x)
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

/** Light procedural life drawn in map coordinates. Paused, hidden and reduced-motion safe. */
export class ValenceAmbience {
  private readonly particles: Particle[] = []
  private readonly pool: Phaser.GameObjects.Image[] = []
  private readonly timers = SMOKE_SOURCES.map(source => Math.random() * source.rate)
  private leafTimer = 0
  private moteTimer = 0
  private glintTimer = 0
  private currentTimer = 0
  private readonly trees: { x: number; y: number; width: number }[]
  private readonly clouds: Particle[] = []

  constructor(private readonly scene: Phaser.Scene) {
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
    for (let i = 0; i < 4; i++) {
      const image = scene.add
        .image(0, 0, 'v-cloud')
        .setDepth(2500)
        .setBlendMode(Phaser.BlendModes.MULTIPLY)
      const cloud: Particle = {
        image,
        life: Infinity,
        age: 0,
        vx: 4 + Math.random() * 3,
        vy: 2.4 + Math.random() * 1.5,
        spin: 0,
        sway: 0,
        phase: Math.random() * 10,
        kind: 'cloud',
        scale: 3.4 + Math.random() * 2.4,
      }
      image.setPosition(Math.random() * VALENCE_WIDTH, Math.random() * VALENCE_HEIGHT)
      image.setScale(cloud.scale * 1.6, cloud.scale).setAlpha(0.11)
      this.clouds.push(cloud)
    }
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
      })
    }
  }

  private take(key: string) {
    const image = this.pool.pop() ?? this.scene.add.image(0, 0, key)
    return image.setTexture(key).setVisible(true).setAngle(0).setBlendMode(Phaser.BlendModes.NORMAL)
  }

  private spawn(particle: Omit<Particle, 'age'>) {
    this.particles.push({ ...particle, age: 0 })
  }

  update(
    camera: Phaser.Cameras.Scene2D.Camera,
    delta: number,
    paused: boolean,
    reducedMotion: boolean,
    avatar: Point
  ) {
    const visible = this.particles.length > 0 || !reducedMotion
    if (reducedMotion) {
      for (const p of this.particles.splice(0)) this.release(p)
      for (const cloud of this.clouds) cloud.image.setVisible(false)
      return
    }
    if (!visible || paused) return
    const dt = Math.min(delta, 50)
    const seconds = dt / 1000
    const view = camera.worldView
    const near = (x: number, y: number, margin = 120) =>
      x > view.x - margin && x < view.right + margin && y > view.y - margin && y < view.bottom + margin

    for (const cloud of this.clouds) {
      const image = cloud.image.setVisible(true)
      image.x += cloud.vx * seconds
      image.y += cloud.vy * seconds
      if (image.x > VALENCE_WIDTH + 260 || image.y > VALENCE_HEIGHT + 200) {
        image.x = -260 - Math.random() * 200
        image.y = Math.random() * VALENCE_HEIGHT * 0.8 - 100
      }
    }

    SMOKE_SOURCES.forEach((source, index) => {
      this.timers[index] -= dt
      if (this.timers[index] > 0 || !near(source.x, source.y, 200)) return
      this.timers[index] = source.rate * (0.7 + Math.random() * 0.6)
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
      })
    })

    this.leafTimer -= dt
    if (this.leafTimer <= 0 && this.trees.length) {
      this.leafTimer = 380 + Math.random() * 420
      const candidates = this.trees.filter(tree => near(tree.x, tree.y))
      const tree = candidates[Math.floor(Math.random() * candidates.length)]
      if (tree) {
        const x = tree.x + (Math.random() - 0.5) * tree.width * 0.7
        const image = this.take('v-leaf').setDepth(2300).setPosition(x, tree.y)
        this.spawn({
          image,
          life: 5200 + Math.random() * 2400,
          vx: WIND.x * 14,
          vy: 9 + Math.random() * 5,
          spin: (Math.random() - 0.5) * 160,
          sway: 9 + Math.random() * 6,
          phase: Math.random() * 6,
          kind: 'leaf',
          scale: 0.24 + Math.random() * 0.12,
        })
      }
    }

    this.moteTimer -= dt
    if (this.moteTimer <= 0) {
      this.moteTimer = 140
      const x = view.x + Math.random() * view.width
      const y = view.y + Math.random() * view.height
      const image = this.take('v-mote').setDepth(2450).setPosition(x, y).setBlendMode(Phaser.BlendModes.ADD)
      this.spawn({
        image,
        life: 3600 + Math.random() * 2600,
        vx: 3 + Math.random() * 4,
        vy: -1.5 - Math.random() * 2.5,
        spin: 0,
        sway: 3,
        phase: Math.random() * 6,
        kind: 'mote',
        scale: 0.18 + Math.random() * 0.22,
      })
    }

    this.glintTimer -= dt
    if (this.glintTimer <= 0) {
      this.glintTimer = 90
      for (let attempt = 0; attempt < 6; attempt++) {
        const point = { x: Math.random() * 330, y: 140 + Math.random() * 800 }
        const inPylon =
          point.x > PYLON.x && point.x < PYLON.x + PYLON.width && point.y > PYLON.y && point.y < PYLON.y + PYLON.height
        if (!inside(point, RIVER) || inPylon || !near(point.x, point.y, 40)) continue
        const image = this.take('v-glint').setDepth(-60).setPosition(point.x, point.y).setBlendMode(Phaser.BlendModes.ADD)
        this.spawn({
          image,
          life: 1400 + Math.random() * 1200,
          vx: 1,
          vy: 7 + Math.random() * 4,
          spin: 0,
          sway: 0,
          phase: 0,
          kind: 'glint',
          scale: 0.35 + Math.random() * 0.4,
        })
        break
      }
    }

    this.currentTimer -= dt
    if (this.currentTimer <= 0) {
      this.currentTimer = 110
      for (let attempt = 0; attempt < 6; attempt++) {
        const point = { x: Math.random() * 320, y: 130 + Math.random() * 800 }
        const inPylon =
          point.x > PYLON.x - 10 &&
          point.x < PYLON.x + PYLON.width + 10 &&
          point.y > PYLON.y &&
          point.y < PYLON.y + PYLON.height + 20
        if (!inside(point, RIVER) || inPylon || !near(point.x, point.y, 60)) continue
        const image = this.take('v-current').setDepth(-58).setPosition(point.x, point.y)
        this.spawn({
          image,
          life: 2600 + Math.random() * 1800,
          vx: 2 + Math.random() * 2,
          vy: 11 + Math.random() * 6,
          spin: 0,
          sway: 1.5,
          phase: Math.random() * 6,
          kind: 'current',
          scale: 0.32 + Math.random() * 0.22,
        })
        break
      }
    }

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
        p.image.setScale(p.scale * (0.35 + t * 1.4)).setAlpha(0.85 * Math.sin(Math.PI * Math.min(1, t * 1.2)))
        p.image.angle += p.spin * seconds
      } else if (p.kind === 'leaf') {
        p.image.angle += p.spin * seconds
        p.image.setScale(p.scale, p.scale * (0.55 + 0.45 * Math.abs(Math.sin(p.age / 260 + p.phase))))
        p.image.setAlpha(Math.min(1, t * 8, (1 - t) * 4))
      } else if (p.kind === 'mote') {
        p.image.setScale(p.scale).setAlpha(0.7 * Math.sin(Math.PI * t))
      } else if (p.kind === 'current') {
        // Flow lines leave the water before they reach the quays.
        if (!inside({ x: p.image.x, y: p.image.y }, RIVER)) p.age = Math.max(p.age, p.life * 0.85)
        p.image.setScale(p.scale * (1 + t * 0.4), p.scale).setAlpha(0.7 * Math.sin(Math.PI * t))
      } else if (p.kind === 'glint') {
        p.image.setScale(p.scale * 2.2, p.scale * 0.45).setAlpha(0.75 * Math.sin(Math.PI * t))
      }
    }
    void avatar
  }

  private release(p: Particle) {
    p.image.setVisible(false)
    this.pool.push(p.image)
  }
}
