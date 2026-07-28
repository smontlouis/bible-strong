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
  morphologies?: StrongSelectionMorphology[]
  word?: string
  chapter?: number
  verse?: number
}

export type StrongSelectionMorphology = {
  identity: StrongIdentity
  codes: string[]
}

export type StrongSelectionMorphologySource = {
  identities: readonly StrongIdentity[]
  morphology?: string
}

export type StrongSelectionContext = {
  word?: string
  chapter?: string | number
  verse?: string | number
  morphologies?: readonly StrongSelectionMorphology[]
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

const isStrongSelectionMorphology = (
  morphology: unknown
): morphology is StrongSelectionMorphology => {
  if (typeof morphology !== 'object' || morphology === null) return false
  const candidate = morphology as Record<string, unknown>
  return (
    isStrongIdentity(candidate.identity) &&
    Array.isArray(candidate.codes) &&
    candidate.codes.every(code => typeof code === 'string')
  )
}

const getStrongIdentityFamily = (identity: StrongIdentity): string => {
  const prefix = identity.code.trim().toUpperCase().match(/^[HG]/u)?.[0] ?? ''
  const reference = getStrongReferenceNumber(identity.code) ?? identity.code.trim().toUpperCase()
  return `${prefix}:${reference}`
}

export const collectStrongSelectionMorphologies = (
  identities: readonly StrongIdentity[],
  sources: readonly StrongSelectionMorphologySource[]
): StrongSelectionMorphology[] =>
  identities.flatMap(identity => {
    const family = getStrongIdentityFamily(identity)
    const codes = [
      ...new Set(
        sources.flatMap(source => {
          const morphology = source.morphology?.trim()
          if (!morphology) return []
          return source.identities.some(
            sourceIdentity => getStrongIdentityFamily(sourceIdentity) === family
          )
            ? [morphology]
            : []
        })
      ),
    ]
    return codes.length ? [{ identity, codes }] : []
  })

export const getStrongSelectionMorphologyCodes = (
  morphologies: readonly StrongSelectionMorphology[],
  identity: StrongIdentity
): string[] =>
  morphologies.find(morphology => areStrongIdentitiesEqual(morphology.identity, identity))?.codes ??
  []

export const createStrongSelection = (
  identities: readonly StrongIdentity[],
  bookValue: string | number,
  versionValue: string,
  context: StrongSelectionContext = {}
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
  const morphologies: StrongSelectionMorphology[] = []
  for (const morphology of context.morphologies ?? []) {
    const normalizedIdentity = normalizeStrongIdentity(morphology.identity, book)
    const selectedIdentity = normalizedIdentity
      ? normalizedIdentities.find(identity =>
          areStrongIdentitiesEqual(identity, normalizedIdentity)
        )
      : undefined
    if (!selectedIdentity) continue

    const codes = [...new Set(morphology.codes.map(code => code.trim()).filter(Boolean))]
    if (!codes.length) continue

    const existing = morphologies.find(candidate =>
      areStrongIdentitiesEqual(candidate.identity, selectedIdentity)
    )
    if (existing) {
      existing.codes = [...new Set([...existing.codes, ...codes])]
    } else {
      morphologies.push({ identity: selectedIdentity, codes })
    }
  }
  return {
    book,
    reference,
    identities: normalizedIdentities,
    version,
    ...(morphologies.length ? { morphologies } : {}),
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
  if (
    candidate.morphologies !== undefined &&
    (!Array.isArray(candidate.morphologies) ||
      !candidate.morphologies.every(isStrongSelectionMorphology))
  ) {
    return undefined
  }

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
    morphologies: candidate.morphologies as StrongSelectionMorphology[] | undefined,
  })
}
