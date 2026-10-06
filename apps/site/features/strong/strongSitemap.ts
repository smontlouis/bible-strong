import type { StrongLexiconSearchResponseDto } from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import { absoluteSiteUrl, RESOURCE_LANGUAGES } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import type { SitemapUrl } from '../resources/sitemap'
import { listStrongLetters } from './strong.functions'
import {
  buildStrongIndexPath,
  buildStrongLetterPath,
  buildStrongPath,
  STRONG_LEXICONS,
  type StrongLexicalLanguage,
} from './strongRoutes'
import {
  EVERY_STRONG_SENSE,
  strongEntryPageCodes,
  toStrongSenseRef,
  type StrongSenseRef,
} from './strongSenses'

const PAGE_SIZE = 500
// The lexicon holds about 25,000 senses; the cap only guards against a cursor loop.
const MAX_PAGES = 200

/**
 * Lists the entry page of every classical number, in each language: the page of the number
 * where the lexicon splits it into senses, its one sense otherwise. The senses of a split
 * number are reached from its page.
 */
export const listStrongSitemapUrls = async (
  lexicalLanguage: StrongLexicalLanguage
): Promise<SitemapUrl[]> => {
  const senses = new Map<string, StrongSenseRef>()
  let cursor: string | undefined
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await readResource<StrongLexiconSearchResponseDto>(
      '/v1/strong-lexicon/entries',
      { language: 'fr', lexicalLanguage, ...EVERY_STRONG_SENSE, limit: PAGE_SIZE, cursor }
    )
    for (const entry of response?.entries ?? []) {
      const sense = toStrongSenseRef(entry)
      if (sense) senses.set(sense.code, sense)
    }
    cursor = response?.nextCursor
    if (!cursor) break
  }

  return strongEntryPageCodes([...senses.values()]).sort().flatMap(code => {
    const alternates = RESOURCE_LANGUAGES.map(language => ({
      hrefLang: language,
      href: absoluteSiteUrl(buildStrongPath(language, code)),
    }))
    return alternates.map(alternate => ({ loc: alternate.href, alternates }))
  })
}

/** The lexicon of each language and its letter pages. */
export const listStrongIndexSitemapUrls = async (): Promise<SitemapUrl[]> => {
  const alternates = RESOURCE_LANGUAGES.map(language => ({
    hrefLang: language,
    href: absoluteSiteUrl(buildStrongIndexPath(language)),
  }))
  const letterPages = await Promise.all(
    RESOURCE_LANGUAGES.flatMap(language =>
      STRONG_LEXICONS.map(async lexicon =>
        (await listStrongLetters(language, lexicon)).map(letter => ({
          loc: absoluteSiteUrl(buildStrongLetterPath(language, lexicon, letter)),
        }))
      )
    )
  )
  return [...alternates.map(alternate => ({ loc: alternate.href, alternates })), ...letterPages.flat()]
}
