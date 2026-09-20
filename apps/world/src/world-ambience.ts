import Phaser from 'phaser'
import type { Point } from './world'
import defaults from './ambient-defaults.json'
import { parseAmbientZones, type AmbientZone, type AmbientEditorModel } from './ambient-zones'

// All positions use the original 1671 × 941 map. Water lanes avoid islands and bridges.
const illuminatedColor = (color: number, amount: number) => {
  const channel = (shift: number) => {
    const value = (color >> shift) & 255
    return Math.round(value + (255 - value) * amount)
  }
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}
const wave = (t: number) => (1 + Math.sin(t)) / 2
const fade = (p: number) => Math.sin(Math.PI * Math.max(0, Math.min(1, p)))
export type AmbientRegion = {
  kind: 'light' | 'particles' | 'butterfly' | 'dragonfly'
  x: number
  y: number
  width: number
  height: number
}
type Effect = {
  region: AmbientRegion
  glow?: Phaser.GameObjects.Graphics
  graphics: Phaser.GameObjects.Graphics
  x: number
  y: number
  radius: number
  draw: (
    g: Phaser.GameObjects.Graphics,
    t: number,
    avatar: Point,
    glow?: Phaser.GameObjects.Graphics
  ) => void
}

/** Small procedural accents, with one scene-owned clock and no timers or DOM listeners. */
export class WorldAmbience {
  private time = 0
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  private readonly effects: Effect[] = []

