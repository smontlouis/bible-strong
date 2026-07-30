import { useQuery } from '@tanstack/react-query'

import { useResourceAccess } from '~features/resources/resourceAccess'
import type { StrongIdentity, StrongIdentityKind } from '~helpers/strongIdentities'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { useStrongLexiconLanguage } from './useStrongLexiconLanguage'

const inferIdentityKind = (code: string): StrongIdentityKind =>
  /^[HG]\d+[A-Z]+$/iu.test(code) ? 'dstrong' : 'strong'

export const normalizeStrongRouteIdentity = ({
  identityKind,
  identityCode,
  reference,
  strongReference,
  book,
}: StrongDetailRouteContext): StrongIdentity | undefined => {
  const rawCode = identityCode || reference || strongReference?.Code
  if (!rawCode) return undefined
  const normalized = String(rawCode).trim().toUpperCase()
  const prefixed = /^[HG]/u.test(normalized)
    ? normalized
    : `${(book ?? 1) <= 39 ? 'H' : 'G'}${String(Number(normalized)).padStart(4, '0')}`
  return {
    kind: identityKind ?? inferIdentityKind(prefixed),
    code: prefixed,
  }
}

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
    enabled: Boolean(identity && coreAvailability.data?.status === 'available'),
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
