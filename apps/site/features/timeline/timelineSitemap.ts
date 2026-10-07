import { absoluteSiteUrl, RESOURCE_LANGUAGES, type ResourceLanguage } from '../resources/publicSite'
import type { SitemapUrl } from '../resources/sitemap'
import { listTimelineEvents } from './timeline.functions'
import { buildTimelineEventPath, buildTimelineIndexPath } from './timelineRoutes'

// One address per language a page is published in, each listing the others as alternates.
const localizedUrls = (
  languages: readonly ResourceLanguage[],
  pathFor: (language: ResourceLanguage) => string
): SitemapUrl[] => {
  const alternates = languages.map(language => ({
    hrefLang: language,
    href: absoluteSiteUrl(pathFor(language)),
  }))
  return alternates.map(alternate => ({
    loc: alternate.href,
    ...(alternates.length > 1 ? { alternates } : {}),
  }))
}

/** The timeline of each language and every event, in chronological order. */
export const listTimelineSitemapUrls = async (): Promise<SitemapUrl[]> => {
  const published = await Promise.all(
    RESOURCE_LANGUAGES.map(async language => ({
      language,
      events: await listTimelineEvents(language),
    }))
  )
  const timelines = published.filter(({ events }) => events.length > 0)
  const languagesBySlug = new Map<string, ResourceLanguage[]>()
  for (const { language, events } of timelines) {
    for (const { slug } of events) {
      languagesBySlug.set(slug, [...(languagesBySlug.get(slug) ?? []), language])
    }
  }

  return [
    ...localizedUrls(
      timelines.map(({ language }) => language),
      buildTimelineIndexPath
    ),
    ...[...languagesBySlug].flatMap(([slug, languages]) =>
      localizedUrls(languages, language => buildTimelineEventPath(language, slug))
    ),
  ]
}

/** The sitemaps of the Timeline family, by file name under `/sitemaps/`. */
export const TIMELINE_SITEMAPS: Record<string, () => Promise<SitemapUrl[]> | SitemapUrl[]> = {
  'timeline.xml': listTimelineSitemapUrls,
}
