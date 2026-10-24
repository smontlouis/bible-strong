import type { StrongBibleSpan } from '~helpers/canonicalStrongVerse'
import {
  areStrongIdentitiesEqual,
  getDisplayedStrongIdentities,
  getStrongReferenceNumber,
  type StrongIdentity,
} from '~helpers/strongIdentities'
import type { AnnotatedWordRange } from './annotationWords'

/** A Hebrew or Greek word under the words the reader selected, with the words that render it. */
export type SelectionStrongWord = {
  key: string
  identity: StrongIdentity
  /** The words of the verse text the entry is aligned with. */
  word: string
  verseKey: string
  morphologyCodes: string[]
}

/**
 * Entries that come with nearly every phrase and say nothing of it on their own: the Greek
 * article, the Hebrew object marker, and the Hebrew prefixes the extended codes number from 9000.
 */
export const isGrammaticalStrongIdentity = (identity: StrongIdentity): boolean => {
  const language = identity.code.trim().charAt(0).toUpperCase()
  const number = Number(getStrongReferenceNumber(identity.code))
  return (
    (language === 'G' && number === 3588) ||
    (language === 'H' && (number === 853 || number >= 9000))
  )
}

/**
 * The entries aligned with the selected words, in reading order, each once. A word the reader
 * only partly selected still counts.
 */
export const collectSelectionStrongWords = (
  ranges: readonly AnnotatedWordRange[],
  spansByVerseKey: Readonly<Record<string, readonly StrongBibleSpan[]>>,
  verseTexts: Readonly<Record<string, string>>
): SelectionStrongWord[] => {
  const words: SelectionStrongWord[] = []
  for (const range of ranges) {
    const text = verseTexts[range.verseKey] ?? ''
    const spans = [...(spansByVerseKey[range.verseKey] ?? [])].sort(
      (left, right) => left.startOffset - right.startOffset || left.ordinal - right.ordinal
    )
    for (const span of spans) {
      const spanEnd = span.startOffset + span.length
      if (span.length === 0 || span.startOffset >= range.charEnd || spanEnd <= range.charStart) {
        continue
      }
      for (const identity of getDisplayedStrongIdentities(span.identities)) {
        if (isGrammaticalStrongIdentity(identity)) continue
        const key = `${identity.kind}:${identity.code}`
        if (words.some(word => word.key === key)) continue
        words.push({
          key,
          identity,
          word: text.slice(span.startOffset, spanEnd),
          verseKey: range.verseKey,
          morphologyCodes:
            span.morphologies
              ?.filter(morphology => areStrongIdentitiesEqual(morphology.identity, identity))
              .flatMap(morphology => morphology.codes) ?? [],
        })
      }
    }
  }
  return words
}
