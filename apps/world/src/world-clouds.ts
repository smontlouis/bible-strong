import Phaser from 'phaser'
import { projectCloud } from './cloud-parallax'

const smoothstep = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

/** Six paired silhouettes, generated once; only twelve quads move each frame. */
export class WorldClouds {
  private time = 0
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private readonly clouds: {
    cloud: Phaser.GameObjects.Image
    shadow: Phaser.GameObjects.Image
    phase: number
    period: number
    y: number
    width: number
  }[]

  constructor(scene: Phaser.Scene) {
    for (let variant = 0; variant < 6; variant++) {
      // Draw one opaque silhouette first; blur the merged mass, never individual lobes.
      // Seeded harmonics vary the outline without changing it on reload or during flight.
      const shape = document.createElement('canvas')
      shape.width = 512
      shape.height = 320
      const context = shape.getContext('2d')!
      const phase = variant * 2.39996
      context.beginPath()
      for (let step = 0; step <= 120; step++) {
        const angle = (step / 120) * Math.PI * 2
        const radius = 1 + 0.12 * Math.sin(angle * 3 + phase)
          + 0.08 * Math.cos(angle * 5 - phase * 1.7)
          + 0.04 * Math.sin(angle * 7 + phase * 0.6)
        const x = 256 + Math.cos(angle) * (148 + variant * 3) * radius
        const y = 160 + Math.sin(angle) * (62 + (variant % 3) * 9) * radius
          + Math.cos(angle * 2 + phase) * 9
        if (step === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      }
      context.closePath()
      context.fillStyle = '#fff'
      context.fill()
      for (const shadow of [false, true]) {
        const key = `ambient-cloud-${shadow ? 'shadow' : 'mass'}-${variant}`
        if (scene.textures.exists(key)) continue
        const texture = scene.textures.createCanvas(key, 512, 320)!
        const ctx = texture.context
        ctx.filter = `blur(${shadow ? 22 : 15}px)`
        ctx.drawImage(shape, 0, 0)
        ctx.filter = 'none'
        ctx.globalCompositeOperation = 'source-in'
        ctx.fillStyle = shadow ? '#2a415f' : '#f5f8f5'
        ctx.fillRect(0, 0, 512, 320)
        ctx.globalCompositeOperation = 'source-over'
        texture.refresh()
      }
    }
    this.clouds = [
      { phase: 0.46, period: 82, y: 470, width: 620 },
      { phase: 0.76, period: 96, y: 650, width: 760 },
      { phase: 0.19, period: 108, y: 220, width: 570 },
      { phase: 0.61, period: 91, y: 830, width: 650 },
      { phase: 0.91, period: 118, y: 390, width: 700 },
      { phase: 0.34, period: 103, y: 710, width: 540 },
    ].map((config, variant) => ({
      ...config,
      shadow: scene.add.image(0, 0, `ambient-cloud-shadow-${variant}`).setDepth(3000).setAlpha(0.2),
      cloud: scene.add.image(0, 0, `ambient-cloud-mass-${variant}`).setDepth(3001),
    }))
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, delta: number, paused: boolean) {
    if (this.reducedMotion.matches) {
      for (const { cloud, shadow } of this.clouds) {
        cloud.setVisible(false)
        shadow.setVisible(false)
      }
      return
    }
    if (!paused) this.time += Math.min(delta, 50) / 1000
    const viewWidth = camera.width / camera.zoom
    const viewHeight = camera.height / camera.zoom
    const left = camera.scrollX + camera.width / 2 - viewWidth / 2
    const top = camera.scrollY + camera.height / 2 - viewHeight / 2
    // Fade out early when leaving the wide view; ground shadows remain visible.
    const skyAlpha = smoothstep((Math.min(viewWidth / 1671, viewHeight / 941) - 0.9) / 0.35) * 0.82
    for (const item of this.clouds) {
      const progress = (this.time / item.period + item.phase) % 1
      const x = -800 + progress * 3271
      const y = item.y + (progress - 0.5) * 200
      // Fade beyond the island bounds as well: no wrap jump when zoomed far out.
      const edgeAlpha = smoothstep(progress / 0.12) * smoothstep((1 - progress) / 0.12)
      const sky = projectCloud(x - 180, y - 310, camera)
      for (const [image, px, py, alpha, scale] of [
        [item.shadow, x, y, 0.2 * edgeAlpha, 1],
        [item.cloud, sky.x, sky.y, skyAlpha * edgeAlpha, sky.scale],
      ] as const) {
        const width = item.width * scale
        const height = width * 320 / 512
        const visible = alpha > 0.001 && px + width / 2 > left && px - width / 2 < left + viewWidth && py + height / 2 > top && py - height / 2 < top + viewHeight
        image.setVisible(visible)
        if (visible) image.setPosition(px, py).setDisplaySize(width, height).setAlpha(alpha)
      }
    }
  }
}
