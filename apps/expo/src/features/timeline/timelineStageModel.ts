import {
  formatTimelineYear,
  TIMELINE_FUTURE_YEAR,
  type TimelineLanguage,
} from '@bible-strong/resource-domain/timeline-dates'
import {
  buildTimelinePeriodBands,
  compareTimelineEvents,
  drawTimelineEvents,
  timelinePeriodExtents,
  timelineTicks,
  timelineWidth,
  type TimelineBand,
} from '@bible-strong/resource-domain/timeline-stage'

// The timeline drawn on one axis, as the public site draws it (ADR-0097): what the stage of the
// application needs, worked out once from the Timeline publication.

/** An event of the publication, as the timeline lists it. */
export type TimelineStageSource = {
  id: string
  slug: string
  title: string
  period: string
  dates: string
  images?: readonly { file: string }[]
}

/** An event drawn on the stage. */
export type TimelineStageEvent = {
  slug: string
  title: string
  dates: string
  period: string
  /** The first image of the publication, shown when the event has no painting. */
  image?: string
  left: number
  top: number
  width: number
  card: boolean
}

export type TimelineStageExtent = { id: string; left: number; width: number }

export type TimelineStageModel = {
  bands: TimelineBand[]
  /** Each period on the axis, its scales taken together. */
  extents: TimelineStageExtent[]
  ticks: { left: number; year?: number }[]
  /** The events drawn, in the order of the timeline. */
  events: TimelineStageEvent[]
  /** Where the axis starts and ends; before it the stage opens, after it the stage closes. */
  axisStart: number
  axisEnd: number
  /** The stage from its opening to its close. */
  width: number
  /** The height of the lanes above the axis. */
  height: number
}

/** The events of the publication in the order of the timeline. */
export const sortTimelineEvents = <Event extends TimelineStageSource>(events: readonly Event[]) =>
  [...events].sort(compareTimelineEvents)

/**
 * Draws the publication on the axis. `introWidth` is the room kept before the first year for the
 * opening of the stage, `outroWidth` the room kept after the last one for its close.
 */
export const buildTimelineStageModel = (
  sources: readonly TimelineStageSource[],
  { introWidth, outroWidth }: { introWidth: number; outroWidth: number }
): TimelineStageModel => {
  const bands = buildTimelinePeriodBands(introWidth)
  const sorted = sortTimelineEvents(sources)
  const { boxes, height } = drawTimelineEvents(bands, sorted)
  const events = sorted.flatMap(event => {
    const box = boxes.get(event.slug)
    if (!box) return []
    return [
      {
        slug: event.slug,
        title: event.title,
        dates: event.dates,
        period: event.period,
        ...(event.images?.[0]?.file ? { image: event.images[0].file } : {}),
        left: box.left,
        top: box.top,
        width: box.width,
        card: box.card,
      },
    ]
  })
  const axisEnd = timelineWidth(bands)
  return {
    bands,
    extents: timelinePeriodExtents(bands),
    ticks: bands.flatMap(timelineTicks),
    events,
    axisStart: introWidth,
    axisEnd,
    width: axisEnd + outroWidth,
    height,
  }
}

/** The year a tick names: none where there is no year zero, and the future only once. */
export const timelineTickLabels = (
  ticks: readonly { year?: number }[],
  language: TimelineLanguage
): (string | undefined)[] => {
  let futureNamed = false
  return ticks.map(({ year }) => {
    if (year === undefined || year === 0) return undefined
    if (year < TIMELINE_FUTURE_YEAR) return String(Math.abs(year))
    if (futureNamed) return undefined
    futureNamed = true
    return formatTimelineYear(year, language)
  })
}

export type TimelineStageDrawing = TimelineStageModel & { tickLabels: (string | undefined)[] }

const drawings = new WeakMap<readonly TimelineStageSource[], Map<string, TimelineStageDrawing>>()

/**
 * The stage of a publication for a room and a language, worked out once: drawing it sorts and
 * places every event, which a timeline in motion cannot afford at each of its renders.
 */
