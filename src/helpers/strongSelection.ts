import type { SelectedCode } from '~common/types'
import {
  areStrongIdentitiesEqual,
  getStrongReferenceNumber,
  STRONG_IDENTITY_KINDS,
  type StrongIdentity,
} from './strongIdentities'

export type StrongSelection = SelectedCode & {
  version: string
  identities: StrongIdentity[]
  word?: string
  chapter?: number
  verse?: number
}

const normalizeStrongIdentity = (
  identity: StrongIdentity,
  book: number
): StrongIdentity | undefined => {
  const code = identity.code.trim()
  const normalizedCode = /^[HG]\d+[A-Z]*$/iu.test(code)
    ? code.toUpperCase()
    : /^\d+$/u.test(code)
      ? `${book <= 39 ? 'H' : 'G'}${code}`
      : undefined

  if (!normalizedCode) return undefined

  return { kind: identity.kind, code: normalizedCode }
}

const isStrongIdentityKind = (kind: unknown): kind is StrongIdentity['kind'] =>
  typeof kind === 'string' &&
  STRONG_IDENTITY_KINDS.includes(kind as (typeof STRONG_IDENTITY_KINDS)[number])

const isStrongIdentity = (identity: unknown): identity is StrongIdentity => {
  if (typeof identity !== 'object' || identity === null) return false
  const candidate = identity as Record<string, unknown>
  return isStrongIdentityKind(candidate.kind) && typeof candidate.code === 'string'
}

export const createStrongSelection = (
  identities: readonly StrongIdentity[],
  bookValue: string | number,
  versionValue: string,
  context: { word?: string; chapter?: string | number; verse?: string | number } = {}
): StrongSelection | undefined => {
  const book = Number(bookValue)
  const version = versionValue.trim()
  if (!Number.isInteger(book) || book < 1 || book > 66) return undefined
  if (!version) return undefined

  const normalizedIdentities: StrongIdentity[] = []
  for (const identity of identities) {
    const normalized = normalizeStrongIdentity(identity, book)
    if (
      normalized &&
      !normalizedIdentities.some(candidate => areStrongIdentitiesEqual(candidate, normalized))
    ) {
      normalizedIdentities.push(normalized)
    }
  }
  const reference = getStrongReferenceNumber(normalizedIdentities[0]?.code ?? '')

  if (!reference || normalizedIdentities.length === 0) return undefined

  const chapter = Number(context.chapter)
  const verse = Number(context.verse)
  const word = context.word?.trim()
  return {
    book,
    reference,
    identities: normalizedIdentities,
    version,
    ...(word ? { word } : {}),
    ...(Number.isInteger(chapter) && chapter > 0 ? { chapter } : {}),
    ...(Number.isInteger(verse) && verse > 0 ? { verse } : {}),
  }
}

export const getStrongSelectionPayload = (payload: unknown): StrongSelection | undefined => {
  if (typeof payload !== 'object' || payload === null) return undefined

  const candidate = payload as Record<string, unknown>
  if (!Array.isArray(candidate.identities) || !candidate.identities.every(isStrongIdentity)) {
    return undefined
  }
  if (typeof candidate.book !== 'number' && typeof candidate.book !== 'string') return undefined
  if (typeof candidate.version !== 'string') return undefined

  return createStrongSelection(candidate.identities, candidate.book, candidate.version, {
    word: typeof candidate.word === 'string' ? candidate.word : undefined,
    chapter:
      typeof candidate.chapter === 'number' || typeof candidate.chapter === 'string'
        ? candidate.chapter
        : undefined,
    verse:
      typeof candidate.verse === 'number' || typeof candidate.verse === 'string'
        ? candidate.verse
        : undefined,
  })
}
