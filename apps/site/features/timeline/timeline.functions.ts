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
import { defaultBibleVersionId } from '../bible/bibleVersions'
import { truncateText } from '../resources/editorialHtml'
import { buildBibleReferencePath } from '../resources/editorialLinks'
import { isResourceLanguage, type ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import { TIMELINE_MESSAGES } from './messages'
import { formatTimelineDates } from './timelineDates'
import {
  compareTimelineEvents,
  TIMELINE_IMAGES_PUBLISHED,
  timelineImageUrl,
  timelineParagraphs,
} from './timelineEvents'
import { findTimelinePeriod } from './timelinePeriods'
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
export type TimelineListedEvent = TimelineEventLink & { id: string; period: string }

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
    .map(({ id, slug, title, dates, period }) => ({
      id,
      slug,
      title: singleLine(title),
      dates,
      period,
    }))
    .sort(compareTimelineEvents)
  if (response) eventsCache.set(language, { at: Date.now(), events })
  return events
}

export type TimelineIndexPageData = {
  language: ResourceLanguage
  eventCount: number
  /** The events of each period, in order; an empty id gathers events of unknown periods. */
  periods: { id: string; events: TimelineEventLink[] }[]
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

    const periods: TimelineIndexPageData['periods'] = []
    for (const event of events) {
      const id = findTimelinePeriod(event.period)?.id ?? ''
      const current = periods.at(-1)
      if (current?.id === id) current.events.push(toLink(event))
      else periods.push({ id, events: [toLink(event)] })
    }
    return { language, eventCount: events.length, periods, translated: otherEvents.length > 0 }
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
      images: TIMELINE_IMAGES_PUBLISHED
        ? event.images.flatMap(image => {
            const src = timelineImageUrl(image.file)
            return src ? [{ src, caption: singleLine(image.caption) }] : []
          })
        : [],
      passages,
      bibleVersionId: defaultBibleVersionId(language),
      related,
      previous: position > 0 ? toLink(events[position - 1]) : undefined,
      next:
        position >= 0 && position < events.length - 1 ? toLink(events[position + 1]) : undefined,
      translated: otherEvents.some(listed => listed.slug === slug),
    }
  })
