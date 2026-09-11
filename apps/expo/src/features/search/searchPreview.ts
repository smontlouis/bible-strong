import type { ResourceAccessRegistry } from '~features/resources/resourceAccess'
import { getBibleVersionCanonId } from '~helpers/bibleVersions'
import { isExactBibleReferenceInput, type BcvLanguage } from '~helpers/bcvParser'
import { parseStrongReference } from '~helpers/bibleSearchInput'
import { createStrongIdentity } from '~helpers/strongIdentities'
import type { SearchFilters, SearchItemType } from '~state/searchFilters'
import type { SearchEntityResult } from './shared/searchResultTypes'
import {
  getDictionarySearchItems,
  getNaveSearchItems,
  getPassageSearchItems,
  getStrongSearchItems,
} from './shared/searchItems'

export const SEARCH_PREVIEW_LIMIT = 3
export const publicPreviewSources = ['passages', 'strong', 'dictionary', 'nave'] as const
export type PublicPreviewSource = (typeof publicPreviewSources)[number]
export type SearchPreviewPage = { items: SearchEntityResult[]; hasMore: boolean }

export function createPreviewSearchFilters(
  version: string,
  source?: SearchItemType
): SearchFilters {
  return {
    section: '',
    canon: '',
    book: 0,
    selectedVersion: version,
    sortOrder: 'relevance',
    itemFilters: {
      commentary: !source || source === 'commentary',
      plan: !source || source === 'plan',
      timeline: !source || source === 'timeline',
      passages: !source || source === 'passages',
      notes: !source || source === 'notes',
      studies: !source || source === 'studies',
      links: !source || source === 'links',
      strong: !source || source === 'strong',
      dictionary: !source || source === 'dictionary',
      nave: !source || source === 'nave',
    },
  }
}

export async function loadSearchPreview({
  resources,
  limit = SEARCH_PREVIEW_LIMIT,
  source,
  query,
  version,
  languages,
  parserLanguage,
  mode,
  signal,
  t,
}: {
  resources: {
    bibleSearch: Pick<ResourceAccessRegistry['bibleSearch'], 'searchPage'>
    strongLexicon: Pick<ResourceAccessRegistry['strongLexicon'], 'loadPreview' | 'listEntries'>
    dictionary: Pick<ResourceAccessRegistry['dictionary'], 'searchPage' | 'listByLetterPage'>
    nave: Pick<ResourceAccessRegistry['nave'], 'searchPage' | 'listByLetterPage'>
  }
  limit?: number
  source: PublicPreviewSource
  mode?: 'standard' | 'semantic'
  query: string
  version: string
  languages: { STRONG: 'fr' | 'en'; DICTIONNAIRE: 'fr' | 'en'; NAVE: 'fr' | 'en' }
  parserLanguage?: BcvLanguage
  signal: AbortSignal
  t: (key: string) => string
}): Promise<SearchPreviewPage> {
  switch (source) {
    case 'passages': {
      if (parseStrongReference(query) || isExactBibleReferenceInput(query, parserLanguage))
        return { items: [], hasMore: false }
      const page = await resources.bibleSearch.searchPage(query, {
        mode,
        signal,
        limit,
        offset: 0,
        sortOrder: 'relevance',
        version,
        canon: getBibleVersionCanonId(version),
        searchLanguage: languages.NAVE,
      })
      return {
        items: getPassageSearchItems(page.results),
        hasMore: page.count > page.results.length,
      }
    }
    case 'strong': {
      const reference = parseStrongReference(query)
      if (reference) {
        const entries = await resources.strongLexicon.loadPreview(
          [createStrongIdentity(reference.number, reference.language)],
          languages.STRONG
        )
        return { items: getStrongSearchItems(entries, t), hasMore: false }
      }
      const page = await resources.strongLexicon.listEntries({
        signal,
        language: languages.STRONG,
        limit,
        ...(query ? { search: query } : { prefix: 'a' }),
      })
      return { items: getStrongSearchItems(page.entries, t), hasMore: Boolean(page.nextCursor) }
    }
    case 'dictionary': {
      const page = query
        ? await resources.dictionary.searchPage(query, { signal, limit }, languages.DICTIONNAIRE)
        : await resources.dictionary.listByLetterPage(
            'a',
            { signal, limit },
            languages.DICTIONNAIRE
          )
      return { items: getDictionarySearchItems(page.entries), hasMore: Boolean(page.nextCursor) }
    }
    case 'nave': {
      const page = query
        ? await resources.nave.searchPage(query, { signal, limit }, languages.NAVE)
        : await resources.nave.listByLetterPage('a', { signal, limit }, languages.NAVE)
      return { items: getNaveSearchItems(page.topics), hasMore: Boolean(page.nextCursor) }
    }
  }
}
