// The geometry of the drawn timeline: periods follow one another on a single axis, each at
// its own scale, and events sit on lanes above it.

/** The distance between two ticks of the ruler, whatever the scale. */
export const TIMELINE_TICK_WIDTH = 100
export const TIMELINE_LANE_HEIGHT = 34
/** A card with a picture takes two lanes; a pill takes one. */
export const TIMELINE_CARD_HEIGHT = 64
export const TIMELINE_PILL_HEIGHT = 26
/** The height of the ruler the lanes rest on. */
export const TIMELINE_RULER_HEIGHT = 60
const TIMELINE_TOP = 24
/** What separates the lowest lane from the axis. */
const TIMELINE_BOTTOM = 14
/** The lanes kept above the axis, however few events a timeline holds. */
const MIN_LANES = 8

/** A card is this wide; an event lasting longer draws a ribbon beyond it. */
export const TIMELINE_CARD_WIDTH = 224
const PILL_MIN_WIDTH = 72
const PILL_MAX_WIDTH = 240
/** What separates two events sharing a lane. */
const LANE_GAP = 10

/** A stretch of years drawn at one scale; a period may be made of several. */
export type TimelineScale = {
  /** The period the stretch belongs to. */
  id: string
  startYear: number
  endYear: number
  pixelsPerYear: number
}

/** A scale on the axis. */
export type TimelineBand = TimelineScale & { left: number; width: number }

export type TimelinePeriodScale = {
  id: string
  startYear: number
  endYear: number
  /** A tick of the ruler stands for this many years. */
  yearsPerTick: number
  /** Years of the period drawn at a finer scale, because they hold many events. */
  detail?: { startYear: number; endYear: number; yearsPerTick: number }
}

/** The scales of a period: one, or three when some of its years are detailed. */
export const timelinePeriodScales = ({
  id,
  startYear,
  endYear,
  yearsPerTick,
  detail,
}: TimelinePeriodScale): TimelineScale[] => {
  const scale = (from: number, to: number, years: number): TimelineScale => ({
    id,
    startYear: from,
    endYear: to,
    pixelsPerYear: TIMELINE_TICK_WIDTH / years,
  })
  if (!detail) return [scale(startYear, endYear, yearsPerTick)]
  return [
    scale(startYear, detail.startYear, yearsPerTick),
    scale(detail.startYear, detail.endYear, detail.yearsPerTick),
    scale(detail.endYear, endYear, yearsPerTick),
  ].filter(part => part.endYear > part.startYear)
}

/** Lays scales end to end, from where the axis starts on the drawing. */
export const buildTimelineBands = (
  scales: readonly TimelineScale[],
  origin = 0
): TimelineBand[] => {
  let left = origin
  return scales.map(scale => {
    const band = {
      ...scale,
      left,
      width: Math.round((scale.endYear - scale.startYear) * scale.pixelsPerYear),
    }
    left += band.width
    return band
  })
}

export const timelineWidth = (bands: readonly TimelineBand[]): number => {
  const last = bands.at(-1)
  return last ? last.left + last.width : 0
}

/** Where a year stands on the axis; a year outside the timeline stands at its nearest end. */
export const timelineYearToX = (bands: readonly TimelineBand[], year: number): number => {
  const band = bands.find(candidate => year < candidate.endYear) ?? bands.at(-1)
  if (!band) return 0
  const within = Math.min(Math.max(year, band.startYear), band.endYear)
  return Math.round(band.left + (within - band.startYear) * band.pixelsPerYear)
}

/** The band a position of the axis falls in. */
export const timelineBandAt = (
  bands: readonly TimelineBand[],
  x: number
): TimelineBand | undefined =>
  bands.find(candidate => x < candidate.left + candidate.width) ?? bands.at(-1)

/** The year a position of the axis stands for. */
export const timelineXToYear = (bands: readonly TimelineBand[], x: number): number => {
  const band = timelineBandAt(bands, x)
  if (!band) return 0
  const within = Math.min(Math.max(x - band.left, 0), band.width)
  return Math.floor(band.startYear + within / band.pixelsPerYear)
}

/** The extent of each period on the axis, its scales taken together. */
export const timelinePeriodExtents = (
  bands: readonly TimelineBand[]
): { id: string; left: number; width: number }[] => {
  const extents: { id: string; left: number; width: number }[] = []
  for (const band of bands) {
    const current = extents.at(-1)
    if (current?.id === band.id) current.width += band.width
    else extents.push({ id: band.id, left: band.left, width: band.width })
  }
  return extents
}

/**
 * The ticks of a band, a hundred pixels apart. A tick falling within a year, on a detailed
 * scale, carries no year.
 */
