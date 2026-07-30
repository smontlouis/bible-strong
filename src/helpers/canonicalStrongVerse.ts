import type { Verse } from '~common/types'
import {
  areStrongIdentitiesEqual,
  getDisplayedStrongIdentities,
  getStrongReferenceNumber,
  type StrongIdentity,
} from './strongIdentities'

export type StrongBibleIdentityKind = 'strong' | 'estrong' | 'dstrong' | 'ustrong'

export interface StrongBibleSpan {
  ordinal: number
  startOffset: number
  length: number
  stepTokenIds?: number[]
  identities: {
    kind: StrongBibleIdentityKind
    code: string
  }[]
  morphologies?: import('./strongSelection').StrongSelectionMorphology[]
}

export type CanonicalStrongVerseRun =
  | { kind: 'text'; text: string }
  | {
      kind: 'strong'
      word: string
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

  const runs: CanonicalStrongVerseRun[] = []
  let offset = 0
  for (const span of matchingSpans) {
    const endOffset = span.startOffset + span.length
    if (span.startOffset < offset || span.startOffset < 0 || endOffset > text.length) {
      continue
    }
    const precedingText = text.slice(offset, span.startOffset)
    if (precedingText) runs.push({ kind: 'text', text: precedingText })

    const previousRun = runs[runs.length - 1]
    if (
      previousRun?.kind === 'strong' &&
      span.length === 0 &&
      previousRun.isUntranslated &&
      span.startOffset === offset
    ) {
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
        identities: span.identities,
        isUntranslated: span.length === 0,
        ...(span.morphologies?.length ? { morphologies: span.morphologies } : {}),
      })
    }
    offset = endOffset
  }

  const trailingText = text.slice(offset)
  if (trailingText) runs.push({ kind: 'text', text: trailingText })
  return runs
}
