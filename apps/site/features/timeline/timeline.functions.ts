import type {
  BibleVerseTextsDto,
  BibleVersionCoverageDto,
} from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type {
  TimelineEventResponseDto,
  TimelineEventsResponseDto,
} from '@bible-strong/resource-domain/contracts/timelineContract'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { defaultBibleVersionId } from '../bible/bibleVersions'
import { truncateText } from '../resources/editorialHtml'
import { buildBibleReferencePath } from '../resources/editorialLinks'
import {
  isResourceLanguage,
  RESOURCE_PAGE_CACHE_CONTROL,
  type ResourceLanguage,
} from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import { TIMELINE_MESSAGES } from './messages'
import { formatTimelineDates, timelineYearSpan } from './timelineDates'
import {
  compareTimelineEvents,
  timelineImageUrl,
  timelineParagraphs,
  timelineThumbnailUrl,
} from './timelineEvents'
import { estimateTimelinePillWidth, placeTimelineEvents } from './timelineGeometry'
import { LAYOUT_CARD, LAYOUT_FIXED_WIDTH, TIMELINE_LAYOUT } from './timelineLayout'
import { findTimelinePeriod, TIMELINE_BANDS, TIMELINE_CANVAS_WIDTH } from './timelinePeriods'
import { isTimelineSlug } from './timelineRoutes'
import {
  fitTimelinePassage,
  listTimelinePassages,
  timelineExcerptVerses,
  timelinePassageLabel,
} from './timelineScriptures'

const DESCRIPTION_LENGTH = 155
const CACHE_TTL_MS = 60 * 60 * 1000

/** An event as lists show it; `dates` is the dating as the publication writes it. */
export type TimelineEventLink = { slug: string; title: string; dates: string }

/** An event of the publication, with what places it on the timeline. */
export type TimelineListedEvent = TimelineEventLink & {
  id: string
  period: string
  /** The file of its first image. */
  image?: string
}

/** An event of the timeline page: listed under its period and, when placed, drawn. */
export type TimelineIndexEvent = TimelineEventLink & {
  /** Left, top and width on the drawn timeline. */
  box?: [left: number, top: number, width: number]
  /** Drawn as a card over the years it lasts rather than as a pill. */
  card?: boolean
  thumbnail?: string
}

const otherLanguage = (language: ResourceLanguage): ResourceLanguage =>
  language === 'fr' ? 'en' : 'fr'

// Titles and summaries are single lines; the publication leaves stray spaces around some.
const singleLine = (text: string): string => text.replace(/\s+/gu, ' ').trim()

const toLink = ({ slug, title, dates }: TimelineListedEvent): TimelineEventLink => ({
  slug,
  title,
  dates,
})

const eventsCache = new Map<ResourceLanguage, { at: number; events: TimelineListedEvent[] }>()

/**
 * Every event of a language in chronological order. Without a limit the Resource API
 * returns the whole publication, which only changes when it is republished; a server
 * instance keeps it for an hour.
 */
export const listTimelineEvents = async (
  language: ResourceLanguage
): Promise<TimelineListedEvent[]> => {
  const cached = eventsCache.get(language)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.events
  const response = await readResource<TimelineEventsResponseDto>(`/v1/timelines/${language}/events`)
  const events = (response?.events ?? [])
    // An event whose slug is outside the route grammar has no page to link to.
    .filter(event => isTimelineSlug(event.slug))
    .map(({ id, slug, title, dates, period, images }) => ({
      id,
      slug,
      title: singleLine(title),
      dates,
      period,
      image: images[0]?.file,
    }))
    .sort(compareTimelineEvents)
  if (response) eventsCache.set(language, { at: Date.now(), events })
  return events
}

export type TimelineIndexPageData = {
  language: ResourceLanguage
  eventCount: number
  /** The events of each period, in order; an empty id gathers events of unknown periods. */
  periods: { id: string; events: TimelineIndexEvent[] }[]
  /** The size of the drawn timeline, above its axis. */
  canvas: { width: number; height: number }
  /** Whether the timeline is also published in the other language. */
  translated: boolean
}