export const getTimelineStageDrawing = (
  sources: readonly TimelineStageSource[],
  {
    introWidth,
    outroWidth,
    language,
  }: { introWidth: number; outroWidth: number; language: TimelineLanguage }
): TimelineStageDrawing => {
  const known = drawings.get(sources) ?? new Map<string, TimelineStageDrawing>()
  drawings.set(sources, known)
  const key = `${introWidth}:${outroWidth}:${language}`
  const drawn = known.get(key)
  if (drawn) return drawn
  const model = buildTimelineStageModel(sources, { introWidth, outroWidth })
  const drawing = { ...model, tickLabels: timelineTickLabels(model.ticks, language) }
  known.set(key, drawing)
  return drawing
}

/** The words a year is named with, in the language of the timeline. */
export type TimelineYearWords = { before: string; after: string; future: string }

export const timelineYearWords = (language: TimelineLanguage): TimelineYearWords => ({
  before: formatTimelineYear(-1, language).replace(/^1 /u, ''),
  after: formatTimelineYear(1, language).replace(/^1 /u, ''),
  future: formatTimelineYear(TIMELINE_FUTURE_YEAR, language),
})

/** `formatTimelineYear`, on the UI thread: the year under the cursor changes at every frame. */
export const stageYearLabel = (year: number, words: TimelineYearWords) => {
  'worklet'
  if (year >= TIMELINE_FUTURE_YEAR) return words.future
  const named = year === 0 ? 1 : year
  return `${Math.abs(named)} ${named < 0 ? words.before : words.after}`
}

/** `formatTimelineYearNumber`, on the UI thread. */
export const stageYearNumber = (year: number) => {
  'worklet'
  if (year >= TIMELINE_FUTURE_YEAR) return ''
  return year < 0 ? `−${-year}` : String(year || 1)
}

/** The events that reach into a stretch of the axis. */
export const timelineEventsWithin = (
  events: readonly TimelineStageEvent[],
  from: number,
  to: number
): TimelineStageEvent[] =>
  events.filter(event => event.left < to && event.left + event.width > from)

/**
 * Where a thing that sticks to the left of the view stands within its stretch of the axis, as
 * `position: sticky` places it: it follows the view, never leaving its stretch.
 */
export const stickyPosition = (
  scroll: number,
  start: number,
  length: number,
  size: number,
  inset = 0
) => {
  'worklet'
  return Math.max(start, Math.min(scroll + inset, start + length - size))
}

/** The year a position of the axis stands for, on the UI thread. */
export const yearAtPosition = (bands: readonly TimelineBand[], x: number) => {
  'worklet'
  let band = bands[bands.length - 1]
  for (let index = 0; index < bands.length; index += 1) {
    if (x < bands[index]!.left + bands[index]!.width) {
      band = bands[index]
      break
    }
  }
  if (!band) return 0
  const within = Math.min(Math.max(x - band.left, 0), band.width)
  return Math.floor(band.startYear + within / band.pixelsPerYear)
}

/** The period a position of the axis falls in, on the UI thread; none before or after the axis. */
export const extentIndexAt = (extents: readonly TimelineStageExtent[], x: number) => {
  'worklet'
  for (let index = 0; index < extents.length; index += 1) {
    const extent = extents[index]!
    if (x >= extent.left && x < extent.left + extent.width) return index
  }
  return -1
}

/**
 * The strip of periods: each takes the share of the strip it takes of the axis, and never less
 * than `minWidth`, so that its number stays legible.
 */
export const timelineStripSegments = (
  extents: readonly TimelineStageExtent[],
  stripWidth: number,
  minWidth = 26
): TimelineStageExtent[] => {
  const weights = extents.map(extent => Math.max(Math.round(extent.width / 100), 1))
  const widths = new Array<number>(extents.length).fill(0)
  const fixed = new Set<number>()
  // A period too short for the minimum takes it, and the others share what remains.
  for (;;) {
    const room = stripWidth - fixed.size * minWidth
    const weight = weights.reduce((sum, value, index) => (fixed.has(index) ? sum : sum + value), 0)
    let changed = false
    weights.forEach((value, index) => {
      if (fixed.has(index)) {
        widths[index] = minWidth
        return
      }
      widths[index] = weight > 0 ? (room * value) / weight : 0
      if (widths[index]! < minWidth) {
        fixed.add(index)
        changed = true
      }
    })
    if (!changed) break
  }
  let left = 0
  return extents.map((extent, index) => {
    const segment = { id: extent.id, left, width: widths[index]! }
    left += widths[index]!
    return segment
  })
}

