import {
  formatTimelineYear,
  formatTimelineYearNumber,
} from '@bible-strong/resource-domain/timeline-dates'
import { timelineXToYear, timelineYearToX } from '@bible-strong/resource-domain/timeline-stage'
import {
  axisToStrip,
  buildTimelineStageModel,
  extentIndexAt,
  getTimelineStageDrawing,
  glideDistance,
  rubberBand,
  rubberBandPull,
  sortTimelineEvents,
  stageYearLabel,
  stageYearNumber,
  stickyPosition,
  stripOffset,
  stripPointAt,
  stripToAxis,
  TIMELINE_STRIP_LENGTH,
  TIMELINE_STRIP_PERIOD_WIDTH,
  timelineEventsWithin,
  timelineStrip,
  timelineStripSegments,
  timelineYearWords,
  yearAtPosition,
  type TimelineStageSource,
} from '../timelineStageModel'

const sources: TimelineStageSource[] = [
  { id: '1100', slug: 'the-crucifixion', title: 'La crucifixion', period: '9', dates: '31 AD' },
  {
    id: '2',
    slug: 'adam',
    title: 'Adam',
    period: '1',
    dates: '3954-3024 BC',
    images: [{ file: 'adam.jpg' }],
  },
  { id: '3', slug: 'abel', title: 'Abel', period: '1', dates: '3897-3825 BC' },
  {
    id: '1255',
    slug: 'second-coming',
    title: 'Le retour du Christ',
    period: '13',
    dates: 'Future',
  },
]

describe('timeline stage model', () => {
  const model = buildTimelineStageModel(sources, { introWidth: 390, outroWidth: 390 })

  it('draws the events with a place in time, in the order of the timeline', () => {
    expect(model.events.map(event => event.slug)).toEqual(['adam', 'abel', 'the-crucifixion'])
    expect(model.events[0]).toMatchObject({ card: true, image: 'adam.jpg' })
    expect(model.events[0]?.left).toBe(timelineYearToX(model.bands, -3954))
  })

  it('opens before the first year and closes after the last', () => {
    expect(model.axisStart).toBe(390)
    expect(model.extents[0]?.left).toBe(390)
    expect(model.extents).toHaveLength(13)
    expect(model.width).toBe(model.axisEnd + 390)
  })

  it('sorts the events of the publication by period, then by year', () => {
    expect(sortTimelineEvents(sources).map(event => event.slug)).toEqual([
      'adam',
      'abel',
      'the-crucifixion',
      'second-coming',
    ])
  })

  it('keeps the events that reach into a stretch of the axis', () => {
    const adam = model.events[0]!
    expect(
      timelineEventsWithin(model.events, adam.left - 10, adam.left + 1).map(e => e.slug)
    ).toContain('adam')
    expect(timelineEventsWithin(model.events, model.axisEnd, model.width)).toEqual([])
  })

  it('reads the year and the period under a position as the shared geometry does', () => {
    for (const x of [400, 2500, 50_000, 80_000]) {
      expect(yearAtPosition(model.bands, x)).toBe(timelineXToYear(model.bands, x))
    }
    expect(extentIndexAt(model.extents, 10)).toBe(-1)
    expect(extentIndexAt(model.extents, 400)).toBe(0)
    expect(extentIndexAt(model.extents, model.axisEnd + 10)).toBe(-1)
  })
})

describe('stickyPosition', () => {
  it('follows the view within its stretch, as a sticky element does', () => {
    // A card 224 wide on a ribbon from 1000 to 2000, kept 16 from the left of the view.
    expect(stickyPosition(0, 1000, 1000, 224, 16)).toBe(1000)
    expect(stickyPosition(1200, 1000, 1000, 224, 16)).toBe(1216)
    expect(stickyPosition(5000, 1000, 1000, 224, 16)).toBe(1776)
  })
})

