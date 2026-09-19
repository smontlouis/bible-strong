import { createStrongIdentity, type StrongIdentity } from '~helpers/strongIdentities'
import type { StrongDetailRouteContext } from './strongDetailRoutes'

export type PublicStrongEntryPage = 'index' | 'dictionary' | 'related' | 'concordance'

const PAGE_SUFFIXES: Record<Exclude<PublicStrongEntryPage, 'index'>, string> = {
  dictionary: 'dictionary',
  related: 'related',
  concordance: 'concordance',
}

export const parsePublicStrongCode = (
  value: string | string[] | undefined
): StrongIdentity | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw || !/^[hg]\d+[a-z]*$/iu.test(raw)) return undefined
  const lexicalLanguage = raw[0]?.toLocaleLowerCase() === 'h' ? 'hebrew' : 'greek'
  return createStrongIdentity(raw, lexicalLanguage)
}

export const buildPublicStrongPath = (
  code: string,
  page: PublicStrongEntryPage = 'index'
): string => {
  const identity = parsePublicStrongCode(code)
  if (!identity) throw new Error('PUBLIC_STRONG_ROUTE_INVALID')
  const root = `/strong/${identity.code.toLocaleLowerCase()}`
  return page === 'index' ? root : `${root}/${PAGE_SUFFIXES[page]}`
}

export const buildPublicStrongEntityPath = (uniqueName: string): string => {
  const normalized = uniqueName.trim()
  if (!normalized) throw new Error('PUBLIC_STRONG_ENTITY_ROUTE_INVALID')
  return `/strong/entity/${encodeURIComponent(normalized)}`
}

export const publicStrongContext = (identity: StrongIdentity): StrongDetailRouteContext => ({
  book: identity.code.startsWith('H') ? 1 : 40,
  reference: identity.code,
  identityKind: identity.kind,
  identityCode: identity.code,
})
