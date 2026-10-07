import { absoluteSiteUrl, RESOURCE_LANGUAGES, type ResourceLanguage } from '../resources/publicSite'
import type { SitemapUrl } from '../resources/sitemap'
import { listDictionaryEntries, listDictionaryWorks } from './dictionary.functions'
import {
  buildDictionaryEntryPath,
  buildDictionaryIndexPath,
  buildDictionaryLetterPath,
  buildDictionaryWorkPath,
  DICTIONARY_LETTERS,
  DICTIONARY_LIST_PAGE_SIZE,
  dictionaryLetter,
} from './dictionaryRoutes'

// A sitemap is registered under a fixed name, so the works are named here. Pages are
// served for every work the Resource API publishes: a work missing from this list is
// still listed by `dictionary-index.xml` and reached through its links.
const SITEMAP_WORKS: Record<ResourceLanguage, readonly string[]> = {
  fr: ['bost', 'calmet', 'lelievre', 'westphal'],
  en: ['easton-webster', 'isbe', 'smith', 'unfoldingword-translation-words'],
}

/** The list of dictionaries of each language that has some, and the page of every work. */
export const listDictionaryIndexSitemapUrls = async (): Promise<SitemapUrl[]> => {
  const catalogs = await Promise.all(
    RESOURCE_LANGUAGES.map(async language => ({
      language,
      works: await listDictionaryWorks(language),
    }))
  )
  const published = catalogs.filter(catalog => catalog.works.length > 0)
  const alternates = published.map(({ language }) => ({
    hrefLang: language,
    href: absoluteSiteUrl(buildDictionaryIndexPath(language)),
  }))
  return [
    ...alternates.map(alternate => ({
      loc: alternate.href,
      alternates: alternates.length > 1 ? alternates : undefined,
    })),
    ...published.flatMap(({ language, works }) =>
      works.map(work => ({ loc: absoluteSiteUrl(buildDictionaryWorkPath(language, work.id)) }))
    ),
  ]
}

/** Every page of the letter lists of a work, then each of its articles. */
export const listDictionaryWorkSitemapUrls = async (
  language: ResourceLanguage,
  work: string
): Promise<SitemapUrl[]> => {
  const published = (await listDictionaryWorks(language)).some(candidate => candidate.id === work)
  if (!published) return []
  const entries = await listDictionaryEntries(language, work)

  const letterCounts = new Map<string, number>()
  for (const entry of entries) {
    const letter = dictionaryLetter(entry.word, language)
    if (letter) letterCounts.set(letter, (letterCounts.get(letter) ?? 0) + 1)
  }
  const letterPages = DICTIONARY_LETTERS.flatMap(letter =>
    Array.from(
      { length: Math.ceil((letterCounts.get(letter) ?? 0) / DICTIONARY_LIST_PAGE_SIZE) },
      (_, index) => buildDictionaryLetterPath(language, work, letter, index + 1)
    )
  )
  const articles = entries.map(entry =>
    buildDictionaryEntryPath({ language, work, entryId: entry.id, word: entry.word })
  )
  return [...letterPages, ...articles].map(path => ({ loc: absoluteSiteUrl(path) }))
}

/** `dictionary-index.xml`, then one sitemap per work: `dictionary-bost-fr.xml`, … */
export const DICTIONARY_SITEMAPS: Record<string, () => Promise<SitemapUrl[]> | SitemapUrl[]> = {
  'dictionary-index.xml': listDictionaryIndexSitemapUrls,
  ...Object.fromEntries(
    RESOURCE_LANGUAGES.flatMap(language =>
      SITEMAP_WORKS[language].map(work => [
        `dictionary-${work}-${language}.xml`,
        () => listDictionaryWorkSitemapUrls(language, work),
      ])
    )
  ),
}
