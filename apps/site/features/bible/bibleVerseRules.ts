import type { ResourceLanguage } from '../resources/publicSite'

// What a verse page gathers around its verse, and the choices that keep it readable.

/** The best-known Bibles of each language: a verse is quoted in a few of them, not in all. */
export const MAIN_BIBLE_VERSIONS: Record<ResourceLanguage, readonly string[]> = {
  fr: ['LSG', 'S21', 'BDS', 'NEG79', 'DBY'],
  en: ['KJV', 'NIV', 'ESV', 'NKJV', 'NLT'],
}

/** How many other Bibles a verse is quoted in. */
export const OTHER_VERSION_COUNT = 4
/** How many commentaries a verse page quotes; the others stay a link away. */
export const VERSE_COMMENTARY_COUNT = 5
export const VERSE_CROSS_REFERENCE_COUNT = 16
export const VERSE_DICTIONARY_WORD_COUNT = 10
/** How many verses are read before and after the verse. */
export const VERSE_CONTEXT_SPAN = 2

/** The other well-known Bibles of a language, for a verse read in one of its Bibles. */
export const otherMainVersions = (language: ResourceLanguage, versionId: string): string[] =>
  MAIN_BIBLE_VERSIONS[language].filter(id => id !== versionId).slice(0, OTHER_VERSION_COUNT)

/**
 * The Bibles a verse page reads its verse in beside the one being read, in one read: the
 * well-known Bibles of the language and the original-language Bible, among those that carry
 * the verse. The Bible being read does not change the list, and the list is ordered, so
 * every verse page of a chapter asks the same question and the answer is kept once.
 */
export const verseStudyVersions = (
  language: ResourceLanguage,
  originalVersionId: string,
  carrying: readonly string[]
): string[] =>
  [...MAIN_BIBLE_VERSIONS[language], originalVersionId].filter(id => carrying.includes(id)).sort()

/**
 * A verse as it is quoted in a sentence: on one line. The marks a Bible puts where a line
 * of poetry breaks (`|` in the Semeur) are part of its text and are kept.
 */
export const quoteVerseText = (text: string): string => text.replace(/\s+/gu, ' ').trim()

/**
 * Whether a Bible has words for a verse it numbers. A Bible may keep the number of a verse
 * its manuscripts do not have and leave it blank, or with the bracket that closed the
 * omitted words (Matthew 17:21 in the NIV and in the NBS): such a verse is not a page of
 * its own. A verse has text when it holds a letter or a digit, which selects the rows the
 * coverage of the Resource API leaves out of its verse numbers (ADR-0071).
 */
export const hasVerseText = (text: string | undefined): text is string =>
  /[\p{L}\p{N}]/u.test(text ?? '')

export type VerseKey = { book: number; chapter: number; verse: number }

export const verseKey = ({ book, chapter, verse }: VerseKey): string =>
  `${book}-${chapter}-${verse}`

const LAST_BOOK = 66

/**
 * The passages a list of cross-references names. The list mixes the words of the verse a
 * group of references bears on (`"God."`) with verse keys (`"45-5-8"`): the keys are kept,
 * each once, without the verse itself and without what is not a verse of the canon.
 */
export const crossReferenceVerses = (references: readonly string[], self: VerseKey): VerseKey[] => {
  const seen = new Set([verseKey(self)])
  const verses: VerseKey[] = []
  for (const reference of references) {
    const match = /^(\d+)-(\d+)-(\d+)$/u.exec(reference)
    if (!match) continue
    const [book, chapter, verse] = match.slice(1).map(Number) as [number, number, number]
    if (book < 1 || book > LAST_BOOK || chapter < 1 || verse < 1 || seen.has(reference)) continue
    seen.add(reference)
    verses.push({ book, chapter, verse })
    if (verses.length === VERSE_CROSS_REFERENCE_COUNT) break
  }
  return verses
}

type DictionaryEvidence = { normalizedWord: string; evidenceKind: string }

/**
 * The dictionary articles worth naming under a verse: those on a word of the verse first,
 * then those that cite it, one per word, a handful in all.
 */
export const verseDictionaryEntries = <Entry extends DictionaryEvidence>(
  entries: readonly Entry[]
): Entry[] => {
  const seen = new Set<string>()
  return [...entries]
    .sort(
      (left, right) =>
        Number(right.evidenceKind === 'verse-name') - Number(left.evidenceKind === 'verse-name')
    )
    .filter(entry => {
      if (seen.has(entry.normalizedWord)) return false
      seen.add(entry.normalizedWord)
      return true
    })
    .slice(0, VERSE_DICTIONARY_WORD_COUNT)
}

type VerseRun = { startVerse: number; endVerse: number }

/**
 * The comment of a commentary that bears most closely on a verse: among the sections that
 * cover it, the one on the fewest verses. The introduction of the chapter covers none.
 */
export const closestCommentarySection = <Section extends VerseRun>(
  sections: readonly Section[],
  verse: number
): Section | undefined =>
  sections
    .filter(
      section => section.endVerse > 0 && section.startVerse <= verse && verse <= section.endVerse
    )
    .sort(
      (left, right) =>
        left.endVerse - left.startVerse - (right.endVerse - right.startVerse) ||
        right.startVerse - left.startVerse
    )[0]
