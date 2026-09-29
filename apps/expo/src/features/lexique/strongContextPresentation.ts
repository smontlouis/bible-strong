import type { Verse } from '~common/types'
import type { StrongLexiconMorphology } from '~features/resources/strongLexiconAccess'
import { getStrongReferenceNumber } from '~helpers/strongIdentities'

export const getStrongContextVerseText = (verse: Verse): string => verse.Texte

const lowerFirst = (value: string): string =>
  value ? `${value[0].toLocaleLowerCase()}${value.slice(1)}` : value

export const formatStrongContextMorphology = (
  morphology: Pick<StrongLexiconMorphology, 'code' | 'meaning'>
): string => `${lowerFirst(morphology.meaning)} · ${morphology.code}`

type StrongContextEntry = {
  stepCode: string
  dStrong?: string
  eStrong?: string
  baseCode: string | number
}

export type StrongContextHighlight = { start: number; end: number }

const normalizeWord = (value: string) => value.normalize('NFC').toLocaleLowerCase().trim()

// Word boundaries that also hold for accented letters (é, ï…), unlike \b.
const findWholeWord = (text: string, word: string): StrongContextHighlight | undefined => {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  if (!escaped) return undefined
  const match = new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`,
    'iu'
  ).exec(text)
  return match ? { start: match.index, end: match.index + match[0].length } : undefined
}

/**
 * Locates the tapped word from the verse's Strong spans rather than by text search,
 * which would match "que" inside "quelques-uns" (Rom 3:8). Without a translated
 * span, falls back to the first whole-word occurrence.
 */
export const getStrongContextHighlight = (
  verse: Verse,
  entry: StrongContextEntry,
  word?: string
): StrongContextHighlight | undefined => {
  const text = getStrongContextVerseText(verse)
  const codes = new Set(
    [entry.stepCode, entry.dStrong, entry.eStrong]
      .filter((code): code is string => Boolean(code))
      .map(code => code.toUpperCase())
  )
  const number = getStrongReferenceNumber(entry.baseCode)
  const translated = (verse.StrongSpans ?? []).filter(
    span => span.length > 0 && span.startOffset + span.length <= text.length
  )
  const exact = translated.filter(span =>
    span.identities.some(identity => codes.has(identity.code.toUpperCase()))
  )
  const candidates = exact.length
    ? exact
    : translated.filter(span =>
        span.identities.some(identity => getStrongReferenceNumber(identity.code) === number)
      )
  const spanText = (span: (typeof candidates)[number]) =>
    text.slice(span.startOffset, span.startOffset + span.length)
  const span =
    (word &&
      candidates.find(candidate => normalizeWord(spanText(candidate)) === normalizeWord(word))) ||
    candidates[0]
  if (span) return { start: span.startOffset, end: span.startOffset + span.length }
  return word ? findWholeWord(text, word) : undefined
}