  private revision = -1
  private activeZone?: AmbientZone
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly model?: AmbientEditorModel
  ) {
    this.rebuild(model?.zones ?? parseAmbientZones(defaults))
  }

  private rebuild(zones: AmbientZone[]) {
    for (const effect of this.effects) {
      effect.graphics.destroy()
      effect.glow?.destroy()
    }
    this.effects.length = 0
    for (const zone of zones) {
      if (!zone.enabled) continue
      this.activeZone = zone
      const x = zone.x + zone.width / 2,
        y = zone.y + zone.height / 2
      const color = Number.parseInt(zone.color.slice(1), 16)
      if (zone.kind === 'particles') {
        this.addDrift(
          x - 9,
          zone.y + 3,
          Math.max(0, zone.width - 50),
          Math.max(1, zone.height - 6),
          color,
          zone.count,
          zone.phase
        )
      } else if (zone.kind === 'butterfly') {
        for (let i = 0; i < zone.count; i++) this.addButterfly(x, y, color, zone.phase + i * 7.31)
      } else if (zone.kind === 'dragonfly') {
        for (let i = 0; i < zone.count; i++) this.addDragonfly(x, y, zone.phase + i * 6.73)
      } else if (zone.style === 'sparkle') {
        this.add(
          x,
          y,
          zone.width / 2,
          2001,
          (g, t) => {
            const p = (t + zone.phase) % 23
            if (p > 1.8) return
            const alpha = Math.sin((p / 1.8) * Math.PI) * 0.6
            const px = x + (p / 1.8 - 0.5) * zone.width * 0.4,
              py = y + (p / 1.8 - 0.5) * zone.height * 0.1
            g.lineStyle(1.5 * zone.size, color, alpha).lineBetween(
              px - 3 * zone.size,
              py,
              px + 3 * zone.size,
              py
            )
            g.lineBetween(px, py - 4 * zone.size, px, py + 4 * zone.size)
          },
          'light'
        )
      } else this.addLamp(x, y, zone.phase, zone.style === 'lantern')
    }
    this.activeZone = undefined
    this.revision = this.model?.revision ?? 0
  }

  get diagnosticRegions(): AmbientRegion[] {
    return this.model
      ? this.model.zones.filter(z => z.enabled).map(z => ({ ...z }))
      : this.effects.map(effect => effect.region)
  }

  private add(
    x: number,
    y: number,
    radius: number,
    depth: number,
    draw: Effect['draw'],
    kind: AmbientRegion['kind'] = 'light',
    bounds?: Omit<AmbientRegion, 'kind'>
  ) {
    const zone = this.activeZone
    const region = zone
      ? { ...zone }
      : {
          kind,
          ...(bounds ?? { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 }),
        }
    const graphics = this.scene.add
      .graphics()
      .setDepth(depth)
      .setAlpha(zone?.intensity ?? 1)
    // Light adds brightness to the illustration instead of tinting yellow pixels yellow.
    if (kind === 'light') graphics.setBlendMode('ADD')
    const glow =
      kind === 'particles' && (zone?.glow ?? 0) > 0
        ? this.scene.add
            .graphics()
            .setDepth(depth - 0.01)
            .setBlendMode('ADD')
            .setAlpha(zone?.intensity ?? 1)
        : undefined
    this.effects.push({
      x: region.x + region.width / 2,
      y: region.y + region.height / 2,
      radius: Math.hypot(region.width, region.height) / 2,
      draw: zone ? (g, t, avatar, halo) => draw(g, t * zone.speed, avatar, halo) : draw,
      region,
      graphics,
      glow,
    })
  }

  private addLamp(x: number, y: number, phase: number, warmCore = false) {
    const zone = this.activeZone!
    const color = Number.parseInt(zone.color.slice(1), 16)
    this.add(
      x,
      y,
      37,
      2001,
      (g, t) => {
        const flicker =
          0.55 * wave(t * 2.1 + phase) +
          0.3 * wave(t * 3.7 + phase * 1.3) +
          0.15 * wave(t * 6.1 + phase * 0.7)
        const pulse = 0.55 + flicker * 0.45
        const width = zone.width * (0.92 + flicker * 0.08)
        const height = zone.height * (0.92 + flicker * 0.08)
        // Overlapping, low-opacity ellipses form a feathered halo spanning the edited zone.
        // A few flat, faint circles disappeared against the already bright lantern artwork.
        for (let i = 24; i >= 1; i--) {
          const radius = i / 24
          const alpha = (1 - radius) ** 1.4 * 0.095 * pulse
          g.fillStyle(color, alpha).fillEllipse(x, y, width * radius, height * radius)
        }
        if (warmCore) {
          const coreX = x + Math.sin(t * 2.7 + phase) * zone.width * 0.004
          const coreY = y + zone.height * 0.013 - flicker * zone.height * 0.01
          g.fillStyle(color, 0.12 + flicker * 0.14).fillEllipse(
            x,
            y,
            zone.width * 0.135,
            zone.height * 0.23
          )
          g.fillStyle(0xfff0bd, 0.14 + flicker * 0.2).fillEllipse(
            coreX,
            coreY,
            zone.width * (0.06 + flicker * 0.013),
            zone.height * (0.12 + flicker * 0.027)
          )
        }
      },
      'light'
    )
  }

  private addDrift(
    x: number,
    y: number,
    spread: number,
    fall: number,
    color: number,
    count: number,
    phase: number
  ) {
    const zone = this.activeZone!
    const period = 28 + (phase % 13)
    const radius = Math.hypot(spread / 2 + 34, fall / 2 + 4)
    this.add(
      x,
      y + fall / 2,
      radius,
      2001,
      (g, t, _avatar, glow) => {
        for (let i = 0; i < count; i++) {
          // Stagger both the start and duration so a denser cluster never falls in unison.
          const particlePeriod = period + (i % 4) * 2.7
          const p = ((t + phase + i * 7.31) % particlePeriod) / particlePeriod
          // Each petal still rests between falls; the other petals keep their own rhythm.
          if (p > 0.6) continue
          const progress = p / 0.6
          const px =
            x + (Math.sin(i * 4.7) * spread) / 2 + Math.sin(progress * 6 + i) * 12 + progress * 18
          const py = y + progress * fall
          const size = (1.05 + ((i * 7 + phase) % 5) * 0.16) * zone.size
          // Clip centres to the editable bounds, including narrow user-created zones.
          const drawX = Math.max(zone.x + size, Math.min(zone.x + zone.width - size, px))
          const illumination = (zone.glow ?? 0) * (0.8 + 0.2 * wave(t * 2 + i))
          if (glow) {
            const brightness = illumination * fade(progress)
            // The halo retains the source hue while the particle's body and core brighten.
            for (let ring = 8; ring >= 1; ring--) {
              const radius = ring / 8
              glow
                .fillStyle(color, brightness * 0.13 * (1 - radius) ** 1.2)
                .fillCircle(drawX, py, size * (1 + radius * 4))
            }
            glow.fillStyle(color, brightness * 0.38).fillCircle(drawX, py, size * 0.8)
          }
          const drawShape = (radius: number, tint: number, alpha: number) => {
            g.fillStyle(tint, alpha)
            if (zone.style === 'leaf' || zone.style === 'petal') {
              g.save()
                .translateCanvas(drawX, py)
                .rotateCanvas(Math.sin(progress * 6 + i) * 0.8)
              g.fillEllipse(
                0,
                0,
                radius * (zone.style === 'leaf' ? 1.2 : 1.8),
                radius * 2.4
              ).restore()
            } else if (zone.style === 'sparkle') {
              g.lineStyle((0.7 * radius) / size, tint, alpha).lineBetween(
                drawX - radius,
                py,
                drawX + radius,
                py
              )
              g.lineBetween(drawX, py - radius, drawX, py + radius)
            } else g.fillCircle(drawX, py, radius)
          }
          drawShape(size, illuminatedColor(color, illumination * 0.62), fade(progress) * 0.78)
          if (illumination > 0) {
            // Same silhouette at the centre: a leaf remains a leaf, not a luminous disk.
            drawShape(
              size * 0.48,
              illuminatedColor(color, illumination * 0.96),
              fade(progress) * illumination * 0.85
            )
          }
        }
      },
      'particles',
      { x: x - spread / 2 - 16, y: y - 3, width: spread + 50, height: fall + 6 }
    )
  }

  private addButterfly(x: number, y: number, color: number, phase: number) {
    const zone = this.activeZone!
    const size = zone.size
    const travelX = Math.max(0, zone.width / 2 - size * 5) / 28
    const travelY = Math.max(0, zone.height / 2 - size * 5) / 17
    let bank = 0
    let previousTime: number | undefined
    this.add(
      x,
      y,
      42,
      2001,
      (g, time) => {
        const t = time + phase
        const period = 27 + (phase % 7)
        const progress = (t % period) / period
        if (progress > 0.85) return
        const opacity = Math.min(1, progress / 0.08, (0.85 - progress) / 0.08) * 0.9
        const px = x + (Math.sin(t * 0.37) * 23 + Math.sin(t * 0.83) * 5) * travelX
        const py = y + (Math.sin(t * 0.71) * 12 + Math.cos(t * 0.23) * 5) * travelY
        // Follow the path velocity: lean into horizontal travel and straighten as it slows.
        const velocityX = Math.cos(t * 0.37) * 23 * 0.37 + Math.cos(t * 0.83) * 5 * 0.83
        const velocityY = Math.cos(t * 0.71) * 12 * 0.71 - Math.sin(t * 0.23) * 5 * 0.23
        const limit = Math.PI / 6
        const targetBank = Math.max(
          -limit,
          Math.min(limit, Math.atan2(velocityX, 14 + Math.abs(velocityY) * 0.6))
        )
        const elapsed = previousTime === undefined ? 0 : Math.min(0.05, time - previousTime)
        bank += (targetBank - bank) * (1 - Math.exp(-elapsed / 0.28))
        previousTime = time
        const wing = 0.55 + wave(t * (17 + (phase % 4))) * 2.5
        g.save().translateCanvas(px, py).rotateCanvas(bank).scaleCanvas(size, size)
        g.fillStyle(color, opacity)
        for (const side of [-1, 1]) {
          g.fillEllipse(side * wing * 0.6, -1.1, wing * 1.25, 3.8)
          g.fillEllipse(side * wing * 0.5, 1.5, wing, 2.7)
        }
        g.lineStyle(0.7, 0x596274, opacity).lineBetween(0, -2, 0, 2.7)
        g.restore()
      },
      'butterfly'
    )
  }

  private addDragonfly(x: number, y: number, phase = 0) {
    const zone = this.activeZone!,
      size = zone.size,
      color = Number.parseInt(zone.color.slice(1), 16)
    this.add(
      x,
      y,
      48,
      2001,
      (g, t) => {
        t += phase
        const p = t % 22
        if (p > 10) return
        const px = x + Math.sin(t * 0.7) * Math.max(0, zone.width / 2 - size * 6),
          py = y + Math.cos(t * 1.1) * Math.max(0, zone.height / 2 - size * 6)
        const opacity = fade(p / 10)
        g.save().translateCanvas(px, py).scaleCanvas(size, size).translateCanvas(-px, -py)
        g.lineStyle(1.5, 0x397887, opacity).lineBetween(px, py - 4, px, py + 5)
        g.fillStyle(color, opacity * 0.55)
        g.fillEllipse(px, py - 1, 11, 1 + wave(t * 43) * 2)
        g.fillEllipse(px, py + 2, 9, 1 + wave(t * 43) * 2)
        g.restore()
      },
      'dragonfly'
    )
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, delta: number, avatar: Point, paused: boolean) {
    if (this.model && this.revision !== this.model.revision) this.rebuild(this.model.zones)
    const reduced = this.reducedMotion.matches
    if (reduced) {
      for (const effect of this.effects) {
        effect.graphics.setVisible(false)
        effect.glow?.setVisible(false)
      }
      return
    }
    if (paused) return
    if (!reduced) this.time += Math.min(delta, 50) / 1000
    const width = camera.width / camera.zoom,
      height = camera.height / camera.zoom
    const left = camera.scrollX + camera.width / 2 - width / 2
    const top = camera.scrollY + camera.height / 2 - height / 2
    for (const effect of this.effects) {
      const visible =
        !reduced &&
        effect.x + effect.radius > left &&
        effect.x - effect.radius < left + width &&
        effect.y + effect.radius > top &&
        effect.y - effect.radius < top + height
      effect.graphics.setVisible(visible)
      effect.glow?.setVisible(visible)
      if (visible) {
        effect.graphics.clear()
        effect.glow?.clear()
        effect.draw(effect.graphics, this.time, avatar, effect.glow)
      }
    }
  }
}
