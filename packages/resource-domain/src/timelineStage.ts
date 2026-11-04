// The drawn timeline, shared by the public site and the application (ADR-0097): periods follow
// one another on a single axis, each at its own scale, and events sit on lanes above it.
import { timelineDatesRank, timelineYearSpan, type TimelineLanguage } from './timelineDates'
import layout from './timelineLayout.json'

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

type Localized = Record<TimelineLanguage, string>

export type TimelinePeriod = {
  /** The `period` an event of the publication is filed under. */
  id: string
  /**
   * The stretch of the timeline the period is drawn on. Each period has its own scale: a
   * tick of the ruler, a hundred pixels apart, stands for this many years.
   */
  startYear: number
  endYear: number
  yearsPerTick: number
  /** Years of the period drawn at a finer scale, because they hold many events. */
  detail?: { startYear: number; endYear: number; yearsPerTick: number }
  /** The age the period belongs to; three ages cover the thirteen periods. */
  era: Localized
  title: Localized
  /** The years the period is named after, when it has a place in time. */
  span?: Localized
  summary: Localized
  /** The colour of the period on the timeline of the study workspace; decoration only. */
  color: string
}

const PATRIARCHS: Localized = { fr: 'L’ère des patriarches', en: 'Age of Patriarchs' }
const ISRAEL: Localized = { fr: 'L’ère d’Israël', en: 'Age of Israel' }
const CHRIST: Localized = { fr: 'L’ère de Christ', en: 'Age of Christ' }

