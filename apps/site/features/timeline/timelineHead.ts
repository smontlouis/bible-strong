import { absoluteSiteUrl, RESOURCE_LANGUAGES } from '../resources/publicSite'
import { buildResourceHead } from '../resources/resourceHead'
import { TIMELINE_MESSAGES } from './messages'
import type { TimelineEventPageData, TimelineIndexPageData } from './timeline.functions'
import { formatTimelineDates, parseTimelineDates } from './timelineDates'
import {
  buildTimelineEventPath,
  buildTimelineIndexPath,
  timelineEventBreadcrumbs,
} from './timelineRoutes'

/** Title, description, canonical and language alternates of the timeline of a language. */
export const buildTimelineIndexHead = (page: TimelineIndexPageData) => {
  const { language } = page
  const messages = TIMELINE_MESSAGES[language]
  const path = buildTimelineIndexPath(language)
  const description = messages.indexHeadDescription
    .replace('{events}', page.eventCount.toLocaleString(language))
    .replace('{periods}', String(page.periods.length))

  return buildResourceHead({
    title: messages.indexHeadTitle,
    description,
    path,
    language,
    alternates: page.translated
      ? Object.fromEntries(
          RESOURCE_LANGUAGES.map(alternate => [alternate, buildTimelineIndexPath(alternate)])
        )
      : undefined,
    ogType: 'website',
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': absoluteSiteUrl(path),
        url: absoluteSiteUrl(path),
        name: messages.name,
        description,
        inLanguage: language,
      },
    ],
  })
}

/** Title, description, canonical, language alternates and structured data of an event. */
export const buildTimelineEventHead = (event: TimelineEventPageData) => {
  const { language, slug } = event
  const messages = TIMELINE_MESSAGES[language]
  const path = buildTimelineEventPath(language, slug)
  const indexPath = buildTimelineIndexPath(language)
  const dates = formatTimelineDates(event.dates, language)

  return buildResourceHead({
    title: messages.eventHeadTitle.replace('{title}', event.title).replace('{dates}', dates),
    description: event.description,
    path,
    language,
    // The slug is the same in every language the event is published in.
    alternates: event.translated
      ? Object.fromEntries(
          RESOURCE_LANGUAGES.map(alternate => [alternate, buildTimelineEventPath(alternate, slug)])
        )
      : undefined,
    breadcrumbs: timelineEventBreadcrumbs(language, event.title),
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        '@id': absoluteSiteUrl(path),
        url: absoluteSiteUrl(path),
        headline: event.title,
        description: event.description,
        inLanguage: language,
        isPartOf: {
          '@type': 'CollectionPage',
          '@id': absoluteSiteUrl(indexPath),
          name: messages.name,
        },
        // Ancient datings are editorial and approximate: the years are given as written,
        // never as ISO dates, and an undated event announces no period at all.
        ...(parseTimelineDates(event.dates)?.kind === 'years' ? { temporalCoverage: dates } : {}),
      },
    ],
  })
}