export const loadTimelineIndexPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string }) => data)
  .handler(async ({ data }): Promise<TimelineIndexPageData> => {
    if (!isResourceLanguage(data.language)) throw notFound()
    const language = data.language
    const [events, otherEvents] = await Promise.all([
      listTimelineEvents(language),
      listTimelineEvents(otherLanguage(language)),
    ])
    if (!events.length) throw notFound()

    const { placements, height } = placeTimelineEvents(
      TIMELINE_BANDS,
      events.flatMap(event => {
        const drawn = TIMELINE_LAYOUT[event.slug]
        const span = drawn
          ? { startYear: drawn[0], endYear: drawn[1] }
          : timelineYearSpan(event.dates)
        // An event without years stays in the list of its period.
        if (!span) return []
        const flags = drawn?.[2] ?? 0
        return [
          {
            key: event.slug,
            ...span,
            card: (flags & LAYOUT_CARD) !== 0,
            fixedWidth: (flags & LAYOUT_FIXED_WIDTH) !== 0,
            pillWidth: estimateTimelinePillWidth(event.title),
          },
        ]
      })
    )

    const periods: TimelineIndexPageData['periods'] = []
    for (const event of events) {
      const id = findTimelinePeriod(event.period)?.id ?? ''
      const placement = placements.get(event.slug)
      const card = ((TIMELINE_LAYOUT[event.slug]?.[2] ?? 0) & LAYOUT_CARD) !== 0
      const listed: TimelineIndexEvent = {
        ...toLink(event),
        ...(placement
          ? {
              box: [placement.left, placement.top, placement.width],
              ...(card ? { card } : {}),
              ...(card && event.image ? { thumbnail: timelineThumbnailUrl(event.image) } : {}),
            }
          : {}),
      }
      const current = periods.at(-1)
      if (current?.id === id) current.events.push(listed)
      else periods.push({ id, events: [listed] })
    }
    return {
      language,
      eventCount: events.length,
      periods,
      canvas: { width: TIMELINE_CANVAS_WIDTH, height },
      translated: otherEvents.length > 0,
    }
  })

const verseCountsCache = new Map<string, { at: number; counts: Record<string, number> }>()

// Verse numbering differs between Bibles: the coverage of the Bible passages open in tells
// which of them it carries. A server instance keeps it for an hour.
const readVerseCounts = async (versionId: string): Promise<Record<string, number>> => {
  const cached = verseCountsCache.get(versionId)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.counts
  const coverage = await readResource<BibleVersionCoverageDto>(`/v1/bibles/${versionId}/coverage`)
  const counts = { ...coverage?.verseCountByBookChapter }
  if (coverage) verseCountsCache.set(versionId, { at: Date.now(), counts })
  return counts
}

export type TimelinePagePassage = {
  label: string
  /** The Bible page of the passage; absent when the Bible of the page does not carry it. */
  path?: string
  /** The first verses of the passage. */
  verses: { number: number; text: string }[]
  /** Whether the passage goes on after the verses quoted. */
  truncated: boolean
}

const loadPassages = async (
  scriptures: readonly string[],
  language: ResourceLanguage
): Promise<TimelinePagePassage[]> => {
  const cited = listTimelinePassages(scriptures)
  if (!cited.length) return []
  const versionId = defaultBibleVersionId(language)
  const counts = await readVerseCounts(versionId)
  const passages = cited.map(source => {
    const fitted = fitTimelinePassage(source, counts[`${source.book}-${source.chapter}`])
    const path = fitted && buildBibleReferencePath(language, fitted)
    return fitted && path
      ? { passage: fitted, path, quoted: timelineExcerptVerses(fitted) }
      : // A passage without a page keeps the reference of the publication, as plain text.
        { passage: source, path: undefined, quoted: [] }
  })

  const verseKey = (book: number, chapter: number, verse: number) => `${book}-${chapter}-${verse}`
  const references = new Set(
    passages.flatMap(({ passage, quoted }) =>
      quoted.map(verse => verseKey(passage.book, passage.chapter, verse))
    )
  )
  const texts = references.size
    ? await readResource<BibleVerseTextsDto>(`/v1/bibles/${versionId}/verses`, {
        references: [...references].join(','),
      })
    : undefined
  const textByKey = new Map(
    (texts?.verses ?? []).map(verse => [
      verseKey(verse.book, verse.chapter, verse.number),
      verse.text,
    ])
  )

  return passages.map(({ passage, path, quoted }) => {
    const lastQuoted = quoted.at(-1)
    return {
      label: timelinePassageLabel(passage, language),
      path,
      verses: quoted.flatMap(number => {
        const text = textByKey.get(verseKey(passage.book, passage.chapter, number))?.trim()
        return text ? [{ number, text }] : []
      }),
      truncated: lastQuoted !== undefined && (passage.endVerse ?? passage.verse) > lastQuoted,
    }
  })
}

