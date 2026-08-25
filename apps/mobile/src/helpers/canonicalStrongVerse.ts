import type { Verse } from '~common/types'
import {
  areStrongIdentitiesEqual,
  getDisplayedStrongIdentities,
  getStrongReferenceNumber,
  type StrongIdentity,
} from './strongIdentities'

export type {
  StrongBibleIdentityKind,
  StrongBibleSpan,
} from '@bible-strong/resource-domain/strong-bible'

export type CanonicalStrongVerseRun =
  | { kind: 'text'; text: string }
  | {
      kind: 'strong'
      word: string
      contextWord?: string
      identities: StrongIdentity[]
      isUntranslated: boolean
      morphologies?: NonNullable<Verse['StrongSpans']>[number]['morphologies']
    }

const matchesReference = (identity: StrongIdentity, reference?: string | number) =>
  reference == null ||
  getStrongReferenceNumber(identity.code) === getStrongReferenceNumber(reference)

export const buildCanonicalStrongVerseRuns = (
  text: string,
  spans: Verse['StrongSpans'] = [],
  reference?: string | number
): CanonicalStrongVerseRun[] => {
  const matchingSpans = spans
    .map(span => ({
      ...span,
      identities: getDisplayedStrongIdentities(span.identities).filter(identity =>
        matchesReference(identity, reference)
      ),
    }))
    .filter(span => span.identities.length > 0)
    .sort(
      (left, right) =>
        left.startOffset - right.startOffset ||
        left.length - right.length ||
        left.ordinal - right.ordinal
    )

  const mergedSpans = matchingSpans.reduce<typeof matchingSpans>((merged, span) => {
    const endOffset = span.startOffset + span.length
    const previous = merged[merged.length - 1]
    const previousEndOffset = previous ? previous.startOffset + previous.length : -1
    if (span.length > 0 && previous?.length && previousEndOffset === endOffset) {
      for (const identity of span.identities) {
        if (!previous.identities.some(candidate => areStrongIdentitiesEqual(candidate, identity))) {
          previous.identities.push(identity)
        }
      }
      previous.morphologies = [...(previous.morphologies ?? []), ...(span.morphologies ?? [])]
      return merged
    }
    merged.push({ ...span, identities: [...span.identities] })
    return merged
  }, [])

  const runs: CanonicalStrongVerseRun[] = []
  let offset = 0
  let previousStrongOffset = 0
  for (const span of mergedSpans) {
    const endOffset = span.startOffset + span.length
    if (span.startOffset < offset || span.startOffset < 0 || endOffset > text.length) {
      continue
    }
    const precedingText = text.slice(offset, span.startOffset)
    if (precedingText) runs.push({ kind: 'text', text: precedingText })

    const previousRun = runs[runs.length - 1]
    if (previousRun?.kind === 'strong' && span.length === 0 && span.startOffset === offset) {
      for (const identity of span.identities) {
        if (
          !previousRun.identities.some(candidate => areStrongIdentitiesEqual(candidate, identity))
        ) {
          previousRun.identities.push(identity)
        }
      }
    } else {
      runs.push({
        kind: 'strong',
        word: text.slice(span.startOffset, endOffset),
        ...(span.length > 0
          ? {
              contextWord:
                text
                  .slice(previousStrongOffset, endOffset)
                  .trim()
                  .replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '') || undefined,
            }
          : {}),
        identities: span.identities,
        isUntranslated: span.length === 0,
        ...(span.morphologies?.length ? { morphologies: span.morphologies } : {}),
      })
    }
    previousStrongOffset = endOffset
    offset = endOffset
  }

  const trailingText = text.slice(offset)
  if (trailingText) runs.push({ kind: 'text', text: trailingText })
  return runs
}
