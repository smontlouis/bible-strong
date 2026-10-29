import { absoluteSiteUrl, RESOURCE_LANGUAGES, type ResourceLanguage } from '../resources/publicSite'
import type { SitemapUrl } from '../resources/sitemap'
import { listAtlasEntities } from './atlas.functions'
import {
  ATLAS_FAMILIES,
  buildAtlasEntityPath,
  buildAtlasFamilyPath,
  buildAtlasPath,
} from './atlasRoutes'

// Every page of the atlas exists in both languages, each listing the other as its alternate.
const bothLanguages = (pathFor: (language: ResourceLanguage) => string): SitemapUrl[] => {
  const alternates = RESOURCE_LANGUAGES.map(language => ({
    hrefLang: language,
    href: absoluteSiteUrl(pathFor(language)),
  }))
  return alternates.map(alternate => ({ loc: alternate.href, alternates }))
}

/** The atlas, its families and every entity of the publication (ADR-0091). */
export const listAtlasSitemapUrls = async (): Promise<SitemapUrl[]> => {
  const entities = await listAtlasEntities('fr')
  return [
    ...bothLanguages(buildAtlasPath),
    ...ATLAS_FAMILIES.flatMap(family =>
      bothLanguages(language => buildAtlasFamilyPath(language, family))
    ),
    ...entities.flatMap(entity =>
      bothLanguages(language => buildAtlasEntityPath(language, entity.uniqueName))
    ),
  ]
}

export const ATLAS_SITEMAPS = { 'atlas.xml': listAtlasSitemapUrls }
