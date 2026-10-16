import type {
  TimelineEventResponseDto,
  TimelineEventsResponseDto,
} from '@bible-strong/resource-domain/contracts/timelineContract'
import * as z from 'zod/v4'
import { bookSlug } from '../bible/books'
import { findReferences, formatPassage, passageOsis, type Passage } from '../bible/reference'
import type {
  Block,
  Inline,
  TimelineCard,
  TimelineEventCard,
  TimelineEventSummary,
  TimelineImage,
} from '../cards/types'
import type { StudyLanguage } from '../language'
import { truncateText, withReferences } from '../richText'
import {
  languageInput,
  lines,
  sourceLine,
  StudyError,
  type StudyContext,
  type StudyResult,
} from '../study'

type Localized = Record<StudyLanguage, string>

const PATRIARCHS: Localized = { fr: 'L’ère des patriarches', en: 'Age of Patriarchs' }
const ISRAEL: Localized = { fr: 'L’ère d’Israël', en: 'Age of Israel' }
const CHRIST: Localized = { fr: 'L’ère de Christ', en: 'Age of Christ' }

// The publication names the period of an event by its number only. Names and spans are the
// ones of the public site (apps/site/features/timeline/timelinePeriods.ts).
const PERIODS: readonly { id: string; era: Localized; title: Localized; span?: Localized }[] = [
  { id: '1', era: PATRIARCHS, title: { fr: 'Première génération', en: 'First Generation' }, span: { fr: 'Création – v. 2500 av. J.-C.', en: 'Creation – c. 2500 BC' } },
  { id: '2', era: PATRIARCHS, title: { fr: 'Noé et le déluge', en: 'Noah & the Flood' }, span: { fr: 'v. 2500 – v. 2166 av. J.-C.', en: 'c. 2500 – c. 2166 BC' } },
  { id: '3', era: PATRIARCHS, title: { fr: 'Les patriarches', en: 'The Patriarchs' }, span: { fr: 'v. 2166 – v. 1660 av. J.-C.', en: 'c. 2166 – c. 1660 BC' } },
  { id: '4', era: ISRAEL, title: { fr: 'Israël en Égypte', en: 'Israel in Egypt' }, span: { fr: 'v. 1660 – v. 1445 av. J.-C.', en: 'c. 1660 – c. 1445 BC' } },
  { id: '5', era: ISRAEL, title: { fr: 'Les Juges', en: 'The Judges' }, span: { fr: 'v. 1445 – v. 1050 av. J.-C.', en: 'c. 1445 – c. 1050 BC' } },
  { id: '6', era: ISRAEL, title: { fr: 'Le royaume uni', en: 'United Kingdom' }, span: { fr: 'v. 1050 – v. 930 av. J.-C.', en: 'c. 1050 – c. 930 BC' } },
  { id: '7', era: ISRAEL, title: { fr: 'Le royaume divisé', en: 'Divided Kingdom' }, span: { fr: 'v. 930 – v. 586 av. J.-C.', en: 'c. 930 – c. 586 BC' } },
  { id: '8', era: ISRAEL, title: { fr: 'L’Exil', en: 'The Exile' }, span: { fr: 'v. 585 – v. 457 av. J.-C.', en: 'c. 585 – c. 457 BC' } },
  { id: '9', era: CHRIST, title: { fr: 'La vie de Christ', en: 'Life of Christ' }, span: { fr: 'v. 4 av. J.-C. – v. 34 ap. J.-C.', en: 'c. 4 BC – c. 34 AD' } },
  { id: '10', era: CHRIST, title: { fr: 'L’Église primitive', en: 'Early Church' }, span: { fr: 'v. 34 – v. 330 ap. J.-C.', en: 'c. 34 – c. 330 AD' } },
  { id: '11', era: CHRIST, title: { fr: 'Le Moyen Âge', en: 'Middle Ages' }, span: { fr: 'v. 450 – v. 1517 ap. J.-C.', en: 'c. 450 – c. 1517 AD' } },
  { id: '12', era: CHRIST, title: { fr: 'Réformation', en: 'Reformation' }, span: { fr: 'v. 1517 – v. 1840 ap. J.-C.', en: 'c. 1517 – c. 1840 AD' } },
  { id: '13', era: CHRIST, title: { fr: 'Prophéties de l’Apocalypse', en: 'Revelation Prophecies' } },
]

