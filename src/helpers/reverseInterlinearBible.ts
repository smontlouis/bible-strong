import type { InterlinearIdentityKind, InterlinearToken } from './interlinearBibleSidecar'
import { getDisplayedStrongIdentities, getStrongReferenceNumber } from './strongIdentities'
import type { StrongBibleSpan } from './canonicalStrongVerse'

export interface ReverseInterlinearSourceToken extends InterlinearToken {
  surface: string
  lexicalFallback?: boolean
}

export interface ReverseInterlinearSpan extends StrongBibleSpan {
  sourceTokens: ReverseInterlinearSourceToken[]
}

export interface ReverseInterlinearLexicalEntry {
  Code: string | number
  Hebreu: string
  Grec: string
  Phonetique: string
}

export const buildReverseInterlinearSpans = ({
  originalText,
  targetSpans,
  sourceTokens,
  lexicalEntries,
}: {
  originalText: string
  targetSpans: StrongBibleSpan[]
  sourceTokens: InterlinearToken[]
  lexicalEntries: ReverseInterlinearLexicalEntry[]
}): ReverseInterlinearSpan[] => {
  const sourceTokensById = new Map(
    sourceTokens.flatMap(token => (token.id == null ? [] : [[token.id, token] as const]))
  )
  const lexicalEntriesByCode = new Map(
    lexicalEntries.map(entry => [canonicalStrongNumber(entry.Code), entry] as const)
  )

  return targetSpans.map(span => {
    const resolvedTokens = (span.stepTokenIds ?? [])
      .flatMap(id => {
        const token = sourceTokensById.get(id)
        if (!token) return []
        const tokenEnd = token.startOffset + token.length
        if (token.startOffset < 0 || token.length < 0 || tokenEnd > originalText.length) return []
        return [
          {
            ...token,
            surface: originalText.slice(token.startOffset, tokenEnd),
          },
        ]
      })
      .sort((left, right) => left.ordinal - right.ordinal || (left.id ?? 0) - (right.id ?? 0))
    const coveredStrongNumbers = new Set(
      resolvedTokens.flatMap(token =>
        token.segments.flatMap(segment =>
          getDisplayedStrongIdentities(segment.identities).flatMap(identity => {
            const reference = getStrongReferenceNumber(identity.code)
            return reference ? [reference] : []
          })
        )
      )
    )

    return {
      ...span,
      sourceTokens: [
        ...resolvedTokens,
        ...createLexicalFallbackTokens(
          span,
          lexicalEntriesByCode,
          coveredStrongNumbers,
          resolvedTokens.length
        ),
      ],
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

const createLexicalFallbackTokens = (
  span: StrongBibleSpan,
  lexicalEntriesByCode: Map<string, ReverseInterlinearLexicalEntry>,
  coveredStrongNumbers: Set<string>,
  ordinalOffset: number
): ReverseInterlinearSourceToken[] =>
  getDisplayedStrongIdentities(span.identities).flatMap((identity, fallbackOrdinal) => {
    const strongNumber = getStrongReferenceNumber(identity.code)
    if (!strongNumber) return []
    if (coveredStrongNumbers.has(strongNumber)) return []
    const entry = lexicalEntriesByCode.get(strongNumber)
    if (!entry) return []
    const surface = entry.Hebreu || entry.Grec
    if (!surface) return []
    return [
      {
        ordinal: ordinalOffset + fallbackOrdinal,
        startOffset: 0,
        length: surface.length,
        surface,
        lexicalFallback: true,
        segments: [
          {
            ordinal: 0,
            startOffset: 0,
            length: surface.length,
            transliteration: entry.Phonetique,
            lemma: surface,
            morphology: '',
            gloss: '',
            identities: [
              {
                kind: identity.kind as InterlinearIdentityKind,
                code: identity.code,
              },
            ],
          },
        ],
      },
    ]
  })

const canonicalStrongNumber = (code: string | number): string =>
  getStrongReferenceNumber(code) ?? String(code)
