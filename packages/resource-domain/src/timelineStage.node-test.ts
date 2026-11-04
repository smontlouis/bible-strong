import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildTimelineBands,
  buildTimelinePeriodBands,
  compareTimelineEvents,
  drawTimelineEvents,
  estimateTimelinePillWidth,
  findTimelinePeriod,
  LAYOUT_CARD,
  LAYOUT_FIXED_WIDTH,
  placeTimelineEvents,
  TIMELINE_CARD_HEIGHT,
  TIMELINE_CARD_WIDTH,
  TIMELINE_LAYOUT,
  TIMELINE_PERIODS,
  TIMELINE_PILL_HEIGHT,
  timelineBandAt,
  timelinePeriodExtents,
  timelinePeriodRank,
  timelinePeriodScales,
  timelineTicks,
  timelineWidth,
  timelineXToYear,
  timelineYearToX,
  type TimelinePlacementInput,
} from './timelineStage'

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
    const [first] = buildTimelineBands(scales, 600)
    assert.equal(first?.left, 600)
    assert.equal(first?.width, 200)
  })

  it('lays scales end to end, a detailed stretch splitting its period in three', () => {
    assert.deepEqual(
      bands.map(({ id, left, width }) => [id, left, width]),
      [
        ['a', 0, 200],
        ['b', 200, 1000],
        ['b', 1200, 1000],
        ['b', 2200, 800],
      ]
    )
    assert.equal(timelineWidth(bands), 3000)
    assert.deepEqual(timelinePeriodExtents(bands), [
      { id: 'a', left: 0, width: 200 },
      { id: 'b', left: 200, width: 2800 },
    ])
  })

  it('maps a year to its position and back', () => {
    assert.equal(timelineYearToX(bands, -100), 100)
    assert.equal(timelineYearToX(bands, 5), 700)
    assert.equal(timelineYearToX(bands, 11), 1700)
    assert.equal(timelineXToYear(bands, 100), -100)
    assert.equal(timelineXToYear(bands, 1699), 10)
    assert.equal(timelineXToYear(bands, 1700), 11)
  })

  it('keeps a year outside the timeline at its nearest end', () => {
    assert.equal(timelineYearToX(bands, -5000), 0)
    assert.equal(timelineYearToX(bands, 3000), 3000)
    assert.equal(timelineXToYear(bands, 99_999), 20)
  })

  it('finds the band of a position and names the year of a tick only at its start', () => {
    assert.equal(timelineBandAt(bands, 150)?.id, 'a')
    assert.equal(timelineBandAt(bands, 200)?.id, 'b')
    assert.deepEqual(timelineTicks(bands[0]!), [
      { left: 0, year: -200 },
      { left: 100, year: -100 },
    ])
    assert.deepEqual(timelineTicks(bands[2]!).slice(0, 5), [
      { left: 1200, year: 10 },
      { left: 1300 },
      { left: 1400 },
      { left: 1500 },
      { left: 1600 },
    ])
    assert.deepEqual(timelineTicks(bands[2]!)[5], { left: 1700, year: 11 })
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
    assert.ok(top('second') < top('first'))
    // The lane of the first event is free again further on.
    assert.equal(top('later'), top('first'))
  })

  it('leaves out an event the axis cannot place', () => {
    const { placements } = placeTimelineEvents(bands, [
      { key: 'undated', startYear: Number.NaN, endYear: Number.NaN, card: false },
      { key: 'dated', startYear: 1, endYear: 1, card: false },
    ])
    assert.deepEqual([...placements.keys()], ['dated'])
  })

  it('draws a card over the years it lasts, unless its width is fixed', () => {
    const { placements } = placeTimelineEvents(bands, [
      { key: 'life', startYear: 2, endYear: 8, card: true },
      { key: 'day', startYear: 14, endYear: 18, card: true, fixedWidth: true },
      { key: 'short', startYear: -150, endYear: -140, card: true },
    ])
    assert.equal(placements.get('life')?.left, 400)
    assert.equal(placements.get('life')?.width, 600)
    assert.equal(placements.get('day')?.width, TIMELINE_CARD_WIDTH)
    assert.equal(placements.get('short')?.width, TIMELINE_CARD_WIDTH)
  })

  it('spreads the events of one year over it where the year is drawn wide', () => {
    const { placements } = placeTimelineEvents(bands, [
      { key: 'morning', startYear: 11, endYear: 11, card: false, pillWidth: 80 },
      { key: 'evening', startYear: 11, endYear: 11, card: false, pillWidth: 80 },
      { key: 'crowded', startYear: 3, endYear: 3, card: false, pillWidth: 80 },
      { key: 'crowded too', startYear: 3, endYear: 3, card: false, pillWidth: 80 },
    ])
    assert.ok((placements.get('evening')?.left ?? 0) > (placements.get('morning')?.left ?? 0))
    assert.equal(placements.get('crowded too')?.left, placements.get('crowded')?.left)
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
    const { placements, height } = placeTimelineEvents(buildTimelinePeriodBands(), inputs)
    assert.equal(placements.size, inputs.length)
    const boxes = inputs.map(input => ({
      ...placements.get(input.key)!,
      height: input.card ? TIMELINE_CARD_HEIGHT : TIMELINE_PILL_HEIGHT,
    }))
    assert.equal(overlapping(boxes), 0)
    // The whole timeline rests on its axis without rising out of reach.
    assert.ok(height < 900)
  })
})