const periodOf = (id: string) => PERIODS.find(period => period.id === id)

// --- Dates ---------------------------------------------------------------------------
//
// The publication writes its dates in one grammar, with English era marks in both
// languages: `1444 BC`, `3954-3024 BC`, `56 AD`, `89 BC-7 AD`, `1559-`, `476-Future`,
// `Future`, `After Millenium`.

type Era = 'BC' | 'AD'
type Dates =
  | { kind: 'years'; start: number; end: number | 'open' | 'future' }
  | { kind: 'future' }
  | { kind: 'afterMillennium' }

const toYear = (digits: string, era: Era) => (era === 'BC' ? -Number(digits) : Number(digits))

const parseDates = (value: string): Dates | undefined => {
  const text = value.trim()
  if (text === 'Future') return { kind: 'future' }
  if (/^After Mill?enn?ium$/u.test(text)) return { kind: 'afterMillennium' }
  const unbounded = /^(\d{1,4})(?: (BC|AD))?-(Future)?$/u.exec(text)
  if (unbounded) {
    const start = toYear(unbounded[1]!, (unbounded[2] as Era | undefined) ?? 'AD')
    return start ? { kind: 'years', start, end: unbounded[3] ? 'future' : 'open' } : undefined
  }
  const acrossEras = /^(\d{1,4}) BC-(\d{1,4}) AD$/u.exec(text)
  if (acrossEras) {
    return { kind: 'years', start: toYear(acrossEras[1]!, 'BC'), end: toYear(acrossEras[2]!, 'AD') }
  }
  const sameEra = /^(\d{1,4})(?:-(\d{1,4}))? (BC|AD)$/u.exec(text)
  if (!sameEra) return undefined
  const era = sameEra[3] as Era
  const start = toYear(sameEra[1]!, era)
  const end = toYear(sameEra[2] ?? sameEra[1]!, era)
  return start && end ? { kind: 'years', start, end } : undefined
}

const DATE_LABELS = {
  fr: { BC: 'av. J.-C.', AD: 'ap. J.-C.', future: 'Futur', untilFuture: 'futur', afterMillennium: 'Après le millénium', from: 'À partir de {year}' },
  en: { BC: 'BC', AD: 'AD', future: 'Future', untilFuture: 'future', afterMillennium: 'After the Millennium', from: 'From {year}' },
} as const

/** Writes a dating in the language of the answer; one outside the grammar stays as written. */
export const formatDates = (value: string, language: StudyLanguage): string => {
  const dates = parseDates(value)
  if (!dates) return value.trim()
  const labels = DATE_LABELS[language]
  if (dates.kind === 'future') return labels.future
  if (dates.kind === 'afterMillennium') return labels.afterMillennium
  const { start, end } = dates
  const era = (year: number) => (year < 0 ? labels.BC : labels.AD)
  const withEra = (year: number) => `${Math.abs(year)} ${era(year)}`
  if (end === 'open') return labels.from.replace('{year}', withEra(start))
  if (end === 'future') return `${withEra(start)} – ${labels.untilFuture}`
  if (end === start) return withEra(start)
  if (start < 0 === end < 0) return `${Math.abs(start)}–${Math.abs(end)} ${era(start)}`
  return `${withEra(start)} – ${withEra(end)}`
}

// Undated events close their period.
const datesRank = (value: string): number => {
  const dates = parseDates(value)
  if (!dates) return 10_002
  if (dates.kind === 'future') return 10_000
  if (dates.kind === 'afterMillennium') return 10_001
  return dates.start
}

