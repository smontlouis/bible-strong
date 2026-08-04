import { useQuery } from '@tanstack/react-query'

import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { normalizeStrongRouteIdentity } from './strongRouteIdentity'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'

export const useStrongEntryRoute = (context: StrongDetailRouteContext) => {
  const resources = useResourceAccess()
  const languageState = useStrongLexiconLanguage()
  const identity = normalizeStrongRouteIdentity(context)
  const coreAvailability = useQuery({
    queryKey: ['strong-lexicon', 'availability', 'core'],
    queryFn: () => resources.strongLexicon.getModuleAvailability('core'),
    networkMode: 'always',
  })
  const entryQuery = useQuery({
    queryKey: ['strong-lexicon', 'entry', languageState.language, identity],
    queryFn: () => resources.strongLexicon.loadEntry(identity!, languageState.language),
    enabled: Boolean(identity),
    networkMode: 'always',
  })

  return {
    resources,
    identity,
    coreAvailability,
    entryQuery,
    entry: entryQuery.data,
    languageState,
  }
}