describe('drawTimelineEvents', () => {
  it('draws an event where the study workspace does, as a card when it is a major one', () => {
    const periodBands = buildTimelinePeriodBands()
    const { boxes } = drawTimelineEvents(periodBands, [
      { slug: 'adam', title: 'Adam', dates: '3954-3024 BC' },
      { slug: 'unknown-to-the-workspace', title: 'A later event', dates: '1444 BC' },
      { slug: 'still-to-come', title: 'Still to come', dates: 'Future' },
    ])
    assert.equal(boxes.get('adam')?.card, true)
    assert.equal(boxes.get('adam')?.left, timelineYearToX(periodBands, -3954))
    // An event the workspace does not draw is placed by its dating, as a pill.
    assert.equal(boxes.get('unknown-to-the-workspace')?.card, false)
    assert.equal(boxes.get('unknown-to-the-workspace')?.left, timelineYearToX(periodBands, -1444))
    assert.equal(boxes.has('still-to-come'), false)
  })
})

const event = (id: string, period: string, dates: string, slug = `event-${id}`) => ({
  id,
  slug,
  period,
  dates,
})

describe('Timeline order', () => {
  const order = (events: ReturnType<typeof event>[]) =>
    [...events].sort(compareTimelineEvents).map(({ id }) => id)

  it('follows the periods, then the first year of each event', () => {
    assert.deepEqual(
      order([
        event('5', '9', '27 AD'),
        event('4', '2', '2298-2297 BC'),
        event('3', '1', '3897-3825 BC'),
        event('2', '1', '3954-3024 BC'),
        event('1', '9', '100-44 BC'),
      ]),
      ['2', '3', '4', '1', '5']
    )
  })

  it('keeps the narrative order of the events of one year', () => {
    assert.deepEqual(
      order([
        event('1193', '9', '31 AD', 'the-resurrection'),
        event('1147', '9', '31 AD', 'the-triumphal-entry'),
        event('1189', '9', '31 AD', 'the-crucifixion'),
        event('1146', '9', '31 AD', 'passion-week'),
      ]),
      ['1146', '1147', '1189', '1193']
    )
  })

  it('closes a period with its undated events and an unknown period with the others', () => {
    assert.deepEqual(
      order([
        event('9', '', '4000 BC'),
        event('1259', '13', 'After Millenium'),
        event('1255', '13', 'Future'),
        event('1245', '13', '1844-'),
        event('7', '13', 'someday'),
        event('1244', '13', '1798-1929 AD'),
      ]),
      ['1244', '1245', '1255', '1259', '7', '9']
    )
  })
})

describe('Timeline periods', () => {
  it('names the thirteen periods of the publication in both languages', () => {
    assert.deepEqual(
      TIMELINE_PERIODS.map(period => period.id),
      Array.from({ length: 13 }, (_, index) => String(index + 1))
    )
    assert.deepEqual(findTimelinePeriod('8')?.title, { fr: 'L’Exil', en: 'The Exile' })
    assert.equal(findTimelinePeriod('14'), undefined)
    assert.ok(timelinePeriodRank('1') < timelinePeriodRank('13'))
    assert.ok(timelinePeriodRank('13') < timelinePeriodRank('unknown'))
  })
})
