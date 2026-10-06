import type { StrongLexiconSearchResponseDto } from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import { absoluteSiteUrl, RESOURCE_LANGUAGES } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import type { SitemapUrl } from '../resources/sitemap'
import { buildStrongPath, parseStrongCode, type StrongLexicalLanguage } from './strongRoutes'

const PAGE_SIZE = 500
// The lexicon holds about 25,000 senses; the cap only guards against a cursor loop.
const MAX_PAGES = 200

/**
 * Lists one page per classical Strong number and language. Disambiguated senses stay
 * reachable through the "other senses" links of their family page.
 */
export const listStrongSitemapUrls = async (
  lexicalLanguage: StrongLexicalLanguage
): Promise<SitemapUrl[]> => {
  const codes = new Set<string>()
  let cursor: string | undefined
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await readResource<StrongLexiconSearchResponseDto>(
      '/v1/strong-lexicon/entries',
      { language: 'fr', lexicalLanguage, limit: PAGE_SIZE, cursor }
    )
    for (const entry of response?.entries ?? []) {
      const identity = parseStrongCode(entry.classicStrong)
      if (identity) codes.add(identity.code)
    }
    cursor = response?.nextCursor
    if (!cursor) break
  }

  return [...codes].sort().flatMap(code => {
    const alternates = RESOURCE_LANGUAGES.map(language => ({
      hrefLang: language,
      href: absoluteSiteUrl(buildStrongPath(language, code)),
    }))
    return alternates.map(alternate => ({ loc: alternate.href, alternates }))
  })
}
