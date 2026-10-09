import { truncateText } from '../resources/editorialHtml'
import { absoluteSiteUrl, type ResourceLanguage } from '../resources/publicSite'
import { buildResourceHead, type Breadcrumb } from '../resources/resourceHead'
import { resourceSection } from '../resources/sections'
import { NAVE_MESSAGES, naveCount } from './messages'
import type { NaveIndexPageData, NaveLetterPageData, NaveTopicPageData } from './nave.functions'
import { buildNaveIndexPath, buildNaveLetterPath, buildNavePath } from './naveRoutes'

const DESCRIPTION_LENGTH = 155

const indexCrumb = (language: ResourceLanguage): Breadcrumb => ({
  label: resourceSection('nave').label[language],
  path: buildNaveIndexPath(language),
})

/** Topics › the page of a letter. */
export const naveLetterBreadcrumbs = (
  language: ResourceLanguage,
  letter: string,
  page = 1
): Breadcrumb[] => [
  indexCrumb(language),
  {
    label: NAVE_MESSAGES[language]['letter.crumb'].replace('{letter}', letter.toUpperCase()),
    path: buildNaveLetterPath(language, letter, page),
  },
]

/** Topics › the page of its letter the topic is listed on › the topic. */
export const naveTopicBreadcrumbs = ({
  language,
  normalizedName,
  name,
  letter,
  letterPage,
}: Pick<
  NaveTopicPageData,
  'language' | 'normalizedName' | 'name' | 'letter' | 'letterPage'
>): Breadcrumb[] => [
  ...(letter ? naveLetterBreadcrumbs(language, letter, letterPage) : [indexCrumb(language)]),
  { label: name, path: buildNavePath(language, normalizedName) },
]

/**
 * What a topic page holds, for search results: how many passages it cites, then its first
 * sub-topics, or its text when it only points to other topics.
 */
export const describeNaveTopic = ({
  language,
  name,
  headings,
  referenceCount,
  text,
}: {
  language: ResourceLanguage
  name: string
  headings: string[]
  referenceCount: number
  text: string
}): string => {
  const messages = NAVE_MESSAGES[language]
  const lead =
    referenceCount > 0
      ? messages['topic.description']
          .replace('{count}', naveCount(language, 'topic.references', referenceCount))
          .replace('{name}', () => name)
      : messages['topic.description.plain'].replace('{name}', () => name)
  const detail = headings.length ? headings.join(', ') : text
  return truncateText(detail ? `${lead}${messages.separator}${detail}` : lead, DESCRIPTION_LENGTH)
}

export const buildNaveIndexHead = ({ language, topicCount, hasAlternate }: NaveIndexPageData) => {
  const messages = NAVE_MESSAGES[language]
  return buildResourceHead({
    title: messages['index.headTitle'],
    description: messages['index.headDescription'].replace(
      '{count}',
      topicCount.toLocaleString(language)
    ),
    path: buildNaveIndexPath(language),
    language,
    alternates: hasAlternate
      ? { fr: buildNaveIndexPath('fr'), en: buildNaveIndexPath('en') }
      : undefined,
    ogType: 'website',
    shareCard: {
      kind: 'title',
      title: language === 'fr' ? 'Thèmes bibliques' : 'Bible topics',
      facts:
        language === 'fr'
          ? `${topicCount.toLocaleString('fr')} thèmes de la ${messages.name}`
          : `${topicCount.toLocaleString('en')} topics of ${messages.name}`,
    },
  })
}

/**
 * Every numbered page of a letter is indexable under its own URL. The two publications
 * file a topic under the letter of its own name, so a letter has no page in the other
 * language.
 */
export const buildNaveLetterHead = (page: NaveLetterPageData) => {
  const { language, letter, topics } = page
  const messages = NAVE_MESSAGES[language]
  const numbered =
    page.page > 1 ? ` – ${messages['letter.page'].replace('{page}', String(page.page))}` : ''
  const lead = messages['letter.headDescription']
    .replace('{count}', naveCount(language, 'letter.count', page.topicCount))
    .replace('{letter}', letter.toUpperCase())
  const sample = topics
    .slice(0, 8)
    .map(topic => topic.name)
    .join(', ')
  return buildResourceHead({
    title: `${messages['letter.headTitle'].replace('{letter}', letter.toUpperCase())}${numbered}`,
    description: truncateText(
      `${lead}${numbered}${messages.separator}${sample}`,
      DESCRIPTION_LENGTH
    ),
    path: buildNaveLetterPath(language, letter, page.page),
    language,
    breadcrumbs: naveLetterBreadcrumbs(language, letter, page.page),
    ogType: 'website',
    shareCard: {
      kind: 'title',
      kicker: language === 'fr' ? 'Thèmes bibliques' : 'Bible topics',
      chip: 'Nave',
      title:
        language === 'fr'
          ? `Thèmes en ${letter.toUpperCase()}`
          : `Topics in ${letter.toUpperCase()}`,
      facts: naveCount(language, 'letter.count', page.topicCount),
    },
  })
}

/** A topic has the same page in the other language when that publication holds it too. */
export const buildNaveTopicHead = (topic: NaveTopicPageData) => {
  const { language, normalizedName, name } = topic
  const path = buildNavePath(language, normalizedName)
  const indexUrl = absoluteSiteUrl(buildNaveIndexPath(language))
  return buildResourceHead({
    title: NAVE_MESSAGES[language]['topic.headTitle'].replace('{name}', () => name),
    description: topic.description,
    path,
    language,
    alternates: topic.hasAlternate
      ? { fr: buildNavePath('fr', normalizedName), en: buildNavePath('en', normalizedName) }
      : undefined,
    breadcrumbs: naveTopicBreadcrumbs(topic),
    shareCard: {
      kind: 'title',
      kicker: language === 'fr' ? 'Thème biblique' : 'Bible topic',
      chip: 'Nave',
      title: name,
      facts:
        topic.referenceCount > 0
          ? naveCount(language, 'topic.references', topic.referenceCount)
          : undefined,
    },
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'DefinedTerm',
        '@id': absoluteSiteUrl(path),
        url: absoluteSiteUrl(path),
        name,
        description: topic.description,
        inLanguage: language,
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          name: NAVE_MESSAGES[language].name,
          url: indexUrl,
        },
      },
    ],
  })
}