export const timelineTicks = (band: TimelineBand): { left: number; year?: number }[] => {
  const ticks: { left: number; year?: number }[] = []
  for (let offset = 0; offset < band.width; offset += TIMELINE_TICK_WIDTH) {
    const year = band.startYear + offset / band.pixelsPerYear
    const rounded = Math.round(year)
    ticks.push({
      left: band.left + offset,
      ...(Math.abs(year - rounded) < 1e-6 ? { year: rounded } : {}),
    })
  }
  return ticks
}

// Average advance of a character of a pill, measured generously so a title only meets its
// ellipsis when it is unusually wide.
const PILL_CHARACTER_WIDTH = 6.9
const PILL_CHROME_WIDTH = 32

/** The width a pill needs for its title. */
export const estimateTimelinePillWidth = (title: string): number =>
  Math.round(
    Math.min(
      Math.max(PILL_CHROME_WIDTH + title.length * PILL_CHARACTER_WIDTH, PILL_MIN_WIDTH),
      PILL_MAX_WIDTH
    )
  )

export type TimelinePlacementInput = {
  key: string
  startYear: number
  endYear: number
  /** A card with a picture, and a ribbon over the years it lasts; otherwise a pill. */
  card: boolean
  /** A card without a ribbon, however long the event lasts. */
  fixedWidth?: boolean
  /** The width of a pill, from its title. */
  pillWidth?: number
}

export type TimelinePlacement = { left: number; top: number; width: number }

/**
 * Events dated to the same year happen one after the other. Where a year is drawn wide
 * enough, they are spread over it in their order instead of being piled on its first day.
 */
const startsWithinYear = (
  bands: readonly TimelineBand[],
  inputs: readonly TimelinePlacementInput[]
): Map<string, number> => {
  const sameYear = new Map<number, TimelinePlacementInput[]>()
  for (const input of inputs) {
    if (input.startYear !== input.endYear) continue
    sameYear.set(input.startYear, [...(sameYear.get(input.startYear) ?? []), input])
  }
  const starts = new Map<string, number>()
  for (const [year, group] of sameYear) {
    const yearWidth = timelineYearToX(bands, year + 1) - timelineYearToX(bands, year)
    if (group.length < 2 || yearWidth < TIMELINE_CARD_WIDTH * 2) continue
    group.forEach((input, rank) => starts.set(input.key, year + rank / group.length))
  }
  return starts
}

/**
 * Places events on lanes above the axis so that none covers another. Events are taken from
 * left to right and each takes the lowest free lane, so the timeline rests on its axis and
 * only rises where its years are crowded.
 */
export const placeTimelineEvents = (
  bands: readonly TimelineBand[],
  inputs: readonly TimelinePlacementInput[]
): { placements: Map<string, TimelinePlacement>; height: number } => {
  const spread = startsWithinYear(bands, inputs)
  const measured = inputs
    .map((input, order) => {
      const left = timelineYearToX(bands, spread.get(input.key) ?? input.startYear)
      const span = timelineYearToX(bands, input.endYear) - left
      const width = input.card
        ? input.fixedWidth
          ? TIMELINE_CARD_WIDTH
          : Math.max(span, TIMELINE_CARD_WIDTH)
        : (input.pillWidth ?? PILL_MIN_WIDTH)
      return { input, order, left, width, lanes: input.card ? 2 : 1 }
    })
    // An event the axis cannot place is left out; the search for a lane relies on it.
    .filter(({ left, width }) => Number.isFinite(left) && Number.isFinite(width))
    // Left to right, so a lane is free as soon as its last event has ended.
    .sort((a, b) => a.left - b.left || a.order - b.order)

  // Lanes are counted from the axis upwards; each remembers where its last event ends.
  const laneEnds: number[] = []
  const placed = measured.map(({ input, left, width, lanes }) => {
    let lane = 0
    while (
      Array.from({ length: lanes }, (_, offset) => laneEnds[lane + offset] ?? -Infinity).some(
        end => end + LANE_GAP > left
      )
    ) {
      lane += 1
    }
    for (let offset = 0; offset < lanes; offset += 1) laneEnds[lane + offset] = left + width
    return { input, left, width, lanes, lane }
  })

  const laneCount = Math.max(laneEnds.length, MIN_LANES)
  const placements = new Map<string, TimelinePlacement>()
  for (const { input, left, width, lanes, lane } of placed) {
    const height = input.card ? TIMELINE_CARD_HEIGHT : TIMELINE_PILL_HEIGHT
    const slack = Math.floor((TIMELINE_LANE_HEIGHT * lanes - height) / 2)
    placements.set(input.key, {
      left,
      width,
      // The first lane is the lowest: it sits right above the axis.
      top: TIMELINE_TOP + (laneCount - lane - lanes) * TIMELINE_LANE_HEIGHT + slack,
    })
  }

  return { placements, height: TIMELINE_TOP + laneCount * TIMELINE_LANE_HEIGHT + TIMELINE_BOTTOM }
}