/** The narrowest a period gets on the strip: room for its number and its name on two lines. */
export const TIMELINE_STRIP_PERIOD_WIDTH = 120
/** The strip is never shorter than this: on a phone it runs past the screen and slides. */
export const TIMELINE_STRIP_LENGTH = 2000

export type TimelineStrip = { segments: TimelineStageExtent[]; length: number }

/**
 * The strip of periods under a view of `viewWidth`: as long as the screen when the screen is
 * long enough, and otherwise longer, every period keeping its name.
 */
export const timelineStrip = (
  extents: readonly TimelineStageExtent[],
  viewWidth: number
): TimelineStrip => {
  const length = Math.max(viewWidth, TIMELINE_STRIP_LENGTH)
  return { segments: timelineStripSegments(extents, length, TIMELINE_STRIP_PERIOD_WIDTH), length }
}

/** The point of the strip a finger at `x` on the screen holds: its start at the left edge, its end at the right one. */
export const stripPointAt = (x: number, length: number, viewWidth: number) => {
  'worklet'
  return (Math.min(Math.max(x, 0), viewWidth) * length) / viewWidth
}

/**
 * How far a strip longer than the screen has slid to show `point` where a finger holding it
 * stands: not at all at its start, wholly at its end, in proportion between.
 */
export const stripOffset = (point: number, length: number, viewWidth: number) => {
  'worklet'
  if (length <= viewWidth) return 0
  return (Math.min(Math.max(point, 0), length) * (length - viewWidth)) / length
}

/** Where a position of the axis stands on the strip of periods. */
export const axisToStrip = (
  extents: readonly TimelineStageExtent[],
  segments: readonly TimelineStageExtent[],
  x: number
) => {
  'worklet'
  if (!extents.length) return 0
  let index = extents.length - 1
  for (let candidate = 0; candidate < extents.length; candidate += 1) {
    if (x < extents[candidate]!.left + extents[candidate]!.width) {
      index = candidate
      break
    }
  }
  const extent = extents[index]!
  const segment = segments[index]!
  const within = Math.min(Math.max(x - extent.left, 0), extent.width)
  return segment.left + (within / extent.width) * segment.width
}

/** Where a position of the strip of periods leads on the axis. */
export const stripToAxis = (
  extents: readonly TimelineStageExtent[],
  segments: readonly TimelineStageExtent[],
  x: number
) => {
  'worklet'
  if (!segments.length) return 0
  let index = segments.length - 1
  for (let candidate = 0; candidate < segments.length; candidate += 1) {
    if (x < segments[candidate]!.left + segments[candidate]!.width) {
      index = candidate
      break
    }
  }
  const extent = extents[index]!
  const segment = segments[index]!
  const within = Math.min(Math.max(x - segment.left, 0), segment.width)
  return extent.left + (within / segment.width) * extent.width
}

// How the stage moves under the finger and after it, as an iOS scroll view does.

/** The share of its speed a glide keeps from one millisecond to the next. */
export const GLIDE_DECELERATION = 0.998
const RUBBER_BAND = 0.55

/** How far a glide thrown at `velocity` (points per second) carries before it comes to rest. */
export const glideDistance = (velocity: number) => {
  'worklet'
  return -velocity / (1000 * Math.log(GLIDE_DECELERATION))
}

/**
 * Past an edge the finger still pulls the stage, against a resistance that grows with the pull:
 * a pull of `dimension` moves it by a third of that, and it never goes further than `dimension`.
 */
export const rubberBand = (position: number, min: number, max: number, dimension: number) => {
  'worklet'
  const pulled = (pull: number) => (1 - 1 / ((pull * RUBBER_BAND) / dimension + 1)) * dimension
  if (position < min) return min - pulled(min - position)
  if (position > max) return max + pulled(position - max)
  return position
}

/** The pull that puts the stage where it shows, past an edge: the inverse of `rubberBand`. */
export const rubberBandPull = (shown: number, min: number, max: number, dimension: number) => {
  'worklet'
  const pull = (offset: number) =>
    (dimension / (dimension - Math.min(offset, dimension - 1)) - 1) * (dimension / RUBBER_BAND)
  if (shown < min) return min - pull(min - shown)
  if (shown > max) return max + pull(shown - max)
  return shown
}
