import type { ResourceLanguage } from '../resources/publicSite'
import type { StudyLinkItem } from '../studyLinks/studyLinksRead'
import type { TimelineListedEvent } from '../timeline/timeline.functions'
import {
  formatTimelineDates,
  formatTimelineYear,
  timelineYearSpan,
} from '../timeline/timelineDates'
import { timelineEventThumbnail, type TimelinePaintings } from '../timeline/timelinePaintings'
import { findTimelinePeriod } from '../timeline/timelinePeriods'
import { buildTimelineEventPlacePath } from '../timeline/timelineRoutes'

/** Below this many events, a scale would say nothing their cards do not. */
const RULER_MIN_EVENTS = 4
/** How far apart two events of one row stay, in hundredths of the ruler. */
const RULER_MARK_GAP = 2

export type AtlasChronologyEvent = {
  slug: string
  path: string
  title: string
  /** Written in the language of the page. */
  dates: string
  thumbnail?: string
  period?: string
}

export type AtlasChronologyLead = AtlasChronologyEvent & { summary?: string }

/** An event on the ruler: where it starts and how long it lasts, in hundredths of the ruler. */
export type AtlasChronologyMark = {
  /** Its rank among the events of the chronology. */
  event: number
  left: number
  width: number
  /** The row it sits on, counted from the axis, when others share its years. */
  level: number
}

export type AtlasChronologyPeriod = {
  id: string
  title: string
  color: string
  count: number
  /** The rank of its first event. */
  first: number
}

export type AtlasChronology = {
  /** The event about the entity itself or, when nothing else remains, its only event. */
  lead?: AtlasChronologyLead
  events: AtlasChronologyEvent[]
  /** Where the entity stands on the drawn timeline. */
  placePath: string
  ruler?: {
    from: string
    to: string
    /** The hue of the period the whole chronology stands in. */
    color: string
    levels: number
    marks: AtlasChronologyMark[]
  }
  /** The periods crossed by a chronology too long for one scale. */
  periods: AtlasChronologyPeriod[]
}

type Span = { startYear: number; endYear: number }

const placeOnRows = (spans: readonly (Span & { event: number })[], from: number, to: number) => {
  const rowEnds: number[] = []
  const marks = spans.map(({ event, startYear, endYear }): AtlasChronologyMark => {
    const left = ((startYear - from) / (to - from)) * 100
    const width = ((endYear - startYear) / (to - from)) * 100
    const free = rowEnds.findIndex(end => end <= left)
    const level = free === -1 ? rowEnds.length : free
    rowEnds[level] = left + width + RULER_MARK_GAP
    return { event, left, width, level }
  })
  return { marks, levels: rowEnds.length }
}

const buildRuler = (
  events: readonly AtlasChronologyEvent[],
  eventDates: readonly (string | undefined)[],
  leadSpan: Span | undefined,
  language: ResourceLanguage
): AtlasChronology['ruler'] => {
  const spans = eventDates.flatMap((dates, event) => {
    const span = dates ? timelineYearSpan(dates) : undefined
    return span ? [{ ...span, event }] : []
  })
  if (spans.length < RULER_MIN_EVENTS) return undefined
  const periods = new Set(events.map(event => event.period))
  const period = periods.size === 1 ? findTimelinePeriod(events[0].period ?? '') : undefined
  if (!period) return undefined

  const scale = leadSpan ? [...spans, leadSpan] : spans
  const from = Math.min(...scale.map(span => span.startYear))
  const to = Math.max(...scale.map(span => span.endYear))
  if (from === to) return undefined
  return {
    from: formatTimelineYear(from, language),
    to: formatTimelineYear(to, language),
    color: period.color,
    ...placeOnRows(spans, from, to),
  }
}

const buildPeriods = (
  events: readonly AtlasChronologyEvent[],
  language: ResourceLanguage
): AtlasChronologyPeriod[] => {
  const periods = new Map<string, AtlasChronologyPeriod>()
  events.forEach((event, index) => {
    const known = periods.get(event.period ?? '')
    if (known) {
      known.count += 1
      return
    }
    const period = findTimelinePeriod(event.period ?? '')
    if (period) {
      periods.set(period.id, {
        id: period.id,
        title: period.title[language],
        color: period.color,
        count: 1,
        first: index,
      })
    }
  })
  return periods.size > 1 ? [...periods.values()] : []
}

/**
 * What the timeline holds on an entity. The event about the entity leads, as its presentation;
 * the others follow in the order of the timeline. A link the publication does not list keeps
 * what the link itself says.
 */
export const buildAtlasChronology = (
  links: readonly StudyLinkItem[],
  listed: readonly TimelineListedEvent[],
  language: ResourceLanguage,
  paintings: TimelinePaintings = {}
): AtlasChronology | undefined => {
  const timeline = links.filter(link => link.kind === 'timeline')
  if (timeline.length === 0) return undefined

  const bySlug = new Map(listed.map(event => [event.slug, event]))
  const toEvent = (link: StudyLinkItem): AtlasChronologyEvent => {
    const event = bySlug.get(link.key)
    const thumbnail = event && timelineEventThumbnail(paintings, event, 'w768')
    return {
      slug: link.key,
      path: link.path,
      title: event?.title ?? link.label,
      dates: event ? formatTimelineDates(event.dates, language) : (link.detail ?? ''),
      ...(thumbnail ? { thumbnail } : {}),
      ...(event ? { period: event.period } : {}),
    }
  }

  const subject = timeline.find(link => link.role === 'subject')
  const others = timeline.filter(link => link !== subject)
  const leadLink = subject ?? (others.length === 1 ? others[0] : undefined)
  const rest = others.filter(link => link !== leadLink)
  const lead = leadLink && {
    ...toEvent(leadLink),
    ...(bySlug.get(leadLink.key)?.summary ? { summary: bySlug.get(leadLink.key)?.summary } : {}),
  }
  const leadDates = leadLink && bySlug.get(leadLink.key)?.dates
  const events = rest.map(toEvent)
  const ruler = buildRuler(
    events,
    rest.map(link => bySlug.get(link.key)?.dates),
    leadDates ? timelineYearSpan(leadDates) : undefined,
    language
  )

  return {
    ...(lead ? { lead } : {}),
    events,
    placePath: buildTimelineEventPlacePath(language, (leadLink ?? rest[0]).key),
    ...(ruler ? { ruler } : {}),
    periods: !ruler && events.length >= RULER_MIN_EVENTS ? buildPeriods(events, language) : [],
  }
}
