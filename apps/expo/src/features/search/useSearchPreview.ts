import { useAppendOnlySearchResults } from './useAppendOnlySearchResults'
import { useQueries } from '@tanstack/react-query'
import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { useResourceAccess } from '~features/resources/resourceAccess'
import useConnection from '~helpers/useConnection'
import useDebounce from '~helpers/useDebounce'
import type { RootState } from '~redux/modules/reducer'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'
import type { SearchItemType } from '~state/searchFilters'
import { searchWithMatches } from './shared/searchFuzzy'
import {
  getSortedLinkSearchItems,
  getSortedNoteSearchItems,
  getSortedStudySearchItems,
} from './shared/searchItems'
import type { SearchEntityResult } from './shared/searchResultTypes'
import { SEARCH_MIN_QUERY_LENGTH } from './searchResultsModel'
import { loadSearchPreview, publicPreviewSources, SEARCH_PREVIEW_LIMIT } from './searchPreview'

export type SearchPreviewSection = {
  source: SearchItemType
  enriching?: boolean
  items: SearchEntityResult[]
  hasMore: boolean
  loading: boolean
  error: boolean
}

export function useSearchPreview(
  query: string,
  version: string,
  selectedSource?: SearchItemType,
  limit = SEARCH_PREVIEW_LIMIT
) {
  const { t, i18n } = useTranslation()
  const resources = useResourceAccess()
  const languages = useAtomValue(resourcesLanguageAtom)
  const isConnected = useConnection()
  const notes = useSelector((state: RootState) => state.user.bible.notes)
  const studies = useSelector((state: RootState) => state.user.bible.studies)
  const links = useSelector((state: RootState) => state.user.bible.links)
  const debouncedQuery = useDebounce(query.trim(), 350)
  const ready =
    query.trim() === debouncedQuery &&
    (debouncedQuery.length >= SEARCH_MIN_QUERY_LENGTH ||
      (Boolean(selectedSource) && !debouncedQuery))
  const sources = publicPreviewSources.filter(
    source => !selectedSource || source === selectedSource
  )
  const requests = sources.flatMap<{
    source: (typeof sources)[number]
    mode: 'standard' | 'semantic'
  }>(source =>
    source === 'passages' && isConnected
      ? [
          { source, mode: 'standard' as const },
          { source, mode: 'semantic' as const },
        ]
      : [{ source, mode: 'standard' as const }]
  )
  const queries = useQueries({
    queries: requests.map(({ source, mode }) => ({
      queryKey: [
        'search-preview-v2',
        limit,
        source,
        mode,
        debouncedQuery,
        version,
        languages,
        i18n.language,
        isConnected,
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        loadSearchPreview({
          resources,
          limit,
          source,
          mode,
          query: debouncedQuery,
          version,
          languages,
          parserLanguage: i18n.language.startsWith('fr') ? 'fr' : 'en',
          signal,
          t,
        }),
      enabled: ready,
      staleTime: 30_000,
      networkMode: 'always' as const,
      retry: false,
    })),
  })
  // User-owned content stays in the Redux-backed local search path, never in remote query keys.
  const privateSections: SearchPreviewSection[] = ready
    ? [
        {
          source: 'notes' as const,
          items:
            !selectedSource || selectedSource === 'notes'
              ? debouncedQuery
                ? searchWithMatches(getSortedNoteSearchItems(notes, t), debouncedQuery)
                : getSortedNoteSearchItems(notes, t)
              : [],
        },
        {
          source: 'studies' as const,
          items:
            !selectedSource || selectedSource === 'studies'
              ? debouncedQuery
                ? searchWithMatches(getSortedStudySearchItems(studies, t), debouncedQuery)
                : getSortedStudySearchItems(studies, t)
              : [],
        },
        {
          source: 'links' as const,
          items:
            !selectedSource || selectedSource === 'links'
              ? debouncedQuery
                ? searchWithMatches(getSortedLinkSearchItems(links, t), debouncedQuery)
                : getSortedLinkSearchItems(links, t)
              : [],
        },
      ].map(section => ({
        ...section,
        items: section.items.slice(0, limit),
        hasMore: section.items.length > limit,
        loading: false,
        error: false,
      }))
    : []
  const standardIndex = requests.findIndex(
    request => request.source === 'passages' && request.mode === 'standard'
  )
  const semanticIndex = requests.findIndex(request => request.mode === 'semantic')
  const standard = queries[standardIndex]
  const semantic = queries[semanticIndex]
  const passageItems = useAppendOnlySearchResults(
    JSON.stringify([debouncedQuery, version, languages, i18n.language, isConnected]),
    ready
      ? [
          ...(standard?.data?.items ?? []),
          ...(!standard?.isPending || standard?.isError ? (semantic?.data?.items ?? []) : []),
        ]
      : [],
    item => item.id
  )
  const publicSections: SearchPreviewSection[] = ready
    ? requests.flatMap((request, index) => {
        if (request.mode === 'semantic') return []
        const result = queries[index]
        const passages = request.source === 'passages'
        return [
          {
            source: request.source,
            items: passages ? passageItems : (result.data?.items.slice(0, limit) ?? []),
            hasMore: Boolean(result.data?.hasMore || (passages && semantic?.data?.hasMore)),
            loading: result.isFetching,
            enriching: passages && Boolean(semantic?.isFetching),
            error: result.isError && (!passages || passageItems.length === 0),
          },
        ]
      })
    : []
  return {
    waiting: query.trim().length >= SEARCH_MIN_QUERY_LENGTH && !ready,
    sections: [...privateSections, ...publicSections].filter(
      section => section.items.length || section.loading || section.enriching || section.error
    ),
  }
}