type ListedEvent = TimelineEventsResponseDto['events'][number]

/** Chronological order: the period, the first year, then the order of the narrative. */
const compareEvents = (left: ListedEvent, right: ListedEvent): number =>
  Number(left.period) - Number(right.period) ||
  datesRank(left.dates) - datesRank(right.dates) ||
  Number(left.id) - Number(right.id)

// --- Pictures ------------------------------------------------------------------------

/** The host the pictures of the timeline are read from (ADR-0080). */
export const TIMELINE_IMAGE_ORIGIN = 'https://media.bible-strong.app'

const IMAGE_FILE_PATTERN = /^[^/\\]+\.(?:jpe?g|png|gif|webp)$/iu

const imageOf = (
  images: readonly { caption: string; file: string }[]
): TimelineImage | undefined => {
  const image = images.find(item => IMAGE_FILE_PATTERN.test(item.file))
  if (!image) return undefined
  const address = (width: number) =>
    `${TIMELINE_IMAGE_ORIGIN}/timeline-images/w${width}/${encodeURIComponent(image.file)}.webp`
  return { small: address(480), large: address(1200), caption: image.caption.trim() }
}

const tidy = (text: string) => text.replace(/\s+/gu, ' ').trim()

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const summaryOf = (context: StudyContext, language: StudyLanguage, event: ListedEvent) => {
  const image = imageOf(event.images)
  const summary: TimelineEventSummary = {
    slug: event.slug,
    title: tidy(event.title),
    dates: formatDates(event.dates, language),
    summary: tidy(event.description),
    ...(image ? { image } : {}),
  }
  return { summary, url: context.links.timelineEvent(language, event.slug) }
}

// --- Events of the timeline ------------------------------------------------------------

const DEFAULT_EVENTS = 8
const MAX_EVENTS = 24

export const timelineInput = {
  query: z
    .string()
    .max(80)
    .optional()
    .describe('Words to find in the events: a person, a place, a fact ("Exode", "Paul", "temple").'),
  period: z
    .number()
    .int()
    .min(1)
    .max(13)
    .optional()
    .describe(
      'One of the 13 periods of biblical history, by its number: 1 First Generation, 2 Noah ' +
        'and the Flood, 3 Patriarchs, 4 Israel in Egypt, 5 Judges, 6 United Kingdom, 7 Divided ' +
        'Kingdom, 8 Exile, 9 Life of Christ, 10 Early Church, 11 Middle Ages, 12 Reformation, ' +
        '13 Revelation Prophecies. Without `query` nor `period`, the periods themselves are listed.'
    ),
  limit: z.number().int().min(1).max(MAX_EVENTS).optional().describe(`Events to return (default ${DEFAULT_EVENTS}).`),
  offset: z.number().int().min(0).max(2000).optional().describe('Events to skip, to read the following ones.'),
  language: languageInput,
}

export const timelineOutput = z.object({
  periods: z
    .array(z.object({ period: z.number(), title: z.string(), era: z.string(), span: z.string().optional() }))
    .optional(),
  events: z.array(
    z.object({
      event: z.string().describe('The identity of the event, for get_timeline_event.'),
      title: z.string(),
      dates: z.string(),
      summary: z.string(),
      url: z.string().optional(),
    })
  ),
  total: z.number().optional().describe('How many events match in all.'),
  url: z.string().optional(),
})

