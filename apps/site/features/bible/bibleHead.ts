import {
  absoluteSiteUrl,
  RESOURCE_FONT_PRELOADS,
  RESOURCE_LANGUAGES,
  type ResourceLanguage,
} from '../resources/publicSite'
import { breadcrumbScripts, buildResourceHead } from '../resources/resourceHead'
import { resourceSection } from '../resources/sections'
import type { BiblePageData, BibleVersionPageData } from './bible.functions'
import { bibleBookName } from './bibleBooks'
import { bibleBreadcrumbs, bibleVersionBreadcrumbs } from './bibleBreadcrumbs'
import {
  bibleVersionAids,
  buildBiblePath,
  buildBibleVersionPath,
  type BiblePresentation,
} from './bibleRoutes'
import { bibleVersionName, findBibleVersion } from './bibleVersions'

const SUFFIXES: Record<BiblePresentation, Record<ResourceLanguage, string>> = {
  text: { fr: '', en: '' },
  strong: { fr: ' avec les numéros Strong', en: ' with Strong’s numbers' },
  'reverse-interlinear': { fr: ' en interlinéaire inversé', en: ' reverse interlinear' },
  interlinear: { fr: ' en interlinéaire hébreu-grec', en: ' Hebrew-Greek interlinear' },
}

/** Title, description, canonical and indexing policy of a Bible page. */
export const buildBibleHead = (page: BiblePageData) => {
  const { versionId, presentation, language, book, chapter, passage, gloss } = page
  const version = findBibleVersion(versionId)
  const reference = `${bibleBookName(book, language)} ${chapter}${
    passage ? `:${passage.startVerse}${passage.endVerse ? `-${passage.endVerse}` : ''}` : ''
  }`
  const title = `${reference}${SUFFIXES[presentation][language]} – ${
    version ? bibleVersionName(version, language) : versionId
  } (${versionId})`
  const location = { versionId, presentation, book, chapter, passage }
  const url = absoluteSiteUrl(buildBiblePath({ ...location, gloss }))
  // The interlinear reading exists with French and with English glosses.
  const alternates =
    presentation === 'interlinear'
      ? RESOURCE_LANGUAGES.map(alternate => ({
          rel: 'alternate',
          hrefLang: alternate,
          href: absoluteSiteUrl(buildBiblePath({ ...location, gloss: alternate })),
        }))
      : []
  // A chapter and a single verse are indexed; the endless verse ranges are not, nor is a
  // reading with commentaries shown in the text, which only adds to the page it comes from.
  const isVariant = passage?.endVerse !== undefined || page.inlineCommentaries.length > 0

  return {
    meta: [
      { title },
      { name: 'description', content: page.description },
      ...(isVariant ? [{ name: 'robots', content: 'noindex, follow' }] : []),
      { property: 'og:title', content: title },
      { property: 'og:description', content: page.description },
      { property: 'og:type', content: 'article' },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: 'Bible Strong' },
      { property: 'og:locale', content: language === 'fr' ? 'fr_FR' : 'en_US' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [...RESOURCE_FONT_PRELOADS, { rel: 'canonical', href: url }, ...alternates],
    scripts: breadcrumbScripts(bibleBreadcrumbs(page)),
  }
}

const HUB_HEAD = {
  fr: {
    title: 'Lire la Bible en ligne – versions, numéros Strong et interlinéaire | Bible Strong',
    description:
      'Lisez la Bible en ligne gratuitement dans plus de quarante versions : Segond, Darby, King James, hébreu et grec, avec les numéros Strong et l’interlinéaire.',
  },
  en: {
    title: 'Read the Bible online – versions, Strong’s numbers and interlinear | Bible Strong',
    description:
      'Read the Bible online for free in more than forty versions: King James, NASB, Segond, Hebrew and Greek, with Strong’s numbers and the interlinear.',
  },
} as const

/** Head of `/bible` and `/fr/bible`, the same page in each interface language. */
export const buildBibleHubHead = (language: ResourceLanguage) => {
  const section = resourceSection('bible')
  return buildResourceHead({
    ...HUB_HEAD[language],
    path: section.path(language),
    language,
    alternates: { en: section.path('en'), fr: section.path('fr') },
    ogType: 'website',
  })
}

/** Head of `/bible/:version`, the books and chapters of a version. */
export const buildBibleVersionHead = (page: BibleVersionPageData) => {
  const { versionId, language, books } = page
  const version = findBibleVersion(versionId)
  const name = version ? bibleVersionName(version, language) : versionId
  const chapters = books.reduce((total, entry) => total + entry.chapters.length, 0)
  const aids = bibleVersionAids(versionId)
  const study =
    language === 'fr'
      ? [aids.includes('strong') && 'numéros Strong', aids.includes('interlinear') && 'interlinéaire']
      : [aids.includes('strong') && 'Strong’s numbers', aids.includes('interlinear') && 'interlinear']
  const studyLabel = study.filter(Boolean).join(language === 'fr' ? ' et ' : ' and ')
  return buildResourceHead({
    title:
      language === 'fr'
        ? `${name} (${versionId}) – lire en ligne | Bible Strong`
        : `${name} (${versionId}) – read online | Bible Strong`,
    description:
      language === 'fr'
        ? `Lire la ${name} (${versionId}) en ligne : ${books.length} livres et ${chapters.toLocaleString('fr')} chapitres${studyLabel ? `, avec ${studyLabel}` : ''}.`
        : `Read the ${name} (${versionId}) online: ${books.length} books and ${chapters.toLocaleString('en')} chapters${studyLabel ? `, with ${studyLabel}` : ''}.`,
    path: buildBibleVersionPath(versionId),
    language,
    breadcrumbs: bibleVersionBreadcrumbs(versionId, language),
    ogType: 'website',
  })
}