describe('timelineStripSegments', () => {
  const extents = [
    { id: 'long', left: 0, width: 10_000 },
    { id: 'short', left: 10_000, width: 100 },
    { id: 'middle', left: 10_100, width: 2_000 },
  ]

  it('shares the strip by the length of each period, never below its minimum', () => {
    const segments = timelineStripSegments(extents, 390)
    expect(segments.reduce((sum, segment) => sum + segment.width, 0)).toBeCloseTo(390)
    expect(segments[1]?.width).toBe(26)
    expect(segments[0]!.width / segments[2]!.width).toBeCloseTo(100 / 20)
    expect(segments[1]?.left).toBeCloseTo(segments[0]!.width)
  })

  it('maps a position of the axis to the strip and back', () => {
    const segments = timelineStripSegments(extents, 390)
    for (const x of [0, 5_000, 10_050, 11_000]) {
      expect(stripToAxis(extents, segments, axisToStrip(extents, segments, x))).toBeCloseTo(x)
    }
  })
})

describe('the strip on a phone', () => {
  const extents = Array.from({ length: 13 }, (_, index) => ({
    id: String(index + 1),
    left: index * 5_000,
    width: index === 6 ? 15_000 : 5_000,
  }))

  it('runs past a narrow screen and names every period', () => {
    for (const viewWidth of [320, 393]) {
      const { segments, length } = timelineStrip(extents, viewWidth)
      expect(length).toBe(TIMELINE_STRIP_LENGTH)
      expect(segments.reduce((sum, segment) => sum + segment.width, 0)).toBeCloseTo(length)
      for (const segment of segments) {
        expect(segment.width).toBeGreaterThanOrEqual(TIMELINE_STRIP_PERIOD_WIDTH)
      }
    }
  })

  it('stays put on a screen it fits', () => {
    const { length } = timelineStrip(extents, 2_400)
    expect(length).toBe(2_400)
    expect(stripOffset(1_200, length, 2_400)).toBe(0)
  })

  it('shows its start at the left edge, its end at the right one', () => {
    expect(stripPointAt(0, 2_000, 320)).toBe(0)
    expect(stripPointAt(320, 2_000, 320)).toBe(2_000)
    expect(stripOffset(0, 2_000, 320)).toBe(0)
    expect(stripOffset(2_000, 2_000, 320)).toBe(2_000 - 320)
  })

  it('keeps the point a finger holds under the finger', () => {
    for (const x of [0, 40, 160, 300, 320]) {
      const point = stripPointAt(x, 2_000, 320)
      expect(point - stripOffset(point, 2_000, 320)).toBeCloseTo(x)
    }
  })
})

describe('how the stage moves', () => {
  it('follows the finger inside its edges and resists more and more past them', () => {
    expect(rubberBand(200, 0, 1000, 400)).toBe(200)
    const near = 0 - rubberBand(-40, 0, 1000, 400)
    const far = 0 - rubberBand(-400, 0, 1000, 400)
    expect(near).toBeLessThan(40)
    expect(far / 400).toBeLessThan(near / 40)
    expect(1000 - rubberBand(1_000_000, 0, 1000, 400)).toBeGreaterThan(-400)
  })

  it('finds again the pull that put the stage past an edge', () => {
    for (const pull of [-300, -20, 1100, 1600]) {
      expect(rubberBandPull(rubberBand(pull, 0, 1000, 400), 0, 1000, 400)).toBeCloseTo(pull)
    }
  })

  it('carries a glide about half a second of its speed, either way', () => {
    expect(glideDistance(1000)).toBeCloseTo(499.5, 0)
    expect(glideDistance(-1000)).toBeCloseTo(-499.5, 0)
  })
})

describe('the drawing of the stage', () => {
  it('is worked out once for a publication, a room and a language', () => {
    const first = getTimelineStageDrawing(sources, {
      introWidth: 390,
      outroWidth: 390,
      language: 'fr',
    })
    expect(
      getTimelineStageDrawing(sources, { introWidth: 390, outroWidth: 390, language: 'fr' })
    ).toBe(first)
    expect(
      getTimelineStageDrawing(sources, { introWidth: 600, outroWidth: 520, language: 'fr' })
    ).not.toBe(first)
    expect(first.tickLabels).toHaveLength(first.ticks.length)
  })

  it('names the years on the UI thread as the shared formats do', () => {
    for (const language of ['fr', 'en'] as const) {
      const words = timelineYearWords(language)
      for (const year of [-4100, -1050, -1, 0, 1, 31, 1844, 2019, 2020, 2500]) {
        expect(stageYearLabel(year, words)).toBe(formatTimelineYear(year, language))
        expect(stageYearNumber(year)).toBe(formatTimelineYearNumber(year))
      }
    }
  })
})
