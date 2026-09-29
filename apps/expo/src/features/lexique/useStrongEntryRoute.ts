import { useEffect, useState } from 'react'
import { getSimpleStrongModuleId } from '@bible-strong/resource-domain/strong-lexicon'
import { getPrimaryStrongLexiconAvailability } from '~features/resources/layeredStrongLexiconAccess'
import { useQuery } from '@tanstack/react-query'

import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { normalizeStrongRouteIdentity } from './strongRouteIdentity'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'

export const useStrongEntryRoute = (context: StrongDetailRouteContext, progressive = false) => {
  const resources = useResourceAccess()
  const languageState = useStrongLexiconLanguage()
  const identity = normalizeStrongRouteIdentity(context)
  const coreAvailability = useQuery({
    queryKey: ['strong-lexicon', 'availability', getSimpleStrongModuleId(languageState.language)],
    queryFn: () =>
      getPrimaryStrongLexiconAvailability(resources.strongLexicon, languageState.language),
    networkMode: 'always',
  })
  const staged = progressive && Boolean(resources.strongLexicon.loadEntryExtras)
  const entryKey = JSON.stringify([languageState.language, identity])
  const [paintedEntryKey, setPaintedEntryKey] = useState<string>()
  const entryQuery = useQuery({
    queryKey: [
      'strong-lexicon',
      'entry',
      languageState.language,
      identity,
      ...(staged ? ['definitions'] : []),
    ],
    queryFn: () =>
      resources.strongLexicon.loadEntry(
        identity!,
        languageState.language,
        staged ? { content: 'definitions' } : undefined
      ),
    enabled: Boolean(identity),
    networkMode: 'always',
  })

  const initialReady = Boolean(entryQuery.data) && coreAvailability.data?.status === 'available'
  useEffect(() => {
    if (!staged || !initialReady) return
    // Let the essential view paint before starting automatic background reads.
    // Cancel both frames when navigating so another entry cannot enable these reads.
    let secondFrame: number | undefined
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setPaintedEntryKey(entryKey))
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame)
    }
  }, [staged, initialReady, entryKey])
  const backgroundReady = initialReady && (!staged || paintedEntryKey === entryKey)
  const canLoadExtras = staged && entryQuery.data?.detailedEntryAvailable !== false
  const extrasQuery = useQuery({
    queryKey: ['strong-lexicon', 'entry-extras', languageState.language, identity],
    queryFn: () => resources.strongLexicon.loadEntryExtras!(identity!, languageState.language),
    enabled: canLoadExtras && backgroundReady,
    networkMode: 'always',
  })
  // Extras never replace lexical text, relations or identity: Essential stays stable.
  const entry =
    entryQuery.data && canLoadExtras && extrasQuery.data
      ? { ...entryQuery.data, ...extrasQuery.data }
      : entryQuery.data

  return {
    resources,
    identity,
    coreAvailability,
    entryQuery,
    entry,
    backgroundReady,
    extrasLoading: canLoadExtras && initialReady && extrasQuery.isPending,
    extrasError: canLoadExtras && extrasQuery.isError,
    retryExtras: extrasQuery.refetch,
    languageState,
  }
}
