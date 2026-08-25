import {
  createStrongIdentity,
  type StrongIdentity,
  type StrongIdentityKind,
} from '~helpers/strongIdentities'
import type { StrongDetailRouteContext } from './strongDetailRoutes'

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
  const normalized = createStrongIdentity(String(rawCode), (book ?? 1) <= 39 ? 'hebrew' : 'greek')
  return {
    kind: identityKind ?? inferIdentityKind(normalized.code),
    code: normalized.code,
  }
}
