import type { InterlinearToken } from './interlinearBibleSidecar'
import { getDisplayedStrongIdentities, getStrongReferenceNumber } from './strongIdentities'
import type { StrongBibleSpan } from './canonicalStrongVerse'

export interface ReverseInterlinearSourceToken extends InterlinearToken {
  surface: string
}

export interface ReverseInterlinearSpan extends StrongBibleSpan {
  sourceTokens: ReverseInterlinearSourceToken[]
}

export type ReverseInterlinearReconciliationDiagnostics = {
  inferredAssociationCount: number
  missingExplicitTokenIds: number[]
  duplicateExplicitTokenIds: number[]
  incompatibleExplicitAssociations: string[]
  unresolvedStrongReferences: string[]
}

type ChapterSourceToken = ReverseInterlinearSourceToken & { verse: number }

export const buildReverseInterlinearSpans = ({
  targetSpans,
  sourceTokens,
}: {
  targetSpans: StrongBibleSpan[]
  sourceTokens: ReverseInterlinearSourceToken[]
}): ReverseInterlinearSpan[] => {
  const sourceTokensById = new Map(
    sourceTokens.flatMap(token => (token.id == null ? [] : [[token.id, token] as const]))
  )
  return targetSpans.map(span => {
    const resolvedTokens = (span.stepTokenIds ?? [])
      .flatMap(id => {
        const token = sourceTokensById.get(id)
        if (!token) return []
        return token ? [token] : []
      })
      .sort((left, right) => left.ordinal - right.ordinal || (left.id ?? 0) - (right.id ?? 0))
    return {
      ...span,
      sourceTokens: resolvedTokens,
    }
  })
}

export const getMissingReverseInterlinearStrongCodes = (span: ReverseInterlinearSpan): string[] => {
  const coveredStrongNumbers = new Set(
    span.sourceTokens.flatMap(token =>
      token.segments.flatMap(segment =>
        getDisplayedStrongIdentities(segment.identities).flatMap(identity => {
          const reference = getStrongReferenceNumber(identity.code)
          return reference ? [reference] : []
        })
      )
    )
  )
  return getDisplayedStrongIdentities(span.identities)
    .flatMap(identity => {
      const reference = getStrongReferenceNumber(identity.code)
      return reference ? [reference] : []
    })
    .filter(code => !coveredStrongNumbers.has(code))
}

const getSourceTokenStrongReferences = (token: ReverseInterlinearSourceToken): Set<string> =>
  new Set(
    token.segments.flatMap(segment =>
      getDisplayedStrongIdentities(segment.identities).flatMap(identity => {
        const reference = getStrongReferenceNumber(identity.code)
        return reference ? [reference] : []
      })
    )
  )

/**
 * Keeps explicit publication links authoritative, then repairs omitted links by pairing the
 * remaining target/source Strong occurrences in a stable order. Incomplete data remains visible:
 * diagnostics are returned to developers instead of turning the whole presentation into an error.
 */
export const reconcileReverseInterlinearChapter = ({
  targetSpansByVerse,
  sourceTokens,
}: {
  targetSpansByVerse: Record<number, StrongBibleSpan[]>
  sourceTokens: ChapterSourceToken[]
}): {
  spansByVerse: Record<number, ReverseInterlinearSpan[]>
  diagnostics: ReverseInterlinearReconciliationDiagnostics
} => {
  const sourceTokensById = new Map(
    sourceTokens.flatMap(token => (token.id == null ? [] : [[token.id, token] as const]))
  )
  const sourceReferences = new Map(
    sourceTokens.map(token => [token, getSourceTokenStrongReferences(token)] as const)
  )
  const claimedTokens = new Set<ReverseInterlinearSourceToken>()
  const missingExplicitTokenIds = new Set<number>()
  const duplicateExplicitTokenIds = new Set<number>()
  const incompatibleExplicitAssociations: string[] = []
  const orderedTargets = Object.entries(targetSpansByVerse)
    .sort(([left], [right]) => Number(left) - Number(right))
    .flatMap(([verse, spans]) =>
      [...spans]
        .sort((left, right) => left.ordinal - right.ordinal)
        .map(span => ({ verse: Number(verse), span }))
    )
  const resolvedBySpan = new Map<StrongBibleSpan, ChapterSourceToken[]>()

  for (const { verse, span } of orderedTargets) {
    const resolved = (span.stepTokenIds ?? []).flatMap(id => {
      const token = sourceTokensById.get(id)
      if (!token) {
        missingExplicitTokenIds.add(id)
        return []
      }
      if (claimedTokens.has(token)) {
        duplicateExplicitTokenIds.add(id)
        return []
      }
      claimedTokens.add(token)
      const targetReferences = new Set(
        getDisplayedStrongIdentities(span.identities).flatMap(identity => {
          const reference = getStrongReferenceNumber(identity.code)
          return reference ? [reference] : []
        })
      )
      if (![...sourceReferences.get(token)!].some(reference => targetReferences.has(reference))) {
        incompatibleExplicitAssociations.push(`${verse}:${span.ordinal}:${id}`)
      }
      return [token]
    })
    resolvedBySpan.set(span, [...new Set(resolved)])
  }

  let inferredAssociationCount = 0
  const unresolvedStrongReferences: string[] = []
  const orderedSourceTokens = [...sourceTokens].sort(
    (left, right) =>
      left.verse - right.verse ||
      left.ordinal - right.ordinal ||
      (left.id ?? Number.MAX_SAFE_INTEGER) - (right.id ?? Number.MAX_SAFE_INTEGER)
  )

  for (const { verse, span } of orderedTargets) {
    const resolved = resolvedBySpan.get(span) ?? []
    for (const reference of getMissingReverseInterlinearStrongCodes({
      ...span,
      sourceTokens: resolved,
    })) {
      if (
        !getMissingReverseInterlinearStrongCodes({ ...span, sourceTokens: resolved }).includes(
          reference
        )
      ) {
        continue
      }
      const candidate = orderedSourceTokens.find(
        token => !claimedTokens.has(token) && sourceReferences.get(token)?.has(reference)
      )
      if (!candidate) {
        unresolvedStrongReferences.push(`${verse}:${span.ordinal}:${reference}`)
        continue
      }
      resolved.push(candidate)
      claimedTokens.add(candidate)
      inferredAssociationCount += 1
    }
    resolved.sort(
      (left, right) =>
        left.verse - right.verse || left.ordinal - right.ordinal || (left.id ?? 0) - (right.id ?? 0)
    )
  }

  return {
    spansByVerse: Object.fromEntries(
      Object.entries(targetSpansByVerse).map(([verse, spans]) => [
        verse,
        spans.map(span => ({ ...span, sourceTokens: resolvedBySpan.get(span) ?? [] })),
      ])
    ),
    diagnostics: {
      inferredAssociationCount,
      missingExplicitTokenIds: [...missingExplicitTokenIds].sort((left, right) => left - right),
      duplicateExplicitTokenIds: [...duplicateExplicitTokenIds].sort((left, right) => left - right),
      incompatibleExplicitAssociations,
      unresolvedStrongReferences,
    },
  }
}