// The Timeline publication only names the period of an event by its number. Names, spans
// and summaries mirror the timeline bundled with the study workspace
// (apps/expo/src/assets/timeline/events.txt), in the order of the periods. Scales start
// from the workspace's and are finer where its events would otherwise pile up: the whole
// timeline is drawn at once and kept close to its axis.
export const TIMELINE_PERIODS: readonly TimelinePeriod[] = [
  {
    id: '1',
    startYear: -4100,
    endYear: -2900,
    yearsPerTick: 100,
    era: PATRIARCHS,
    title: { fr: 'Première génération', en: 'First Generation' },
    span: { fr: 'Création – v. 2500 av. J.-C.', en: 'Creation – c. 2500 BC' },
    summary: {
      fr: 'De la création d’Adam et Ève, au meurtre d’Abel par Caïn, et à l’histoire de l’humanité avant le déluge.',
      en: 'From the creation of Adam and Eve, to the murder of Abel by Cain, and human history before the flood.',
    },
    color: '#ad1f26',
  },
  {
    id: '2',
    startYear: -2900,
    endYear: -1950,
    yearsPerTick: 25,
    era: PATRIARCHS,
    title: { fr: 'Noé et le déluge', en: 'Noah & the Flood' },
    span: { fr: 'v. 2500 – v. 2166 av. J.-C.', en: 'c. 2500 – c. 2166 BC' },
    summary: {
      fr: 'Du ministère de Noé et du déluge mondial à Cush, Nimrod et la tour de Babel.',
      en: 'From the ministry of Noah and the global deluge, to Cush, Nimrod, and the tower of Babel.',
    },
    color: '#db2f2c',
  },
  {
    id: '3',
    startYear: -1950,
    endYear: -1650,
    yearsPerTick: 5,
    era: PATRIARCHS,
    title: { fr: 'Les patriarches', en: 'The Patriarchs' },
    span: { fr: 'v. 2166 – v. 1660 av. J.-C.', en: 'c. 2166 – c. 1660 BC' },
    summary: {
      fr: 'De l’appel d’Abraham, à Sodome et Gomorrhe, à l’ascension des 12 tribus juives en passant par Isaac et Jacob.',
      en: 'From the call of Abraham, to Sodom and Gomorrah, and the rise of the 12 Jewish tribes through Isaac and Jacob.',
    },
    color: '#bb3380',
  },
  {
    id: '4',
    startYear: -1650,
    endYear: -1450,
    yearsPerTick: 25,
    era: ISRAEL,
    title: { fr: 'Israël en Égypte', en: 'Israel in Egypt' },
    span: { fr: 'v. 1660 – v. 1445 av. J.-C.', en: 'c. 1660 – c. 1445 BC' },
    summary: {
      fr: 'De la vente de Joseph en esclavage, à sa montée en puissance en Égypte, en passant par Moïse et l’Exode.',
      en: 'From Joseph being sold into slavery, his rise to power in Egypt, and to Moses and the Exodus.',
    },
    color: '#903a95',
  },
  {
    id: '5',
    startYear: -1450,
    endYear: -1100,
    yearsPerTick: 10,
    era: ISRAEL,
    title: { fr: 'Les Juges', en: 'The Judges' },
    span: { fr: 'v. 1445 – v. 1050 av. J.-C.', en: 'c. 1445 – c. 1050 BC' },
    summary: {
      fr: 'De Moïse et les dix commandements à l’entrée de Josué et à l’expansion juive en Terre promise.',
      en: 'From Moses and the Ten Commandments to Joshua’s entrance and Jewish expansion into the Promised Land.',
    },
    color: '#63479b',
  },
  {
    id: '6',
    startYear: -1100,
    endYear: -930,
    yearsPerTick: 2,
    era: ISRAEL,
    title: { fr: 'Le royaume uni', en: 'United Kingdom' },
    span: { fr: 'v. 1050 – v. 930 av. J.-C.', en: 'c. 1050 – c. 930 BC' },
    summary: {
      fr: 'Du roi Saül au prophète Samuel et au jeune roi David et sa dynastie royale en passant par Salomon.',
      en: 'From King Saul to the prophet Samuel and young King David and his royal dynasty through Solomon.',
    },
    color: '#3b6eb5',
  },
  {
    id: '7',
    startYear: -930,
    endYear: -620,
    yearsPerTick: 2,
    era: ISRAEL,
    title: { fr: 'Le royaume divisé', en: 'Divided Kingdom' },
    span: { fr: 'v. 930 – v. 586 av. J.-C.', en: 'c. 930 – c. 586 BC' },
    summary: {
      fr: 'Des conflits internes qui ont divisé la nation d’Israël aux prophètes qui ont averti de l’exil à venir.',
      en: 'From the internal strife that divided the nation of Israel to the prophets who warned of the coming exile.',
    },
    color: '#23a6c5',
  },
  {
    id: '8',
    startYear: -620,
    endYear: -100,
    yearsPerTick: 5,
    era: ISRAEL,
    title: { fr: 'L’Exil', en: 'The Exile' },
    span: { fr: 'v. 585 – v. 457 av. J.-C.', en: 'c. 585 – c. 457 BC' },
    summary: {
      fr: 'De la chute d’Israël à l’exil à Babylone et aux grands prophètes déclarant le Messie à venir.',
      en: 'From Israel’s fall to exile in Babylon and the major prophets declaring the coming Messiah.',
    },
    color: '#33bdbb',
  },
  {
    id: '9',
    startYear: -100,
    endYear: 35,
    yearsPerTick: 1,
    // The ministry of Jesus holds more events than any other stretch of the timeline:
    // a tick is two months there, so they can be read one after the other.
    detail: { startYear: 27, endYear: 32, yearsPerTick: 1 / 6 },
    era: CHRIST,
    title: { fr: 'La vie de Christ', en: 'Life of Christ' },
    span: { fr: 'v. 4 av. J.-C. – v. 34 ap. J.-C.', en: 'c. 4 BC – c. 34 AD' },
    summary: {
      fr: 'Depuis la naissance du Messie promis, Jésus le Christ, jusqu’à son ministère, sa mort et sa résurrection.',
      en: 'From the birth of the promised Messiah, Jesus the Christ, to His ministry and death and resurrection.',
    },
    color: '#52b148',
  },
  {
    id: '10',
    startYear: 35,
    endYear: 350,
    yearsPerTick: 5,
    era: CHRIST,
    title: { fr: 'L’Église primitive', en: 'Early Church' },
    span: { fr: 'v. 34 – v. 330 ap. J.-C.', en: 'c. 34 – c. 330 AD' },
    summary: {
      fr: 'Du martyre d’Étienne à la persécution et à l’ascension de l’Église par Paul et les apôtres.',
      en: 'From the martyrdom of Stephen to the persecution and rise of the church through Paul and the apostles.',
    },
    color: '#b6bf34',
  },
  {
    id: '11',
    startYear: 350,
    endYear: 1520,
    yearsPerTick: 20,
    era: CHRIST,
    title: { fr: 'Le Moyen Âge', en: 'Middle Ages' },
    span: { fr: 'v. 450 – v. 1517 ap. J.-C.', en: 'c. 450 – c. 1517 AD' },
    summary: {
      fr: 'De la légalisation du christianisme sous Constantin à la persécution de l’âge des ténèbres.',
      en: 'From the legalization of Christianity under Constantine to the persecution of the Dark Ages.',
    },
    color: '#eec826',
  },
  {
    id: '12',
    startYear: 1520,
    endYear: 1840,
    yearsPerTick: 2,
    era: CHRIST,
    title: { fr: 'Réformation', en: 'Reformation' },
    span: { fr: 'v. 1517 – v. 1840 ap. J.-C.', en: 'c. 1517 – c. 1840 AD' },
    summary: {
      fr: 'Des grands réformateurs, tels que Luther et Wycliffe, à l’expansion du mouvement protestant.',
      en: 'From the great reformers, such as Luther and Wycliffe, to the expansion of the Protestant movement.',
    },
    color: '#e9a327',
  },
  {
    id: '13',
    startYear: 1840,
    endYear: 3100,
    yearsPerTick: 25,
    era: CHRIST,
    // The bundled timeline spreads these prophecies from Creation to the present; the
    // publication files the events of the last centuries and those still to come here.
    title: { fr: 'Prophéties de l’Apocalypse', en: 'Revelation Prophecies' },
    summary: {
      fr: 'De la montée de l’Antéchrist, la marque de la bête, au retour du Christ et à la restauration du paradis.',
      en: 'From the rise of the antichrist, the mark of the beast, to the return of Christ and paradise restored.',
    },
    color: '#ed7c2c',
  },
]

