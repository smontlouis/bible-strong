import Phaser from 'phaser'
import type { AmbientEditorModel, AmbientZone } from './ambient-zones'

export class AmbientZoneEditor {
  private graphics: Phaser.GameObjects.Graphics
  private start: { x: number; y: number; screenX: number; screenY: number } | null = null
  private original: AmbientZone | null = null
  private action: 'pan' | 'move' | 'resize' | 'draw' = 'pan'
  private corner = 0
  private pointer: number | null = null
  private focus = 0
  private draft: { x: number; y: number; width: number; height: number } | null = null
  constructor(
    private scene: Phaser.Scene,
    private model: AmbientEditorModel
  ) {
    this.graphics = scene.add.graphics().setDepth(3200)
    scene.input
      .on('pointerdown', this.down)
      .on('pointermove', this.move)
      .on('pointerup', this.up)
      .on('pointerupoutside', this.up)
      .on('wheel', this.wheel)
    window.addEventListener('blur', this.cancel)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input
        .off('pointerdown', this.down)
        .off('pointermove', this.move)
        .off('pointerup', this.up)
        .off('pointerupoutside', this.up)
        .off('wheel', this.wheel)
      window.removeEventListener('blur', this.cancel)
    })
  }
  private down = (p: Phaser.Input.Pointer) => {
    const m = this.model
    if (!m.editing || !m.loaded || this.pointer !== null) return
    const q = this.scene.cameras.main.getWorldPoint(p.x, p.y)
    this.start = { x: q.x, y: q.y, screenX: p.x, screenY: p.y }
    this.pointer = p.id
    this.action = m.mode === 'draw' ? 'draw' : 'pan'
    if (m.mode !== 'select') return
    const selected = m.zones.find(z => z.id === m.selected && z.kind === m.kind)
    if (selected) {
      const corners = [
        [selected.x, selected.y],
        [selected.x + selected.width, selected.y],
        [selected.x + selected.width, selected.y + selected.height],
        [selected.x, selected.y + selected.height],
      ]
      const index = corners.findIndex(
        ([x, y]) => Math.hypot(q.x - x, q.y - y) < 12 / this.scene.cameras.main.zoom
      )
      if (index >= 0) {
        this.action = 'resize'
        this.corner = index
        this.original = structuredClone(selected)
        m.checkpoint()
        return
      }
    }
    const hit = [...m.zones]
      .reverse()
      .find(
        z =>
          z.kind === m.kind &&
          q.x >= z.x &&
          q.x <= z.x + z.width &&
          q.y >= z.y &&
          q.y <= z.y + z.height
      )
    if (hit) {
      m.selected = hit.id
      this.action = 'move'
      this.original = structuredClone(hit)
      m.checkpoint()
      m.notify()
    }
  }
  private move = (p: Phaser.Input.Pointer) => {
    if (!this.start || p.id !== this.pointer || !p.isDown || !this.model.editing) return
    const camera = this.scene.cameras.main,
      q = camera.getWorldPoint(p.x, p.y),
      a = this.start
    if (this.action === 'pan') {
      camera.scrollX -= (p.x - a.screenX) / camera.zoom
      camera.scrollY -= (p.y - a.screenY) / camera.zoom
      a.screenX = p.x
      a.screenY = p.y
      return
    }
    if (this.action === 'draw') {
      this.draft = {
        x: Math.min(a.x, q.x),
        y: Math.min(a.y, q.y),
        width: Math.abs(q.x - a.x),
        height: Math.abs(q.y - a.y),
      }
      return
    }
    const old = this.original,
      zone = this.model.zones.find(z => z.id === old?.id)
    if (!old || !zone) return
    if (this.action === 'move') {
      zone.x = Phaser.Math.Clamp(old.x + q.x - a.x, -10000, 10000)
      zone.y = Phaser.Math.Clamp(old.y + q.y - a.y, -10000, 10000)
    } else {
      const anchorX = this.corner === 0 || this.corner === 3 ? old.x + old.width : old.x
      const anchorY = this.corner < 2 ? old.y + old.height : old.y
      const width = Phaser.Math.Clamp(Math.abs(q.x - anchorX), 12, 1200),
        height = Phaser.Math.Clamp(Math.abs(q.y - anchorY), 12, 1200)
      zone.x = q.x < anchorX ? anchorX - width : anchorX
      zone.y = q.y < anchorY ? anchorY - height : anchorY
      zone.width = width
      zone.height = height
    }
    this.model.revision++
    this.model.notify()
  }
  private up = (p: Phaser.Input.Pointer) => {
    if (p.id === this.pointer) this.finish()
  }
  private cancel = () => this.finish()
  private finish() {
    if (
      this.draft &&
      this.draft.width >= 12 &&
      this.draft.height >= 12 &&
      this.draft.width <= 1200 &&
      this.draft.height <= 1200
    )
      this.model.add(this.draft)
    if (this.original) this.model.commit()
    this.start = null
    this.original = null
    this.draft = null
    this.pointer = null
  }
  private wheel = (_p: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
    if (this.model.editing) {
      const c = this.scene.cameras.main
      c.setZoom(Phaser.Math.Clamp(c.zoom * Math.exp(-dy * 0.001), 0.4, 8))
    }
  }
  update() {
    const m = this.model,
      g = this.graphics,
      c = this.scene.cameras.main
    g.clear()
    if (!m.editing) {
      if (this.start) this.finish()
      return
    }
    if (m.focus !== this.focus) {
      this.focus = m.focus
      const z = m.zones.find(z => z.id === m.selected)
      if (z) {
        c.setZoom(
          Math.min(5, (c.width * 0.5) / (z.width + 100), (c.height * 0.7) / (z.height + 100))
        )
        c.centerOn(z.x + z.width / 2 - 90 / c.zoom, z.y + z.height / 2)
      }
    }
    if (m.guides)
      for (const z of m.zones.filter(z => z.kind === m.kind)) {
        const selected = z.id === m.selected,
          color = selected ? 0xffd36a : 0x87eee0
        g.fillStyle(color, selected ? 0.1 : 0.035).fillRect(z.x, z.y, z.width, z.height)
        g.lineStyle((selected ? 2 : 1) / c.zoom, color, z.enabled ? 1 : 0.4).strokeRect(
          z.x,
          z.y,
          z.width,
          z.height
        )
        if (selected)
          for (const [x, y] of [
            [z.x, z.y],
            [z.x + z.width, z.y],
            [z.x + z.width, z.y + z.height],
            [z.x, z.y + z.height],
          ])
            g.fillStyle(color).fillRect(x - 4 / c.zoom, y - 4 / c.zoom, 8 / c.zoom, 8 / c.zoom)
      }
    if (this.draft)
      g.lineStyle(2 / c.zoom, 0xffd36a).strokeRect(
        this.draft.x,
        this.draft.y,
        this.draft.width,
        this.draft.height
      )
  }
}
