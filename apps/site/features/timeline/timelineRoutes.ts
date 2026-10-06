import { isResourceLanguage, WEB_APP_ORIGIN, type ResourceLanguage } from '../resources/publicSite'
import type { Breadcrumb } from '../resources/resourceHead'
import { resourceSection } from '../resources/sections'

export type TimelineRoute = { language: ResourceLanguage; slug?: string }

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

/** The published identity of an event: lowercase words joined by hyphens (ADR-0056). */
export const isTimelineSlug = (value: string | undefined): value is string =>
  Boolean(value) && SLUG_PATTERN.test(value ?? '')

/**
 * Reads `/timeline/:language[/:slug]`, the grammar of ADR-0056. Letter case is the only
 * spelling tolerated: the result carries the canonical lowercase form to redirect to.
 */
export const parseTimelineRoute = (params: {
  language?: string
  slug?: string
}): TimelineRoute | undefined => {
  const language = params.language?.toLowerCase()
  if (!isResourceLanguage(language)) return undefined
  if (params.slug === undefined) return { language }
  const slug = params.slug.toLowerCase()
  return isTimelineSlug(slug) ? { language, slug } : undefined
}

/** The timeline of a language: every event, period by period. */
export const buildTimelineIndexPath = (language: ResourceLanguage): string =>
  `/timeline/${language}`

/** The slug is not translated: the language selects the localized publication. */
export const buildTimelineEventPath = (language: ResourceLanguage, slug: string): string => {
  if (!isTimelineSlug(slug)) throw new Error('TIMELINE_ROUTE_INVALID')
  return `${buildTimelineIndexPath(language)}/${slug}`
}

/** Where a period starts on the timeline page; a period has no page of its own. */
export const timelinePeriodAnchor = (period: string): string => `period-${period}`

export const buildTimelinePeriodPath = (language: ResourceLanguage, period: string): string =>
  `${buildTimelineIndexPath(language)}#${timelinePeriodAnchor(period)}`

/** The path leading to an event: the timeline of its language, then the event itself. */
export const timelineEventBreadcrumbs = (
  language: ResourceLanguage,
  eventTitle: string
): Breadcrumb[] => [
  { label: resourceSection('timeline').label[language], path: buildTimelineIndexPath(language) },
  { label: eventTitle },
]

/** The study workspace opens the same paths (ADR-0056). */
export const buildWebAppTimelineUrl = (language: ResourceLanguage, slug?: string): string =>
  `${WEB_APP_ORIGIN}${slug ? buildTimelineEventPath(language, slug) : buildTimelineIndexPath(language)}`
