import type { InterlinearToken } from './interlinearBibleSidecar'
import { getDisplayedStrongIdentities, getStrongReferenceNumber } from './strongIdentities'
import type { StrongBibleSpan } from './canonicalStrongVerse'

export interface ReverseInterlinearSourceToken extends InterlinearToken {
  surface: string
}

export interface ReverseInterlinearSpan extends StrongBibleSpan {
  sourceTokens: ReverseInterlinearSourceToken[]
}

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
