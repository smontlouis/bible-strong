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
import { shareCardExcerpt, shareCardPicture } from '../share/shareCardText'
import { findTimelinePeriod } from './timelinePeriods'

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
    shareCard: {
      kind: 'title',
      title: messages.name,
      facts:
        language === 'fr'
          ? `${page.eventCount.toLocaleString('fr')} personnages et événements en ${page.periods.length} périodes`
          : `${page.eventCount.toLocaleString('en')} people and events in ${page.periods.length} periods`,
      // Six of the periods, from the Creation to the early Church.
      pictures: ['1', '2', '4', '6', '9', '10'].flatMap(id => {
        const period = findTimelinePeriod(id)
        return period
          ? [
              {
                src: absoluteSiteUrl(`/images/timeline/period-${id}.jpg`),
                caption: period.title[language],
              },
            ]
          : []
      }),
    },
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
  const picture = shareCardPicture(event.images[0]?.src)

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
    shareCard: {
      kind: 'title',
      kicker: language === 'fr' ? 'Chronologie' : 'Timeline',
      chip: dates,
      title: event.title,
      excerpt: shareCardExcerpt(event.summary, picture !== undefined),
      picture,
    },
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
