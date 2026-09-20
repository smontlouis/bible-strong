import Phaser from 'phaser'
import { prepareShore, simplify, type ShoreEditorModel, type ShorePoint } from './shorelines'

/** Shore geometry lives in the same source coordinates as the streamed map. */
export class ShoreWaves {
  private waves: Phaser.GameObjects.Graphics
  private guides: Phaser.GameObjects.Graphics
  private prepared = new Map<string, ReturnType<typeof prepareShore>>()
  private revision = -1
  private clock = 0.6
  private focus = 0
  private drawing: ShorePoint[] = []
  private drag: { id: string; index: number } | null = null
  private previous: { x: number; y: number } | null = null
  private pointerId: number | null = null
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  constructor(
    private scene: Phaser.Scene,
    private model: ShoreEditorModel
  ) {
    this.waves = scene.add.graphics().setDepth(-70)
    this.guides = scene.add.graphics().setDepth(3100)
    scene.input.on('pointerdown', this.down)
    scene.input.on('pointermove', this.move)
    scene.input.on('pointerup', this.up)
    scene.input.on('pointerupoutside', this.up)
    scene.input.on('wheel', this.wheel)
    window.addEventListener('blur', this.cancel)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('blur', this.cancel)
      scene.input
        .off('pointerdown', this.down)
        .off('pointermove', this.move)
        .off('pointerup', this.up)
        .off('pointerupoutside', this.up)
        .off('wheel', this.wheel)
    })
  }
  private point(p: Phaser.Input.Pointer): ShorePoint {
    const world = this.scene.cameras.main.getWorldPoint(p.x, p.y)
    return [world.x, world.y]
  }
  private down = (p: Phaser.Input.Pointer) => {
    if (!this.model.editing || this.pointerId !== null) return
    this.pointerId = p.id
    const point = this.point(p)
    this.previous = { x: p.x, y: p.y }
    if (this.model.mode === 'draw') this.drawing = [point]
    if (this.model.mode === 'edit') {
      let best = 12 / this.scene.cameras.main.zoom
      for (const line of this.model.lines)
        line.points.forEach((q, index) => {
          const distance = Math.hypot(q[0] - point[0], q[1] - point[1])
          if (distance < best) {
            best = distance
            this.drag = { id: line.id, index }
          }
        })
      if (this.drag) {
        this.model.checkpoint()
        this.model.selected = this.drag.id
        this.model.notify()
      }
    }
  }
  private move = (p: Phaser.Input.Pointer) => {
    if (!this.model.editing || !p.isDown || p.id !== this.pointerId) return
    const point = this.point(p)
    if (this.drawing.length) {
      const last = this.drawing[this.drawing.length - 1]
      if (this.drawing.length < 1024 && Math.hypot(last[0] - point[0], last[1] - point[1]) > 1.3)
        this.drawing.push(point)
    } else if (this.drag) {
      const line = this.model.lines.find(line => line.id === this.drag!.id)
      if (line) {
        line.points[this.drag.index] = point
        this.model.revision++
      }
    } else if (this.previous) {
      const camera = this.scene.cameras.main
      camera.scrollX -= (p.x - this.previous.x) / camera.zoom
      camera.scrollY -= (p.y - this.previous.y) / camera.zoom
    }
    this.previous = { x: p.x, y: p.y }
  }
  private up = (p: Phaser.Input.Pointer) => {
    if (p.id !== this.pointerId) return
    if (this.drawing.length > 2) {
      let points = simplify(this.drawing)
      while (points.length > 256)
        points = points.filter((_, i) => i % 2 === 0 || i === points.length - 1)
      this.model.add(points)
      this.model.mode = 'edit'
      this.model.notify()
    }
    if (this.drag) this.model.save()
    this.cancel()
  }
  private cancel = () => {
    if (this.drag) this.model.save()
    this.drawing = []
    this.drag = null
    this.previous = null
    this.pointerId = null
  }
  private wheel = (_p: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
    if (this.model.editing) {
      const camera = this.scene.cameras.main
      camera.setZoom(Phaser.Math.Clamp(camera.zoom * Math.exp(-dy * 0.001), 0.4, 8))
    }
  }
  update(delta: number, suspended: boolean, diagnostic = false) {
    const m = this.model,
      camera = this.scene.cameras.main
    if (!m.editing && this.pointerId !== null) this.cancel()
    if (this.revision !== m.revision) {
      this.prepared = new Map(
        m.lines.map(line => [line.id, prepareShore(line.points, line.closed)])
      )
      this.revision = m.revision
    }
    if (m.editing && m.focus !== this.focus) {
      this.focus = m.focus
      const line = m.lines.find(line => line.id === m.selected)
      if (line) {
        const xs = line.points.map(p => p[0]),
          ys = line.points.map(p => p[1])
        const x = Math.min(...xs),
          y = Math.min(...ys),
          width = Math.max(...xs) - x,
          height = Math.max(...ys) - y
        camera.setZoom(
          Math.min(5, (camera.width * 0.55) / (width + 120), (camera.height * 0.7) / (height + 120))
        )
        camera.centerOn(x + width / 2 - 70 / camera.zoom, y + height / 2)
      }
    }
    if (!suspended && !m.paused && !this.reduced.matches) this.clock += Math.min(delta, 50) / 1000
    this.waves.clear()
    this.guides.clear()
    for (const line of m.lines) {
      const points = this.prepared.get(line.id) ?? []
      if (
        !points.some(
          p =>
            camera.worldView.contains(p.x, p.y) ||
            camera.worldView.contains(
              p.x + p.nx * line.width * line.side,
              p.y + p.ny * line.width * line.side
            )
        )
      )
        continue
      for (let band = 0; band < 3; band++) {
        const phase = (this.clock / line.period + band / 3) % 1
        const offset = (1 - phase) * line.width
        this.waves.fillStyle(0xd5f8f3, Math.pow(Math.sin(Math.PI * phase), 1.15) * line.strength)
        // Filled ribbons give each broken crest a full belly and pointed, curling tips.
        // A constant-width stroke would leave blunt ends at every gap.
        let fragment: typeof points = []
        const paintFragment = () => {
          if (fragment.length < 3) {
            fragment = []
            return
          }
          const start = fragment[0].distance
          const length = fragment[fragment.length - 1].distance - start
          if (length < 4) {
            fragment = []
            return
          }
          const outer: Phaser.Geom.Point[] = [],
            inner: Phaser.Geom.Point[] = []
          for (const p of fragment) {
            const u = (p.distance - start) / length
            const belly = Math.pow(Math.sin(Math.PI * u), 0.85)
            const thickness = Math.min(3.6, length * 0.12) * belly
            const tips = Math.pow(Math.abs(2 * u - 1), 3)
            const curl = tips * Math.min(2.5, length * 0.08)
            const distance =
              offset + curl + Math.sin(p.distance * 0.065 + Math.PI * 2 * phase + band) * 0.65
            // Keep the shore-facing edge inside the selected water strip.
            const near = Math.max(0, distance - thickness * 0.35)
            const far = distance + thickness * 0.65
            outer.push(
              new Phaser.Geom.Point(p.x + p.nx * far * line.side, p.y + p.ny * far * line.side)
            )
            inner.push(
              new Phaser.Geom.Point(p.x + p.nx * near * line.side, p.y + p.ny * near * line.side)
            )
          }
          this.waves.fillPoints([...outer, ...inner.reverse()], true)
          fragment = []
        }
        for (const p of points) {
          if (
            Math.sin(p.distance * 0.075 + band * 2.4) + 0.4 * Math.sin(p.distance * 0.21 + band) <
            -0.55
          ) {
            paintFragment()
          } else {
            fragment.push(p)
          }
        }
        paintFragment()
      }
      if ((m.editing && m.guides) || diagnostic) {
        const selected = m.selected === line.id
        this.guides.lineStyle(1 / camera.zoom, selected ? 0xffd36a : 0xffffff, 0.85)
        this.guides.strokePoints(
          points.map(p => new Phaser.Geom.Point(p.x, p.y)),
          line.closed
        )
        if (selected || diagnostic) {
          this.guides.lineStyle(1 / camera.zoom, 0x47eee3, 0.7)
          this.guides.strokePoints(
            points.map(
              p =>
                new Phaser.Geom.Point(
                  p.x + p.nx * line.width * line.side,
                  p.y + p.ny * line.width * line.side
                )
            ),
            line.closed
          )
          if (m.editing)
            for (const [x, y] of line.points)
              this.guides.fillStyle(0xffd36a).fillCircle(x, y, 4 / camera.zoom)
        }
      }
    }
    if (this.drawing.length > 1)
      this.guides
        .lineStyle(2 / camera.zoom, 0xffd36a)
        .strokePoints(this.drawing.map(([x, y]) => new Phaser.Geom.Point(x, y)))
  }
}
