import {
  absoluteSiteUrl,
  RESOURCE_FONT_PRELOADS,
  RESOURCE_LANGUAGES,
} from '../resources/publicSite'
import { breadcrumbScripts } from '../resources/resourceHead'
import type { StrongPageData } from './strong.functions'
import { strongEntryBreadcrumbs } from './strongBreadcrumbs'
import {
  buildStrongPath,
  displayStrongCode,
  displayStrongTitleCode,
  plainTransliteration,
} from './strongRoutes'

const LABELS = {
  fr: {
    strong: 'Strong',
    hebrew: 'Lexique hébreu',
    greek: 'Lexique grec',
    meaning: { hebrew: 'définition en hébreu', greek: 'définition en grec' },
    locale: 'fr_FR',
    separator: ' : ',
  },
  en: {
    strong: 'Strong’s',
    hebrew: 'Hebrew lexicon',
    greek: 'Greek lexicon',
    meaning: { hebrew: 'meaning in Hebrew', greek: 'meaning in Greek' },
    locale: 'en_US',
    separator: ': ',
  },
} as const

/** Title, description, canonical, language alternates and structured data of a Strong page. */
export const buildStrongHead = (entry: StrongPageData) => {
  const labels = LABELS[entry.language]
  const lexicon = labels[entry.lexicalLanguage]
  const displayCode = displayStrongCode(entry.code)
  const url = absoluteSiteUrl(buildStrongPath(entry.language, entry.code))
  // A word is looked for as it is typed (`elohim`), by its number or by what it means: the
  // title opens on the first and names the two others.
  const title = `${plainTransliteration(entry.transliteration) || entry.original} (${entry.original}) – ${labels.strong} ${displayStrongTitleCode(entry.code)}${labels.separator}${entry.gloss}, ${labels.meaning[entry.lexicalLanguage]}`

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': url,
    url,
    name: entry.original,
    alternateName: entry.transliteration,
    termCode: displayCode,
    description: entry.description,
    inLanguage: entry.language,
    inDefinedTermSet: { '@type': 'DefinedTermSet', name: `${lexicon} Strong` },
  }

  return {
    meta: [
      { title },
      { name: 'description', content: entry.description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: entry.description },
      { property: 'og:type', content: 'article' },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: 'Bible Strong' },
      { property: 'og:locale', content: labels.locale },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [
      ...RESOURCE_FONT_PRELOADS,
      { rel: 'canonical', href: url },
      ...RESOURCE_LANGUAGES.map(language => ({
        rel: 'alternate',
        hrefLang: language,
        href: absoluteSiteUrl(buildStrongPath(language, entry.code)),
      })),
      {
        rel: 'alternate',
        hrefLang: 'x-default',
        href: absoluteSiteUrl(buildStrongPath('fr', entry.code)),
      },
    ],
    scripts: [
      ...breadcrumbScripts(strongEntryBreadcrumbs(entry)),
      {
        type: 'application/ld+json',
        // `<` is escaped so editorial text can never close the script element.
        children: JSON.stringify(structuredData).replace(/</gu, '\\u003c'),
      },
    ],
  }
}
