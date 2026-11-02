import type {
  StudyLinkLanguage,
  StudyLinkView,
} from '@bible-strong/resource-domain/contracts/studyLinksContract'
import type { TimelineEventSummary } from '~features/resources/timelineAccess'
import { parseSourcedTimelineDates } from '~features/timeline/sourcedDates'
import { getTimelineImageUri } from '~features/timeline/timelineImage'

/** Below this many events, a scale would say nothing their cards do not. */
const RULER_MIN_EVENTS = 4
/** How far apart two events of one row stay, in hundredths of the ruler. */
const RULER_MARK_GAP = 2

const ERAS: Record<StudyLinkLanguage, { before: string; after: string }> = {
  fr: { before: 'av. J.-C.', after: 'apr. J.-C.' },
  en: { before: 'BC', after: 'AD' },
}

export type ChronologyEvent = {
  link: StudyLinkView
  title: string
  dates: string
  image?: string
  period?: string
}

export type ChronologyLead = ChronologyEvent & { summary?: string }

/** An event on the ruler: where it starts and how long it lasts, in hundredths of the ruler. */
export type ChronologyMark = {
  /** Its rank among the events of the chronology. */
  event: number
  left: number
  width: number
  /** The row it sits on, counted from the axis, when others share its years. */
  level: number
}

export type ChronologyPeriodName = { id: string; title: string; color: string }

export type ChronologyPeriod = ChronologyPeriodName & {
  count: number
  /** The rank of its first event. */
  first: number
}

export type ChronologyRuler = {
  from: string
  to: string
  /** The hue of the period the whole chronology stands in. */
  color: string
  levels: number
  marks: ChronologyMark[]
}

export type EntityChronology = {
  /** The event about the entity itself or, when nothing else remains, its only event. */
  lead?: ChronologyLead
  events: ChronologyEvent[]
  ruler?: ChronologyRuler
  /** The periods crossed by a chronology too long for one scale. */
  periods: ChronologyPeriod[]
}

type Span = { start: number; end: number }

const spanOf = (dates: string | undefined): Span | undefined => {
  const parsed = dates ? parseSourcedTimelineDates(dates) : undefined
  return parsed && { start: parsed.start, end: parsed.end }
}

const formatYear = (year: number, language: StudyLinkLanguage) =>
  `${Math.abs(year)} ${year < 0 ? ERAS[language].before : ERAS[language].after}`

const placeOnRows = (spans: readonly (Span & { event: number })[], from: number, to: number) => {
  const rowEnds: number[] = []
  const marks = spans.map(({ event, start, end }): ChronologyMark => {
    const left = ((start - from) / (to - from)) * 100
    const width = ((end - start) / (to - from)) * 100
    const free = rowEnds.findIndex(rowEnd => rowEnd <= left)
    const level = free === -1 ? rowEnds.length : free
    rowEnds[level] = left + width + RULER_MARK_GAP
    return { event, left, width, level }
  })
  return { marks, levels: rowEnds.length }
}

const buildRuler = (
  events: readonly ChronologyEvent[],
  eventDates: readonly (string | undefined)[],
  leadSpan: Span | undefined,
  periods: readonly ChronologyPeriodName[],
  language: StudyLinkLanguage
): ChronologyRuler | undefined => {
  const spans = eventDates.flatMap((dates, event) => {
    const span = spanOf(dates)
    return span ? [{ ...span, event }] : []
  })
  if (spans.length < RULER_MIN_EVENTS) return undefined
  const crossed = new Set(events.map(event => event.period))
  const period = crossed.size === 1 ? periods.find(item => item.id === events[0].period) : undefined
  if (!period) return undefined

  const scale = leadSpan ? [...spans, leadSpan] : spans
  const from = Math.min(...scale.map(span => span.start))
  const to = Math.max(...scale.map(span => span.end))
  if (from === to) return undefined
  return {
    from: formatYear(from, language),
    to: formatYear(to, language),
    color: period.color,
    ...placeOnRows(spans, from, to),
  }
}