export const loadTimeline = async (
  context: StudyContext,
  input: { query?: string; period?: number; limit?: number; offset?: number; language?: StudyLanguage }
): Promise<StudyResult<z.infer<typeof timelineOutput>>> => {
  const language = input.language ?? context.language
  const query = input.query?.trim()
  const url = context.links.timeline(language)
  const heading = language === 'fr' ? 'Chronologie biblique' : 'Biblical timeline'

  if (!query && !input.period) {
    const periods = PERIODS.map(period => ({
      period: Number(period.id),
      title: period.title[language],
      era: period.era[language],
      ...(period.span ? { span: period.span[language] } : {}),
    }))
    const card: TimelineCard = { kind: 'timeline', language, title: heading, periods, events: [], url }
    return {
      text: lines(
        ...periods.map(
          period => `${period.period}. ${period.title}${period.span ? ` (${period.span})` : ''} — ${period.era}`
        ),
        sourceLine(url)
      ),
      model: { periods, events: [], url },
      card,
    }
  }

  const response = await context.api.get<TimelineEventsResponseDto>(
    `/v1/timelines/${language}/events`,
    // Events of a period are picked from the whole timeline, which has no filter for it.
    input.period ? { search: query } : { search: query, limit: 100 }
  )
  const period = input.period ? periodOf(String(input.period)) : undefined
  // Words are looked up in the whole article of an event: the events named by them, then
  // the ones summarized by them, come before the ones that only mention them.
  const wanted = query ? fold(query) : undefined
  const rank = (event: ListedEvent) =>
    !wanted ? 0 : fold(event.title).includes(wanted) ? 0 : fold(event.description).includes(wanted) ? 1 : 2
  const matching = (response?.events ?? [])
    .filter(event => !input.period || event.period === String(input.period))
    .sort((left, right) => rank(left) - rank(right) || compareEvents(left, right))
  const offset = input.offset ?? 0
  const page = matching
    .slice(offset, offset + (input.limit ?? DEFAULT_EVENTS))
    .map(event => summaryOf(context, language, event))

  const title = period ? period.title[language] : heading
  const subtitle = period?.span?.[language] ?? (query ? `« ${query} »` : undefined)
  const card: TimelineCard = {
    kind: 'timeline',
    language,
    title,
    ...(subtitle ? { subtitle } : {}),
    events: page.map(({ summary }) => summary),
    url,
  }

  return {
    text: page.length
      ? lines(
          `${matching.length} events${period ? ` in “${period.title[language]}”` : ''}` +
            (query ? ` matching "${query}"` : '') +
            (matching.length > page.length ? ` (showing ${offset + 1}–${offset + page.length}).` : '.'),
          ...page.map(
            ({ summary }) =>
              `${summary.dates} — ${summary.title} [${summary.slug}]: ${truncateText(summary.summary, 240)}`
          ),
          sourceLine(url)
        )
      : 'No event of the timeline matches.',
    model: {
      events: page.map(({ summary, url: eventUrl }) => ({
        event: summary.slug,
        title: summary.title,
        dates: summary.dates,
        summary: summary.summary,
        url: eventUrl,
      })),
      total: matching.length,
      url,
    },
    card,
  }
}

// --- One event -------------------------------------------------------------------------

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const ARTICLE_LENGTH = 6000

export const timelineEventInput = {
  event: z
    .string()
    .min(2)
    .max(120)
    .describe(
      'The event to read: the `event` identity returned by search_timeline ' +
        '("1-corinthians-written"), or its title.'
    ),
  language: languageInput,
}

export const timelineEventOutput = z.object({
  event: z.string(),
  title: z.string(),
  dates: z.string(),
  period: z.string().optional(),
  summary: z.string(),
  article: z.string(),
  passages: z.array(z.object({ reference: z.string(), osis: z.string() })),
  related: z.array(z.object({ event: z.string(), title: z.string() })),
  url: z.string().optional(),
})

