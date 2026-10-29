import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  BIBLICAL_MAP_HOLY_LAND,
  BIBLICAL_MAP_WIDTH,
  biblicalMapBounds,
  clampBiblicalMapView,
  fitBiblicalMapView,
  placeBiblicalMapLabels,
  projectBiblicalPlace,
  type BiblicalMapPlace,
} from './biblicalMap'

describe('biblical map', () => {
  it('places Jerusalem in the Promised Land and leaves out what it cannot draw', () => {
    const [x, y] = projectBiblicalPlace(31.78, 35.23) ?? [0, 0]
    assert.ok(
      x > BIBLICAL_MAP_HOLY_LAND.x && x < BIBLICAL_MAP_HOLY_LAND.x + BIBLICAL_MAP_HOLY_LAND.width
    )
    assert.ok(
      y > BIBLICAL_MAP_HOLY_LAND.y && y < BIBLICAL_MAP_HOLY_LAND.y + BIBLICAL_MAP_HOLY_LAND.height
    )
    assert.equal(projectBiblicalPlace(22, 77), undefined)
    // The publication writes a latitude of 0 for a place it cannot locate.
    assert.equal(projectBiblicalPlace(0, 14), undefined)
    assert.equal(BIBLICAL_MAP_WIDTH, 3901)
  })

  it('frames a region at the aspect of its window and keeps it inside the map', () => {
    const tall = fitBiblicalMapView({ x: 0, y: 0, width: 100, height: 100 }, 2)
    assert.equal(tall.width, 100)
    assert.equal(tall.height, 200)
    const far = clampBiblicalMapView({ x: -5000, y: 0, width: 10, height: 6 }, 0.6)
    assert.equal(far.width, 90)
    assert.ok(far.x > -90)
  })

  it('keeps a single place in its surroundings', () => {
    const bounds = biblicalMapBounds([{ x: 100, y: 100 }], 200)
    assert.deepEqual(bounds && Math.round(bounds.width), 260)
    assert.equal(biblicalMapBounds([]), undefined)
  })

  it('names the place in focus first and leaves out a name that would cover another', () => {
    const places: BiblicalMapPlace[] = [
      { uniqueName: 'a', name: 'Jérusalem', x: 100, y: 100, chapterCount: 300 },
      { uniqueName: 'b', name: 'Morija', x: 101, y: 100, chapterCount: 2 },
      { uniqueName: 'c', name: 'Bethléem', x: 400, y: 400, chapterCount: 10 },
    ]
    const named = placeBiblicalMapLabels({
      places,
      unit: 1,
      focus: 'b',
      thumbRadius: () => undefined,
    })
    assert.deepEqual([...named].sort(), ['b', 'c'])
  })
})
