import { absoluteSiteUrl, RESOURCE_LANGUAGES } from '../resources/publicSite'
import { buildResourceHead } from '../resources/resourceHead'
import { shareCardExcerpt, shareCardLine } from '../share/shareCardText'
import type { AtlasEntityPageData, AtlasFamilyPageData, AtlasHomePageData } from './atlas.functions'
import { buildAtlasEntityPath, buildAtlasFamilyPath, buildAtlasPath } from './atlasRoutes'
import { ATLAS_MESSAGES, countLabel } from './messages'

const DESCRIPTION_LENGTH = 155

const cut = (text: string, length: number) => {
  const line = shareCardLine(text)
  if (line.length <= length) return line
  const head = line.slice(0, length)
  return `${head.slice(0, Math.max(head.lastIndexOf(' '), length * 0.6)).replace(/[\s,;:.–—-]+$/u, '')}…`
}

/** Every page of the atlas exists in both languages: each lists the other. */
const bothLanguages = (pathFor: (language: 'fr' | 'en') => string) =>
  Object.fromEntries(RESOURCE_LANGUAGES.map(language => [language, pathFor(language)]))

export const buildAtlasHomeHead = (page: AtlasHomePageData) => {
  const { language } = page
  const messages = ATLAS_MESSAGES[language]
  const path = buildAtlasPath(language)
  const description = messages.homeHeadDescription.replace(
    '{entities}',
    page.entityCount.toLocaleString(language)
  )
  return buildResourceHead({
    title: messages.homeHeadTitle,
    description,
    path,
    language,
    alternates: bothLanguages(buildAtlasPath),
    ogType: 'website',
    shareCard: {
      kind: 'title',
      title: messages.homeTitle,
      facts: ATLAS_MESSAGES[language].count.replace(
        '{count}',
        page.entityCount.toLocaleString(language)
      ),
      excerpt: shareCardExcerpt(
        messages.homeLead.replace('{entities}', page.entityCount.toLocaleString(language)),
        false
      ),
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

export const buildAtlasFamilyHead = (page: AtlasFamilyPageData) => {
  const { language, family } = page
  const messages = ATLAS_MESSAGES[language]
  const name = messages.families[family]
  const path = buildAtlasFamilyPath(language, family)
  const description = messages.familyHeadDescriptions[family].replace(
    '{count}',
    page.count.toLocaleString(language)
  )
  return buildResourceHead({
    title: messages.familyHeadTitle.replace('{family}', name),
    description,
    path,
    language,
    alternates: bothLanguages(other => buildAtlasFamilyPath(other, family)),
    ogType: 'website',
    breadcrumbs: [{ label: messages.name, path: buildAtlasPath(language) }, { label: name }],
    shareCard: {
      kind: 'title',
      kicker: messages.name,
      title: name,
      facts: messages.count.replace('{count}', page.count.toLocaleString(language)),
      excerpt: shareCardExcerpt(messages.familyLeads[family], false),
    },
  })
}

export const buildAtlasEntityHead = (page: AtlasEntityPageData) => {
  const { language, uniqueName } = page
  const messages = ATLAS_MESSAGES[language]
  const path = buildAtlasEntityPath(language, uniqueName)
  const brief = page.title ?? page.brief
  const opening = page.paragraphs[0]
  const description = cut(
    opening ?? messages.entityFallbackDescription.replace('{name}', page.name),
    DESCRIPTION_LENGTH
  )
  const facts =
    page.chapterCount > 0 ? countLabel(messages.chapters, page.chapterCount, language) : undefined
  return buildResourceHead({
    title: brief
      ? messages.entityHeadTitle.replace('{name}', page.name).replace('{brief}', brief)
      : messages.entityHeadTitlePlain.replace('{name}', page.name),
    description,
    path,
    language,
    alternates: bothLanguages(other => buildAtlasEntityPath(other, uniqueName)),
    breadcrumbs: [
      { label: messages.name, path: buildAtlasPath(language) },
      { label: messages.families[page.family], path: buildAtlasFamilyPath(language, page.family) },
      { label: page.name },
    ],
    shareCard: {
      kind: 'title',
      kicker: messages.name,
      chip: messages.families[page.family],
      title: page.name,
      ...(facts ? { facts } : {}),
      ...(brief || opening ? { excerpt: shareCardExcerpt(brief || opening, false) } : {}),
    },
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': absoluteSiteUrl(path),
        url: absoluteSiteUrl(path),
        name: page.name,
        description,
        inLanguage: language,
        ...(page.painted ? { image: page.picture } : {}),
      },
    ],
  })
}