const buildPeriods = (
  events: readonly ChronologyEvent[],
  names: readonly ChronologyPeriodName[]
): ChronologyPeriod[] => {
  const periods = new Map<string, ChronologyPeriod>()
  events.forEach((event, index) => {
    const known = periods.get(event.period ?? '')
    if (known) {
      known.count += 1
      return
    }
    const name = names.find(item => item.id === event.period)
    if (name) periods.set(name.id, { ...name, count: 1, first: index })
  })
  return periods.size > 1 ? [...periods.values()] : []
}

/**
 * What the timeline holds on an entity. The event about the entity leads, as its presentation;
 * the others follow in the order of the timeline. A link the publication does not list keeps
 * what the link itself says.
 */
export const buildEntityChronology = (
  links: readonly StudyLinkView[],
  index: readonly TimelineEventSummary[],
  periods: readonly ChronologyPeriodName[],
  language: StudyLinkLanguage
): EntityChronology | undefined => {
  const timeline = links.filter(link => link.kind === 'timeline')
  if (timeline.length === 0) return undefined

  const bySlug = new Map(index.map(event => [event.slug, event]))
  const toEvent = (link: StudyLinkView): ChronologyEvent => {
    const event = bySlug.get(link.key)
    const image = getTimelineImageUri(event?.images?.[0]?.file)
    return {
      link,
      title: link.label,
      dates: link.detail ?? '',
      ...(image ? { image } : {}),
      ...(event ? { period: event.period } : {}),
    }
  }

  const subject = timeline.find(link => link.role === 'subject')
  const others = timeline.filter(link => link !== subject)
  const leadLink = subject ?? (others.length === 1 ? others[0] : undefined)
  const rest = others.filter(link => link !== leadLink)
  const leadEvent = leadLink && bySlug.get(leadLink.key)
  const summary = leadEvent?.description?.replace(/\s+/gu, ' ').trim()
  const lead = leadLink && { ...toEvent(leadLink), ...(summary ? { summary } : {}) }
  const events = rest.map(toEvent)
  const ruler = buildRuler(
    events,
    rest.map(link => bySlug.get(link.key)?.dates),
    spanOf(leadEvent?.dates),
    periods,
    language
  )

  return {
    ...(lead ? { lead } : {}),
    events,
    ...(ruler ? { ruler } : {}),
    periods: !ruler && events.length >= RULER_MIN_EVENTS ? buildPeriods(events, periods) : [],
  }
}

/** The event of the ruler closest to a touch, in points from the top left of the ruler. */
export const closestMark = (
  marks: readonly ChronologyMark[],
  touch: { x: number; y: number },
  size: { width: number; rowHeight: number; levels: number }
): ChronologyMark | undefined => {
  const distance = ({ left, width, level }: ChronologyMark) => {
    const start = (left / 100) * size.width
    const end = start + (width / 100) * size.width
    const x = Math.min(Math.max(touch.x, start), end)
    const y = (size.levels - level - 0.5) * size.rowHeight
    return Math.hypot(touch.x - x, touch.y - y)
  }
  return marks.reduce<ChronologyMark | undefined>(
    (closest, mark) => (!closest || distance(mark) < distance(closest) ? mark : closest),
    undefined
  )
}

/** The events whose card shows its middle in a strip scrolled to `offset`. */
export const seenEvents = ({
  offset,
  viewport,
  count,
  inset,
  cardWidth,
  gap,
}: {
  offset: number
  viewport: number
  count: number
  inset: number
  cardWidth: number
  gap: number
}) => {
  const step = cardWidth + gap
  const middle = inset + cardWidth / 2
  return {
    first: Math.max(0, Math.ceil((offset - middle) / step)),
    last: Math.min(count - 1, Math.floor((offset + viewport - middle) / step)),
  }
}
