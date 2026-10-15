import Phaser from 'phaser'
import type { Point } from '../world'
import { pioneerObjects, stations } from './valence-story'
import {
  objectSpots,
  stationAnchors,
  stationLabels,
  STATION_RADIUS,
  threadOrder,
  threadPaths,
  PORTAL_RADIUS,
  VALENCE_SPAWN,
  valencePortal,
} from './valence-world'
import type { Handle, WorkshopModel } from './workshop-model'

const COLORS = {
  spawn: 0x2fae5c,
  portal: 0x8b5e30,
  station: 0x2f6bff,
  label: 0xff9a2f,
  object: 0xc23ad1,
  thread: 0xffd36a,
  river: 0x3ad7e8,
  exclusion: 0xff4060,
  smoke: 0x8a8a8a,
}

function nearestOnSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

/** Handles, lines and outlines of the landmarks and water modes, drawn over the map. */
export class WorkshopOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics
  private readonly names: Phaser.GameObjects.Text[] = []
  private drag: Handle | null = null
  private pan: { x: number; y: number; scrollX: number; scrollY: number } | null = null
  private pointer: number | null = null
  private lastDown = { time: 0, x: 0, y: 0 }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly model: WorkshopModel,
    private readonly resolution: number
  ) {
    this.graphics = scene.add.graphics().setDepth(3200)
    const labels = [
      ...stations.map(s => `${s.order}. ${s.place.fr}`),
      ...pioneerObjects.map(o => o.name.fr),
      'Arrivée',
    ]
    for (const text of labels)
      this.names.push(
        scene.add
          .text(0, 0, text, {
            fontFamily: 'Pulp, sans-serif',
            fontSize: '12px',
            color: '#ffffff',
            backgroundColor: 'rgba(20, 12, 6, 0.72)',
            padding: { x: 4, y: 2 },
          })
          .setResolution(resolution)
          .setDepth(3201)
          .setVisible(false)
      )
    scene.input
      .on('pointerdown', this.down)
      .on('pointermove', this.move)
      .on('pointerup', this.up)
      .on('pointerupoutside', this.up)
      .on('wheel', this.wheel)
    window.addEventListener('keydown', this.key)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input
        .off('pointerdown', this.down)
        .off('pointermove', this.move)
        .off('pointerup', this.up)
        .off('pointerupoutside', this.up)
        .off('wheel', this.wheel)
      window.removeEventListener('keydown', this.key)
    })
  }

  get active() {
    return this.model.mode === 'landmarks' || this.model.mode === 'water'
  }

  private world(p: Phaser.Input.Pointer): Point {
    const q = this.scene.cameras.main.getWorldPoint(p.x, p.y)
    return { x: q.x, y: q.y }
  }

  private handles(): [Handle, Point][] {
    if (this.model.mode === 'landmarks')
      return [
        [{ kind: 'spawn' }, VALENCE_SPAWN],
        [{ kind: 'portal' }, valencePortal.ground],
        [{ kind: 'portalLabel' }, valencePortal.label],
        ...threadOrder.map((id): [Handle, Point] => [{ kind: 'station', id }, stationAnchors[id]]),
        ...threadOrder.map((id): [Handle, Point] => [{ kind: 'label', id }, stationLabels[id]]),
        ...pioneerObjects.map((o): [Handle, Point] => [{ kind: 'object', id: o.id }, objectSpots[o.id]]),
        ...threadPaths.flatMap((line, segment) =>
          line.slice(1, -1).map((point, index): [Handle, Point] => [{ kind: 'thread', segment, index: index + 1 }, point])
        ),
      ]
    const { river, exclusions, smoke } = this.model.effects.effects
    return [
      ...river.map(([x, y], index): [Handle, Point] => [{ kind: 'river', index }, { x, y }]),
      ...exclusions.flatMap((zone, z) =>
        zone.map(([x, y], index): [Handle, Point] => [{ kind: 'exclusion', zone: z, index }, { x, y }])
      ),
      ...smoke.map(({ x, y }, index): [Handle, Point] => [{ kind: 'smoke', index }, { x, y }]),
    ]
  }

  private hit(point: Point) {
    let best: Handle | null = null
    let distance = 11 / this.scene.cameras.main.zoom
    for (const [handle, at] of this.handles()) {
      const d = Math.hypot(at.x - point.x, at.y - point.y)
      if (d < distance) {
        best = handle
        distance = d
      }
    }
    return best
  }

  private place(handle: Handle, point: Point) {
    const p = { x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 }
    const effects = this.model.effects.effects
    if (handle.kind === 'spawn') Object.assign(VALENCE_SPAWN, p)
    else if (handle.kind === 'portal') Object.assign(valencePortal.ground, p)
    else if (handle.kind === 'portalLabel') Object.assign(valencePortal.label, p)
    else if (handle.kind === 'station') this.model.moveStation(handle.id, p)
    else if (handle.kind === 'label') stationLabels[handle.id] = p
    else if (handle.kind === 'object') objectSpots[handle.id] = p
    else if (handle.kind === 'thread') threadPaths[handle.segment][handle.index] = p
    else if (handle.kind === 'river') effects.river[handle.index] = [p.x, p.y]
    else if (handle.kind === 'exclusion') effects.exclusions[handle.zone][handle.index] = [p.x, p.y]
    else if (handle.kind === 'smoke') Object.assign(effects.smoke[handle.index], p)
  }

  private document(handle: Handle) {
    return ['river', 'exclusion', 'smoke'].includes(handle.kind) ? 'effects' : 'layout'
  }

  /** Double click on a line inserts a vertex there. */
  private insert(point: Point) {
    const tolerance = 8 / this.scene.cameras.main.zoom
    if (this.model.mode === 'landmarks') {
      threadPaths.forEach((line, segment) => {
        for (let i = 0; i < line.length - 1; i++) {
          const q = nearestOnSegment(point, line[i], line[i + 1])
          if (Math.hypot(q.x - point.x, q.y - point.y) > tolerance) continue
          this.model.checkpoint('layout')
          line.splice(i + 1, 0, q)
          this.model.selected = { kind: 'thread', segment, index: i + 1 }
          this.model.segment = segment
          this.model.commit('layout')
          return
        }
      })
      return
    }
    const effects = this.model.effects.effects
    const rings: [number, [number, number][]][] = [[-1, effects.river], ...effects.exclusions.map((z, i): [number, [number, number][]] => [i, z])]
    for (const [zone, ring] of rings)
      for (let i = 0; i < ring.length; i++) {
        const a = { x: ring[i][0], y: ring[i][1] }
        const b = { x: ring[(i + 1) % ring.length][0], y: ring[(i + 1) % ring.length][1] }
        const q = nearestOnSegment(point, a, b)
        if (Math.hypot(q.x - point.x, q.y - point.y) > tolerance) continue
        this.model.checkpoint('effects')
        ring.splice(i + 1, 0, [Math.round(q.x), Math.round(q.y)])
        this.model.selected = zone < 0 ? { kind: 'river', index: i + 1 } : { kind: 'exclusion', zone, index: i + 1 }
        this.model.commit('effects')
        return
      }
  }

  private down = (p: Phaser.Input.Pointer) => {
    if (!this.active || this.pointer !== null) return
    const point = this.world(p)
    const drawing = this.model.drawing
    if (drawing) {
      if (drawing.kind === 'smoke') {
        this.model.checkpoint('effects')
        this.model.effects.effects.smoke.push({ x: Math.round(point.x), y: Math.round(point.y), rate: 1400, size: 0.7 })
        this.model.drawing = null
        this.model.selected = { kind: 'smoke', index: this.model.effects.effects.smoke.length - 1 }
        this.model.commit('effects')
      } else drawing.points.push(point)
      this.model.notify()
      return
    }
    const now = performance.now()
    const double = now - this.lastDown.time < 320 && Math.hypot(p.x - this.lastDown.x, p.y - this.lastDown.y) < 8
    this.lastDown = { time: now, x: p.x, y: p.y }
    const handle = this.hit(point)
    this.pointer = p.id
    if (handle) {
      this.model.checkpoint(this.document(handle))
      this.drag = handle
      this.model.selected = handle
      if (handle.kind === 'thread') this.model.segment = handle.segment
      this.model.notify()
      return
    }
    if (double) {
      this.pointer = null
      this.insert(point)
      return
    }
    const camera = this.scene.cameras.main
    this.pan = { x: p.x, y: p.y, scrollX: camera.scrollX, scrollY: camera.scrollY }
  }

  private move = (p: Phaser.Input.Pointer) => {
    if (!this.active || p.id !== this.pointer) return
    if (this.drag) {
      this.place(this.drag, this.world(p))
      if (this.document(this.drag) === 'layout') this.model.layoutRevision++
      else this.model.effects.revision++
      return
    }
    if (this.pan) {
      const camera = this.scene.cameras.main
      camera.scrollX = this.pan.scrollX - (p.x - this.pan.x) / camera.zoom
      camera.scrollY = this.pan.scrollY - (p.y - this.pan.y) / camera.zoom
    }
  }

  private up = (p: Phaser.Input.Pointer) => {
    if (p.id !== this.pointer) return
    if (this.drag) this.model.commit(this.document(this.drag))
    this.drag = null
    this.pan = null
    this.pointer = null
  }

  private wheel = (p: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
    if (!this.active) return
    const camera = this.scene.cameras.main
    const before = camera.getWorldPoint(p.x, p.y)
    camera.setZoom(Phaser.Math.Clamp(camera.zoom * Math.exp(-dy * 0.0015), 0.3, 10))
    const after = camera.getWorldPoint(p.x, p.y)
    camera.scrollX += before.x - after.x
    camera.scrollY += before.y - after.y
  }

  private key = (event: KeyboardEvent) => {
    if (!this.active) return
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
    if (event.key === 'Escape' && this.model.drawing) {
      this.model.drawing = null
      this.model.notify()
      return
    }
    if (event.key === 'Enter' && this.model.drawing) {
      this.model.finishDrawing()
      return
    }
    if (event.key !== 'Delete' && event.key !== 'Backspace') return
    const selected = this.model.selected
    if (!selected) return
    const effects = this.model.effects.effects
    if (selected.kind === 'thread' && threadPaths[selected.segment].length > 2) {
      this.model.checkpoint('layout')
      threadPaths[selected.segment].splice(selected.index, 1)
      this.model.selected = null
      this.model.commit('layout')
    } else if (selected.kind === 'river' && effects.river.length > 3) {
      this.model.checkpoint('effects')
      effects.river.splice(selected.index, 1)
      this.model.selected = null
      this.model.commit('effects')
    } else if (selected.kind === 'exclusion') {
      this.model.checkpoint('effects')
      const zone = effects.exclusions[selected.zone]
      if (zone.length > 3) zone.splice(selected.index, 1)
      else effects.exclusions.splice(selected.zone, 1)
      this.model.selected = null
      this.model.commit('effects')
    } else if (selected.kind === 'smoke') {
      this.model.checkpoint('effects')
      effects.smoke.splice(selected.index, 1)
      this.model.selected = null
      this.model.commit('effects')
    } else return
    event.preventDefault()
  }

  update() {
    if (this.model.focus) {
      this.scene.cameras.main.centerOn(this.model.focus.x, this.model.focus.y)
      this.model.focus = null
    }
    const g = this.graphics.clear()
    const shown = this.active
    for (const name of this.names) name.setVisible(false)
    if (!shown) return
    const zoom = this.scene.cameras.main.zoom
    const unit = 1 / zoom
    const scale = this.resolution / zoom
    const selected = this.model.selected
    const isSelected = (handle: Handle) => JSON.stringify(handle) === JSON.stringify(selected)
    const dot = (point: Point, color: number, handle: Handle, radius = 6) => {
      const chosen = isSelected(handle)
      g.fillStyle(0x000000, 0.45).fillCircle(point.x, point.y, (radius + 2) * unit)
      g.fillStyle(chosen ? 0xffffff : color, 1).fillCircle(point.x, point.y, radius * unit)
      if (chosen) g.lineStyle(2 * unit, color, 1).strokeCircle(point.x, point.y, (radius + 4) * unit)
    }
    const name = (index: number, point: Point) =>
      this.names[index].setVisible(true).setPosition(point.x + 9 * unit, point.y - 8 * unit).setScale(scale)

    if (this.model.mode === 'landmarks') {
      threadPaths.forEach((line, segment) => {
        const current = segment === this.model.segment
        g.lineStyle((current ? 3 : 1.5) * unit, COLORS.thread, current ? 1 : 0.55)
        g.strokePoints(line.map(p => new Phaser.Geom.Point(p.x, p.y)), false)
        line.slice(1, -1).forEach((point, index) =>
          dot(point, COLORS.thread, { kind: 'thread', segment, index: index + 1 }, current ? 4.5 : 3)
        )
      })
      threadOrder.forEach((id, index) => {
        const anchor = stationAnchors[id]
        g.lineStyle(1 * unit, COLORS.station, 0.6).strokeCircle(anchor.x, anchor.y, STATION_RADIUS)
        g.lineStyle(1 * unit, COLORS.label, 0.7).lineBetween(anchor.x, anchor.y, stationLabels[id].x, stationLabels[id].y)
        dot(anchor, COLORS.station, { kind: 'station', id })
        dot(stationLabels[id], COLORS.label, { kind: 'label', id }, 5)
        name(index, stationLabels[id])
      })
      pioneerObjects.forEach((object, index) => {
        dot(objectSpots[object.id], COLORS.object, { kind: 'object', id: object.id }, 5)
        name(stations.length + index, objectSpots[object.id])
      })
      // The train to the archipelago: travellers leave within the circle and arrive at its centre.
      const { ground, label } = valencePortal
      g.lineStyle(1 * unit, COLORS.portal, 0.7).strokeCircle(ground.x, ground.y, PORTAL_RADIUS)
      g.lineStyle(1 * unit, COLORS.portal, 0.7).lineBetween(ground.x, ground.y, label.x, label.y)
      dot(ground, COLORS.portal, { kind: 'portal' }, 7)
      dot(label, COLORS.portal, { kind: 'portalLabel' }, 5)
      dot(VALENCE_SPAWN, COLORS.spawn, { kind: 'spawn' }, 7)
      name(this.names.length - 1, VALENCE_SPAWN)
    } else {
      const { river, exclusions, smoke } = this.model.effects.effects
      const ring = (points: [number, number][], color: number, fill: number) => {
        const shape = points.map(([x, y]) => new Phaser.Geom.Point(x, y))
        g.fillStyle(color, fill).fillPoints(shape, true)
        g.lineStyle(2 * unit, color, 0.95).strokePoints(shape, true)
      }
      ring(river, COLORS.river, 0.12)
      river.forEach(([x, y], index) => dot({ x, y }, COLORS.river, { kind: 'river', index }, 4.5))
      exclusions.forEach((zone, z) => {
        ring(zone, COLORS.exclusion, 0.2)
        zone.forEach(([x, y], index) => dot({ x, y }, COLORS.exclusion, { kind: 'exclusion', zone: z, index }, 4))
      })
      smoke.forEach(({ x, y }, index) => {
        g.lineStyle(1 * unit, COLORS.smoke, 0.8).strokeCircle(x, y, 14 * unit)
        dot({ x, y }, COLORS.smoke, { kind: 'smoke', index }, 5)
      })
    }
    const drawing = this.model.drawing
    if (drawing && drawing.kind !== 'smoke') {
      const start =
        drawing.kind === 'thread' ? [stationAnchors[threadOrder[drawing.segment]]] : []
      const points = [...start, ...drawing.points]
      g.lineStyle(2.5 * unit, 0xffffff, 1)
      if (points.length > 1) g.strokePoints(points.map(p => new Phaser.Geom.Point(p.x, p.y)), drawing.kind === 'exclusion')
      for (const point of points) g.fillStyle(0xffffff, 1).fillCircle(point.x, point.y, 4 * unit)
    }
  }
}
