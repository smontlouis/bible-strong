import { describe, expect, it } from 'vitest'
import {
  buildTimelineBands,
  estimateTimelinePillWidth,
  placeTimelineEvents,
  TIMELINE_CARD_HEIGHT,
  TIMELINE_CARD_WIDTH,
  TIMELINE_PILL_HEIGHT,
  timelineBandAt,
  timelinePeriodExtents,
  timelinePeriodScales,
  timelineTicks,
  timelineWidth,
  timelineXToYear,
  timelineYearToX,
  type TimelinePlacementInput,
} from './timelineGeometry'
import { LAYOUT_CARD, LAYOUT_FIXED_WIDTH, TIMELINE_LAYOUT } from './timelineLayout'
import { TIMELINE_BANDS } from './timelinePeriods'

const scales = [
  ...timelinePeriodScales({ id: 'a', startYear: -200, endYear: 0, yearsPerTick: 100 }),
  ...timelinePeriodScales({
    id: 'b',
    startYear: 0,
    endYear: 20,
    yearsPerTick: 1,
    detail: { startYear: 10, endYear: 12, yearsPerTick: 0.2 },
  }),
]
const bands = buildTimelineBands(scales)

describe('timeline axis', () => {
  it('starts the axis where the drawing says', () => {
    expect(buildTimelineBands(scales, 600)[0]).toMatchObject({ left: 600, width: 200 })
  })

  it('lays scales end to end, a detailed stretch splitting its period in three', () => {
    expect(bands.map(({ id, left, width }) => [id, left, width])).toEqual([
      ['a', 0, 200],
      ['b', 200, 1000],
      ['b', 1200, 1000],
      ['b', 2200, 800],
    ])
    expect(timelineWidth(bands)).toBe(3000)
    expect(timelinePeriodExtents(bands)).toEqual([
      { id: 'a', left: 0, width: 200 },
      { id: 'b', left: 200, width: 2800 },
    ])
  })

  it('maps a year to its position and back', () => {
    expect(timelineYearToX(bands, -100)).toBe(100)
    expect(timelineYearToX(bands, 5)).toBe(700)
    expect(timelineYearToX(bands, 11)).toBe(1700)
    expect(timelineXToYear(bands, 100)).toBe(-100)
    expect(timelineXToYear(bands, 1699)).toBe(10)
    expect(timelineXToYear(bands, 1700)).toBe(11)
  })

  it('keeps a year outside the timeline at its nearest end', () => {
    expect(timelineYearToX(bands, -5000)).toBe(0)
    expect(timelineYearToX(bands, 3000)).toBe(3000)
    expect(timelineXToYear(bands, 99_999)).toBe(20)
  })

  it('finds the band of a position and names the year of a tick only at its start', () => {
    expect(timelineBandAt(bands, 150)?.id).toBe('a')
    expect(timelineBandAt(bands, 200)?.id).toBe('b')
    expect(timelineTicks(bands[0]!)).toEqual([
      { left: 0, year: -200 },
      { left: 100, year: -100 },
    ])
    expect(timelineTicks(bands[2]!).slice(0, 5)).toEqual([
      { left: 1200, year: 10 },
      { left: 1300 },
      { left: 1400 },
      { left: 1500 },
      { left: 1600 },
    ])
    expect(timelineTicks(bands[2]!)[5]).toEqual({ left: 1700, year: 11 })
  })
})

const overlapping = (
  boxes: { left: number; top: number; width: number; height: number }[]
): number => {
  let count = 0
  for (let first = 0; first < boxes.length; first += 1) {
    for (let second = first + 1; second < boxes.length; second += 1) {
      const a = boxes[first]!
      const b = boxes[second]!
      const sideBySide = a.left + a.width <= b.left || b.left + b.width <= a.left
      const stacked = a.top + a.height <= b.top || b.top + b.height <= a.top
      if (!sideBySide && !stacked) count += 1
    }
  }
  return count
}

describe('placeTimelineEvents', () => {
  it('fills the lowest lane first and rises only where events meet', () => {
    const { placements } = placeTimelineEvents(bands, [
      { key: 'first', startYear: 1, endYear: 1, card: false, pillWidth: 150 },
      { key: 'second', startYear: 2, endYear: 2, card: false, pillWidth: 150 },
      { key: 'later', startYear: 8, endYear: 8, card: false, pillWidth: 150 },
    ])
    const top = (key: string) => placements.get(key)?.top ?? 0
    expect(top('second')).toBeLessThan(top('first'))
    // The lane of the first event is free again further on.
    expect(top('later')).toBe(top('first'))
  })

  it('leaves out an event the axis cannot place', () => {
    const { placements } = placeTimelineEvents(bands, [
      { key: 'undated', startYear: Number.NaN, endYear: Number.NaN, card: false },
      { key: 'dated', startYear: 1, endYear: 1, card: false },
    ])
    expect([...placements.keys()]).toEqual(['dated'])
  })

  it('draws a card over the years it lasts, unless its width is fixed', () => {
    const { placements } = placeTimelineEvents(bands, [
      { key: 'life', startYear: 2, endYear: 8, card: true },
      { key: 'day', startYear: 14, endYear: 18, card: true, fixedWidth: true },
      { key: 'short', startYear: -150, endYear: -140, card: true },
    ])
    expect(placements.get('life')).toMatchObject({ left: 400, width: 600 })
    expect(placements.get('day')?.width).toBe(TIMELINE_CARD_WIDTH)
    expect(placements.get('short')?.width).toBe(TIMELINE_CARD_WIDTH)
  })

  it('spreads the events of one year over it where the year is drawn wide', () => {
    const { placements } = placeTimelineEvents(bands, [
      { key: 'morning', startYear: 11, endYear: 11, card: false, pillWidth: 80 },
      { key: 'evening', startYear: 11, endYear: 11, card: false, pillWidth: 80 },
      { key: 'crowded', startYear: 3, endYear: 3, card: false, pillWidth: 80 },
      { key: 'crowded too', startYear: 3, endYear: 3, card: false, pillWidth: 80 },
    ])
    expect(placements.get('evening')?.left).toBeGreaterThan(placements.get('morning')?.left ?? 0)
    expect(placements.get('crowded too')?.left).toBe(placements.get('crowded')?.left)
  })

  it('places every event drawn by the study workspace without any overlap', () => {
    const inputs: TimelinePlacementInput[] = Object.entries(TIMELINE_LAYOUT).map(
      ([key, [startYear, endYear, flags]]) => ({
        key,
        startYear,
        endYear,
        card: (flags & LAYOUT_CARD) !== 0,
        fixedWidth: (flags & LAYOUT_FIXED_WIDTH) !== 0,
        // Slugs stand for titles here: they are about as long.
        pillWidth: estimateTimelinePillWidth(key),
      })
    )
    const { placements, height } = placeTimelineEvents(TIMELINE_BANDS, inputs)
    expect(placements.size).toBe(inputs.length)
    const boxes = inputs.map(input => ({
      ...placements.get(input.key)!,
      height: input.card ? TIMELINE_CARD_HEIGHT : TIMELINE_PILL_HEIGHT,
    }))
    expect(overlapping(boxes)).toBe(0)
    // The whole timeline rests on its axis without rising out of reach.
    expect(height).toBeLessThan(900)
  })
})