export const findTimelinePeriod = (id: string): TimelinePeriod | undefined =>
  TIMELINE_PERIODS.find(period => period.id === id)

/** Periods follow one another in time; an event filed under an unknown one comes last. */
export const timelinePeriodRank = (id: string): number => {
  const index = TIMELINE_PERIODS.findIndex(period => period.id === id)
  return index === -1 ? TIMELINE_PERIODS.length : index
}

/** The whole timeline on its axis, every period at its scale, from where the drawing starts it. */
export const buildTimelinePeriodBands = (origin = 0): TimelineBand[] =>
  buildTimelineBands(TIMELINE_PERIODS.flatMap(timelinePeriodScales), origin)

/** What places an event on the timeline. */
export type TimelineOrderKey = { id: string; slug: string; period: string; dates: string }

const sourceRank = (id: string): number =>
  /^\d+$/u.test(id) ? Number(id) : Number.MAX_SAFE_INTEGER

/**
 * Chronological order: the period, then the first year of the event. The publication
 * numbers its events along the narrative, so events of one year keep that order (the
 * trials of Jesus before his crucifixion, all dated 31 AD).
 */
export const compareTimelineEvents = (left: TimelineOrderKey, right: TimelineOrderKey): number =>
  timelinePeriodRank(left.period) - timelinePeriodRank(right.period) ||
  timelineDatesRank(left.dates) - timelineDatesRank(right.dates) ||
  sourceRank(left.id) - sourceRank(right.id) ||
  left.slug.localeCompare(right.slug)

/** A card with a picture, drawn over the years the event lasts. */
export const LAYOUT_CARD = 1
/** A card that keeps its minimum width however long the event lasts. */
export const LAYOUT_FIXED_WIDTH = 2

/**
 * How the study workspace draws an event: first year, last year and flags. The Timeline
 * publication only carries a dating in words, so this mirrors the timeline bundled with
 * the workspace; `scripts/generate-timeline-layout.mjs` rebuilds it. Years are those of
 * the drawing: what is still to come is given a year after the present.
 */
export const TIMELINE_LAYOUT: Readonly<
  Record<string, readonly [startYear: number, endYear: number, flags: number]>
> = layout as unknown as Record<string, [number, number, number]>

/** An event of the publication, as the drawing needs it. */
export type TimelineDrawingInput = { slug: string; title: string; dates: string }

/** Where an event is drawn, and whether as a card with a picture or as a pill. */
export type TimelineBox = TimelinePlacement & { card: boolean }

/**
 * Draws the events of the publication: each over the years the study workspace draws it, or
 * over those of its dating when the workspace does not draw it, as a card when the workspace
 * draws it as a major event. An event without years has no place on the axis.
 */
export const drawTimelineEvents = (
  bands: readonly TimelineBand[],
  events: readonly TimelineDrawingInput[]
): { boxes: Map<string, TimelineBox>; height: number } => {
  const cards = new Set<string>()
  const { placements, height } = placeTimelineEvents(
    bands,
    events.flatMap(event => {
      const drawn = TIMELINE_LAYOUT[event.slug]
      const span = drawn
        ? { startYear: drawn[0], endYear: drawn[1] }
        : timelineYearSpan(event.dates)
      if (!span) return []
      const flags = drawn?.[2] ?? 0
      const card = (flags & LAYOUT_CARD) !== 0
      if (card) cards.add(event.slug)
      return [
        {
          key: event.slug,
          ...span,
          card,
          fixedWidth: (flags & LAYOUT_FIXED_WIDTH) !== 0,
          pillWidth: estimateTimelinePillWidth(event.title),
        },
      ]
    })
  )
  const boxes = new Map<string, TimelineBox>()
  for (const [slug, placement] of placements) {
    boxes.set(slug, { ...placement, card: cards.has(slug) })
  }
  return { boxes, height }
}