/** Reads `book|chapter:verse[-verse]`, the passage format of the publication. */
const parseScripture = (value: string): Passage | undefined => {
  const match = /^(\d{1,2})\|(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/u.exec(value.trim())
  if (!match) return undefined
  const [book, chapter, verse] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (!bookSlug(book) || !chapter || !verse) return undefined
  const end = match[4] === undefined ? verse : Number(match[4])
  return { book, chapter, startVerse: verse, endVerse: Math.max(verse, end), wholeChapter: false }
}

/** A blank line ends a paragraph; a single line break stays inside it. */
const paragraphsOf = (text: string): string[] =>
  text
    .split(/\n\s*\n/u)
    .map(paragraph =>
      paragraph
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n')
    )
    .filter(Boolean)

export const loadTimelineEvent = async (
  context: StudyContext,
  input: { event: string; language?: StudyLanguage }
): Promise<StudyResult<z.infer<typeof timelineEventOutput>>> => {
  const language = input.language ?? context.language
  const asked = input.event.trim()
  const eventPath = (slug: string) => `/v1/timelines/${language}/events/${slug}`

  let response = SLUG_PATTERN.test(asked)
    ? await context.api.get<TimelineEventResponseDto>(eventPath(asked))
    : undefined
  if (!response) {
    const found = await context.api.get<TimelineEventsResponseDto>(
      `/v1/timelines/${language}/events`,
      { search: asked, limit: 30 }
    )
    // The event named by the words comes before the ones that only mention them.
    const wanted = fold(asked)
    const candidates = (found?.events ?? []).filter(event => SLUG_PATTERN.test(event.slug))
    const match =
      candidates.find(event => fold(event.title) === wanted) ??
      candidates.find(event => fold(event.title).includes(wanted)) ??
      candidates[0]
    if (match) response = await context.api.get<TimelineEventResponseDto>(eventPath(match.slug))
  }
  if (!response) {
    throw new StudyError(`The timeline has no event "${asked}". search_timeline finds its events.`)
  }

  const { event } = response
  const period = periodOf(event.period)
  const passages = [
    ...new Map(
      event.scriptures.flatMap(scripture => {
        const passage = parseScripture(scripture)
        return passage
          ? [[passageOsis(passage), { label: formatPassage(passage, language), osis: passageOsis(passage) }] as const]
          : []
      })
    ).values(),
  ]
  const related = event.related
    .filter(item => SLUG_PATTERN.test(item.slug))
    .map(item => ({ slug: item.slug, title: tidy(item.title) }))
  const article = paragraphsOf(event.article)
  const dates = formatDates(event.dates, language)
  const image = imageOf(event.images)
  const url = context.links.timelineEvent(language, event.slug)
  const periodLabel = period
    ? `${period.title[language]}${period.span ? ` (${period.span[language]})` : ''}`
    : undefined

  const card: TimelineEventCard = {
    kind: 'timeline_event',
    language,
    title: tidy(event.title),
    slug: event.slug,
    dates,
    ...(period ? { period: period.title[language] } : {}),
    summary: tidy(event.description),
    // A line break stays inside its paragraph, and a passage written in it is a link.
    article: withReferences(
      article.map((paragraph): Block => ({
        t: 'p',
        c: paragraph
          .split('\n')
          .flatMap((line, index): Inline[] => [
            ...(index ? [{ t: 'br' as const }] : []),
            { t: 'text', text: line },
          ]),
      })),
      text => findReferences(text, language)
    ),
    ...(image ? { image } : {}),
    passages,
    related,
    url,
  }

  const articleText = truncateText(article.join('\n\n'), ARTICLE_LENGTH)
  return {
    text: lines(
      `${card.title} — ${dates}${periodLabel ? ` — ${periodLabel}` : ''}`,
      '',
      card.summary,
      '',
      articleText,
      '',
      passages.length ? `Passages: ${passages.map(passage => passage.label).join('; ')}` : undefined,
      related.length
        ? `Related events: ${related.map(item => `${item.title} [${item.slug}]`).join('; ')}`
        : undefined,
      sourceLine(url)
    ),
    model: {
      event: event.slug,
      title: card.title,
      dates,
      ...(periodLabel ? { period: periodLabel } : {}),
      summary: card.summary,
      article: articleText,
      passages: passages.map(passage => ({ reference: passage.label, osis: passage.osis })),
      related: related.map(item => ({ event: item.slug, title: item.title })),
      url,
    },
    card,
  }
}
