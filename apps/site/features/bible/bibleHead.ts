import {
  absoluteSiteUrl,
  RESOURCE_FONT_PRELOADS,
  RESOURCE_LANGUAGES,
  type ResourceLanguage,
} from '../resources/publicSite'
import type { BiblePageData } from './bible.functions'
import { bibleBookName } from './bibleBooks'
import { buildBiblePath, type BiblePresentation } from './bibleRoutes'
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
  // A chapter and a single verse are indexed; the endless verse ranges are not.
  const isRange = passage?.endVerse !== undefined

  return {
    meta: [
      { title },
      { name: 'description', content: page.description },
      ...(isRange ? [{ name: 'robots', content: 'noindex, follow' }] : []),
      { property: 'og:title', content: title },
      { property: 'og:description', content: page.description },
      { property: 'og:type', content: 'article' },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: 'Bible Strong' },
      { property: 'og:locale', content: language === 'fr' ? 'fr_FR' : 'en_US' },
      { name: 'twitter:card', content: 'summary' },
    ],
    links: [...RESOURCE_FONT_PRELOADS, { rel: 'canonical', href: url }, ...alternates],
  }
}