/** What the panel of the drawn timeline shows of an event, before its page is opened. */
export type TimelinePreviewData = {
  slug: string
  title: string
  /** The dating as the publication writes it. */
  dates: string
  period: string
  summary: string
  /** The opening of the article. */
  excerpt: string
  image?: string
}

const PREVIEW_EXCERPT_LENGTH = 420

export const loadTimelinePreview = createServerFn({ method: 'GET' })
  .validator((data: { language: string; slug: string }) => data)
  .handler(async ({ data }): Promise<TimelinePreviewData> => {
    const { slug } = data
    if (!isResourceLanguage(data.language) || !isTimelineSlug(slug)) throw notFound()
    const response = await readResource<TimelineEventResponseDto>(
      `/v1/timelines/${data.language}/events/${slug}`
    )
    if (!response) throw notFound()
    const { event } = response
    const summary = singleLine(event.description)
    const opening = singleLine(timelineParagraphs(event.article)[0] ?? '')

    // A preview is as stable as the page of the event, so the CDN may keep it as long.
    setResponseHeader('Cache-Control', RESOURCE_PAGE_CACHE_CONTROL)
    return {
      slug,
      title: singleLine(event.title),
      dates: event.dates,
      period: event.period,
      summary,
      // An article opening on its own summary would say it twice.
      excerpt: opening === summary ? '' : truncateText(opening, PREVIEW_EXCERPT_LENGTH),
      image: event.images[0] && timelineImageUrl(event.images[0].file),
    }
  })

export type TimelineEventPageData = {
  language: ResourceLanguage
  slug: string
  title: string
  /** The dating as the publication writes it. */
  dates: string
  period: string
  /** The short presentation of the event. */
  summary: string
  paragraphs: string[]
  /** Plain text for metadata. */
  description: string
  images: { src: string; caption: string }[]
  passages: TimelinePagePassage[]
  /** The Bible the passages are quoted from and open in. */
  bibleVersionId: string
  related: TimelineEventLink[]
  previous?: TimelineEventLink
  next?: TimelineEventLink
  /** Whether the event is also published in the other language. */
  translated: boolean
}

export const loadTimelineEventPage = createServerFn({ method: 'GET' })
  .validator((data: { language: string; slug: string }) => data)
  .handler(async ({ data }): Promise<TimelineEventPageData> => {
    const { slug } = data
    if (!isResourceLanguage(data.language) || !isTimelineSlug(slug)) throw notFound()
    const language = data.language

    const [response, events, otherEvents] = await Promise.all([
      readResource<TimelineEventResponseDto>(`/v1/timelines/${language}/events/${slug}`),
      listTimelineEvents(language),
      listTimelineEvents(otherLanguage(language)),
    ])
    if (!response) throw notFound()
    const { event } = response
    const passages = await loadPassages(event.scriptures, language)

    const position = events.findIndex(listed => listed.slug === slug)
    // Only events of the publication have a page: a related event is listed under the
    // title its page carries, at its place on the timeline.
    const relatedSlugs = new Set(event.related.map(related => related.slug))
    relatedSlugs.delete(slug)
    const related = events.filter(listed => relatedSlugs.has(listed.slug)).map(toLink)

    const title = singleLine(event.title)
    const summary = singleLine(event.description)
    const paragraphs = timelineParagraphs(event.article)
    const fallbackDescription = TIMELINE_MESSAGES[language].eventFallbackDescription
      .replace('{title}', title)
      .replace('{dates}', formatTimelineDates(event.dates, language))

    return {
      language,
      slug,
      title,
      dates: event.dates,
      period: event.period,
      summary,
      paragraphs,
      description: truncateText(
        summary || singleLine(paragraphs[0] ?? '') || fallbackDescription,
        DESCRIPTION_LENGTH
      ),
      images: event.images.flatMap(image => {
        const src = timelineImageUrl(image.file)
        return src ? [{ src, caption: singleLine(image.caption) }] : []
      }),
      passages,
      bibleVersionId: defaultBibleVersionId(language),
      related,
      previous: position > 0 ? toLink(events[position - 1]) : undefined,
      next:
        position >= 0 && position < events.length - 1 ? toLink(events[position + 1]) : undefined,
      translated: otherEvents.some(listed => listed.slug === slug),
    }
  })
