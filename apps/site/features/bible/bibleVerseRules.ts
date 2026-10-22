import {
  crossReferenceVerses as namedCrossReferenceVerses,
  MAIN_BIBLE_VERSIONS,
  VERSE_STUDY_LIMITS,
  verseDictionaryEntries as namedDictionaryEntries,
  type VerseKey,
} from '@bible-strong/resource-domain/verse-study'
import type { ResourceLanguage } from '../resources/publicSite'

export {
  MAIN_BIBLE_VERSIONS,
  verseKey,
  type VerseKey,
} from '@bible-strong/resource-domain/verse-study'

// What a verse page gathers around its verse, and the choices that keep it readable.

/** How many other Bibles a verse is quoted in. */
export const OTHER_VERSION_COUNT = VERSE_STUDY_LIMITS.page.otherVersions
/** How many commentaries a verse page quotes; the others stay a link away. */
export const VERSE_COMMENTARY_COUNT = VERSE_STUDY_LIMITS.page.commentaries
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

/** The passages a verse page quotes under its verse, at most sixteen (ADR-0088). */
export const crossReferenceVerses = (references: readonly string[], self: VerseKey): VerseKey[] =>
  namedCrossReferenceVerses(references, self, VERSE_STUDY_LIMITS.page.crossReferences)

/** The dictionary articles a verse page names, ten words at most (ADR-0088). */
export const verseDictionaryEntries = <
  Entry extends { normalizedWord: string; evidenceKind: string; correspondenceId?: string },
>(
  entries: readonly Entry[]
): Entry[] => namedDictionaryEntries(entries, VERSE_STUDY_LIMITS.page.dictionaryWords)
