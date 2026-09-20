import { afterEach, describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { createAmbientEditor, newAmbientZone, type AmbientEditorModel } from './ambient-zones'
import { WorldAmbience } from './world-ambience'

function setup(model?: AmbientEditorModel) {
  const media = { matches: false }
  vi.stubGlobal('window', { matchMedia: () => media })
  const graphics: { visible: boolean; calls: unknown[][]; [key: string]: unknown }[] = []
  const scene = {
    add: {
      graphics: () => {
        const g = { visible: true, calls: [] as unknown[][] } as (typeof graphics)[number]
        for (const method of [
          'setDepth',
          'setAlpha',
          'setBlendMode',
          'scaleCanvas',
          'destroy',
          'save',
          'restore',
          'translateCanvas',
          'rotateCanvas',
          'fillStyle',
          'fillCircle',
          'fillEllipse',
          'fillTriangle',
          'lineStyle',
          'strokeEllipse',
          'lineBetween',
        ]) {
          g[method] = (...args: unknown[]) => {
            g.calls.push([method, ...args])
            return g
          }
        }
        g.setVisible = (value: boolean) => {
          g.visible = value
          return g
        }
        g.clear = () => {
          g.calls = []
          return g
        }
        graphics.push(g)
        return g
      },
    },
  }
  const ambience = new WorldAmbience(scene as unknown as Phaser.Scene, model)
  const camera = {
    width: 1671,
    height: 941,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
  } as Phaser.Cameras.Scene2D.Camera
  return { ambience, camera, graphics, media }
}

afterEach(() => vi.unstubAllGlobals())
describe('ambient animation lifecycle', () => {
  it('rebuilds live effects and diagnostics after editing a zone', () => {
    const model = createAmbientEditor()
    const zone = newAmbientZone('butterfly', { x: 200, y: 300, width: 100, height: 80 })
    model.zones = [{ ...zone, count: 2 }]
    model.selected = zone.id
    const { ambience, camera, graphics } = setup(model)
    expect(graphics).toHaveLength(2)
    model.change({ count: 4, size: 2, intensity: 0.3, x: 400 })
    ambience.update(camera, 16, { x: 0, y: 0 }, false)
    expect(graphics).toHaveLength(6)
    expect(graphics[0].calls).toContainEqual(['destroy'])
    expect(graphics[2].calls).toContainEqual(['scaleCanvas', 2, 2])
    expect(ambience.diagnosticRegions[0]).toMatchObject({ x: 400, width: 100 })
    model.change({ enabled: false })
    ambience.update(camera, 16, { x: 0, y: 0 }, false)
    expect(ambience.diagnosticRegions).toEqual([])
  })
  it('renders glows as additive feathered light across the edited bounds', () => {
    const model = createAmbientEditor()
    const zone = newAmbientZone('light', { x: 100, y: 100, width: 120, height: 80 })
    model.zones = [{ ...zone, intensity: 0.8, color: '#ffcc88' }]
    const { ambience, camera, graphics } = setup(model)
    expect(graphics[0].calls).toContainEqual(['setBlendMode', 'ADD'])
    expect(graphics[0].calls).toContainEqual(['setAlpha', 0.8])
    ambience.update(camera, 16, { x: 0, y: 0 }, false)
    const ellipses = graphics[0].calls.filter(c => c[0] === 'fillEllipse')
    expect(ellipses).toHaveLength(24)
    expect(Number(ellipses[0][3])).toBeGreaterThan(110)
    expect(Number(ellipses[0][4])).toBeGreaterThan(73)
    const alphas = graphics[0].calls.filter(c => c[0] === 'fillStyle').map(c => Number(c[2]))
    expect(alphas[0]).toBe(0)
    expect(alphas.at(-1)).toBeGreaterThan(0.045)
    expect(graphics[0].calls.filter(c => c[0] === 'fillStyle').every(c => c[1] === 0xffcc88)).toBe(
      true
    )
  })
  it('adds optional particle light without changing base opacity and culls both layers', () => {
    const model = createAmbientEditor()
    const zone = newAmbientZone('particles', { x: 100, y: 100, width: 100, height: 100 })
    model.zones = [{ ...zone, glow: 1, intensity: 0.4 }]
    model.selected = zone.id
    const { ambience, camera, graphics, media } = setup(model)
    expect(graphics).toHaveLength(2)
    expect(graphics[0].calls).toContainEqual(['setAlpha', 0.4])
    expect(graphics[0].calls.some(c => c[0] === 'setBlendMode')).toBe(false)
    expect(graphics[1].calls).toContainEqual(['setBlendMode', 'ADD'])
    ambience.update(camera, 50, { x: 0, y: 0 }, false)
    expect(graphics[1].calls.some(c => c[0] === 'fillCircle')).toBe(true)
    camera.scrollX = 5000
    ambience.update(camera, 16, { x: 0, y: 0 }, false)
    expect(graphics.every(g => !g.visible)).toBe(true)
    camera.scrollX = 0
    media.matches = true
    ambience.update(camera, 16, { x: 0, y: 0 }, true)
    expect(graphics.every(g => !g.visible)).toBe(true)
    model.change({ glow: 0 })
    media.matches = false
    ambience.update(camera, 16, { x: 0, y: 0 }, false)
    expect(graphics[1].calls).toContainEqual(['destroy'])
    expect(graphics).toHaveLength(3)
  })
  it.each(['round', 'leaf', 'petal', 'sparkle'] as const)(
    'illuminates the %s body and core while keeping the halo hue',
    style => {
      const model = createAmbientEditor()
      const zone = newAmbientZone('particles', { x: 100, y: 100, width: 100, height: 100 })
      const color = 0xcc3377
      model.zones = [{ ...zone, count: 1, style, color: '#cc3377', glow: 1, intensity: 0.5 }]
      model.selected = zone.id
      const { ambience, camera, graphics } = setup(model)
      ambience.update(camera, 50, { x: 0, y: 0 }, false)
      const colors = graphics[0].calls.filter(c => c[0] === 'fillStyle').map(c => Number(c[1]))
      expect(colors).toHaveLength(2)
      for (const shift of [0, 8, 16]) {
        expect((colors[0] >> shift) & 255).toBeGreaterThan((color >> shift) & 255)
        expect((colors[1] >> shift) & 255).toBeGreaterThan((colors[0] >> shift) & 255)
      }
      expect(graphics[1].calls.filter(c => c[0] === 'fillStyle').every(c => c[1] === color)).toBe(
        true
      )
      model.change({ glow: 0 })
      ambience.update(camera, 16, { x: 0, y: 0 }, false)
      const restored = graphics.at(-1)!.calls.filter(c => c[0] === 'fillStyle')
      expect(restored).toHaveLength(1)
      expect(restored[0][1]).toBe(color)
    }
  )
  it('freezes drawing during pause and resumes without a large time jump', () => {
    const { ambience, camera, graphics } = setup()
    ambience.update(camera, 16, { x: 836, y: 542 }, false)
    const before = JSON.stringify(graphics)
    ambience.update(camera, 60000, { x: 836, y: 542 }, true)
    expect(JSON.stringify(graphics)).toBe(before)
    ambience.update(camera, 16, { x: 836, y: 542 }, false)
    expect(JSON.stringify(graphics)).not.toBe(before)
  })
  it('hides ambient motion when reduced motion is enabled dynamically', () => {
    const { ambience, camera, graphics, media } = setup()
    ambience.update(camera, 16, { x: 836, y: 542 }, false)
    expect(graphics.some(g => g.visible)).toBe(true)
    media.matches = true
    ambience.update(camera, 16, { x: 836, y: 542 }, false)
    expect(graphics.every(g => !g.visible)).toBe(true)
  })
  it('culls offscreen effects and produces finite geometry over a full event cycle', () => {
    const { ambience, camera, graphics } = setup()
    for (let i = 0; i < 1200; i++) ambience.update(camera, 50, { x: 182, y: 538 }, false)
    for (const g of graphics)
      for (const args of g.calls)
        for (const value of args) {
          if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true)
        }
    camera.scrollX = 5000
    ambience.update(camera, 16, { x: 836, y: 542 }, false)
    expect(graphics.every(g => !g.visible)).toBe(true)
  })
  it('keeps the denser flower and leaf drift round, small and bounded', () => {
    const { ambience, camera, graphics } = setup()
    const driftColors = new Set([0xffb6b1, 0xc1a0ff, 0xd6b7ff, 0xa7c972, 0x8ebdff, 0xa7cfff])
    const seenColors = new Set<number>()
    let peak = 0
    for (let tick = 0; tick < 1000; tick++) {
      ambience.update(camera, 50, { x: 836, y: 542 }, false)
      let count = 0
      for (const g of graphics) {
        let isDrift = false
        for (const [method, ...args] of g.calls) {
          if (method === 'fillStyle') {
            isDrift = driftColors.has(Number(args[0]))
            if (isDrift) seenColors.add(Number(args[0]))
          } else if (isDrift && String(method).startsWith('fill')) {
            expect(method).toBe('fillCircle')
            expect(Number(args[2])).toBeGreaterThanOrEqual(1)
            expect(Number(args[2])).toBeLessThanOrEqual(1.7)
            count++
          }
        }
      }
      peak = Math.max(peak, count)
      expect(count).toBeLessThan(55)
    }
    expect(seenColors).toEqual(driftColors)
    expect(peak).toBeGreaterThan(20)
    const before = JSON.stringify(graphics.map(g => g.calls))
    camera.scrollX = 5000
    ambience.update(camera, 50, { x: 836, y: 542 }, false)
    expect(JSON.stringify(graphics.map(g => g.calls))).toBe(before)
    expect(graphics.every(g => !g.visible)).toBe(true)
  })
  it('honors reduced motion even while the world is paused', () => {
    const { ambience, camera, graphics, media } = setup()
    ambience.update(camera, 16, { x: 836, y: 542 }, false)
    media.matches = true
    ambience.update(camera, 16, { x: 836, y: 542 }, true)
    expect(graphics.every(g => !g.visible)).toBe(true)
    media.matches = false
    ambience.update(camera, 16, { x: 836, y: 542 }, true)
    expect(graphics.every(g => !g.visible)).toBe(true)
    ambience.update(camera, 16, { x: 836, y: 542 }, false)
    expect(graphics.some(g => g.visible)).toBe(true)
  })
})
