import { expect, it } from 'vitest'
import type Phaser from 'phaser'
import { AmbientDiagnostics } from './ambient-diagnostics'
import { makeDiagnosticFilters } from './diagnostic-filters'
import type { AmbientRegion } from './world-ambience'

it('handles offscreen holes and removes stale labels after a zone or filter change', () => {
  const graphics: Record<string, (...args: unknown[]) => unknown> = {}
  for (const key of [
    'setDepth',
    'setVisible',
    'clear',
    'fillStyle',
    'fillRect',
    'lineStyle',
    'strokeRect',
  ])
    graphics[key] = () => graphics
  const texts: { visible: boolean; setVisible: (v: boolean) => unknown; [key: string]: unknown }[] =
    []
  const scene = {
    add: {
      graphics: () => graphics,
      text: () => {
        const text = {
          visible: true,
          setVisible(v: boolean) {
            this.visible = v
            return this
          },
        } as (typeof texts)[number]
        for (const key of ['setDepth', 'setPosition', 'setText', 'setScale']) text[key] = () => text
        texts.push(text)
        return text
      },
    },
  }
  let regions: AmbientRegion[] = [
    { kind: 'light', x: 5000, y: 5000, width: 40, height: 40 },
    { kind: 'particles', x: 20, y: 20, width: 40, height: 40 },
  ]
  const diagnostics = new AmbientDiagnostics(scene as unknown as Phaser.Scene, () => regions)
  const camera = {
    width: 100,
    height: 100,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
  } as Phaser.Cameras.Scene2D.Camera
  const filters = makeDiagnosticFilters(false)
  filters.particles = true
  diagnostics.update(camera, true, 'fr', filters)
  expect(texts.some(t => t.visible)).toBe(true)
  expect(() => diagnostics.update(camera, true, 'fr', filters)).not.toThrow()
  filters.particles = false
  diagnostics.update(camera, true, 'fr', filters)
  expect(texts.every(t => !t.visible)).toBe(true)
  filters.particles = true
  diagnostics.update(camera, true, 'fr', filters)
  regions = []
  diagnostics.update(camera, true, 'fr', filters)
  expect(texts.every(t => !t.visible)).toBe(true)
  expect(() => diagnostics.update(camera, false, 'fr', filters)).not.toThrow()
})
