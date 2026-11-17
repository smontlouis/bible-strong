// What is gathered around a verse read alone: on the public site's verse page and under a
// verse the app's reader holds in focus (ADR-0088). The two read their data in their own way;
// they share which passages and articles are named, and how many.

import {
  createStrongIdentity,
  getDisplayedStrongIdentities,
  STRONG_IDENTITY_KINDS,
  type StrongIdentity,
} from './strongIdentities'

/** How many of each kind a surface names; the rest stays a link away. */
export const VERSE_STUDY_LIMITS = {
  /** The public verse page, read on a desktop as well as a phone. */
  page: { otherVersions: 4, words: Infinity, crossReferences: 16, commentaries: 5, dictionaryWords: 10 },
  /** The preview under a verse in the reader's focus, a door to each study card. */
  focus: { otherVersions: 3, words: 5, crossReferences: 3, commentaries: 2, dictionaryWords: 8 },
} as const

export type VerseStudySurface = keyof typeof VERSE_STUDY_LIMITS

/** The best-known Bibles of each language: a verse is quoted in a few of them, not in all. */
export const MAIN_BIBLE_VERSIONS = {
  fr: ['LSG', 'S21', 'BDS', 'NEG79', 'DBY'],
  en: ['KJV', 'NIV', 'ESV', 'NKJV', 'NLT'],
} as const satisfies Record<'fr' | 'en', readonly string[]>

export type VerseKey = { book: number; chapter: number; verse: number }

export const verseKey = ({ book, chapter, verse }: VerseKey): string =>
  `${book}-${chapter}-${verse}`

const LAST_BOOK = 66

/**
 * The passages a list of cross-references names. The list mixes the words of the verse a
 * group of references bears on (`"God."`) with verse keys (`"45-5-8"`): the keys are kept,
 * each once, without the verse itself and without what is not a verse of the canon.
 */
export const crossReferenceVerses = (
  references: readonly string[],
  self: VerseKey,
  limit = Infinity
): VerseKey[] => {
  const seen = new Set([verseKey(self)])
  const verses: VerseKey[] = []
  for (const reference of references) {
    if (verses.length >= limit) break
    const match = /^(\d+)-(\d+)-(\d+)$/u.exec(reference)
    if (!match) continue
    const [book, chapter, verse] = match.slice(1).map(Number) as [number, number, number]
    if (book < 1 || book > LAST_BOOK || chapter < 1 || verse < 1 || seen.has(reference)) continue
    seen.add(reference)
    verses.push({ book, chapter, verse })
  }
  return verses
}

type DictionaryEvidence = {
  normalizedWord: string
  evidenceKind: string
  /** Shared by the articles of several dictionaries on the same subject. */
  correspondenceId?: string
}

/**
 * The dictionary articles worth naming under a verse: those on a word of the verse first,
 * then those that cite it, one per subject (the articles of several dictionaries on the same
 * subject share a correspondence), else one per word.
 */
export const verseDictionaryEntries = <Entry extends DictionaryEvidence>(
  entries: readonly Entry[],
  limit = Infinity
): Entry[] => {
  const seen = new Set<string>()
  return [...entries]
    .sort(
      (left, right) =>
        Number(right.evidenceKind === 'verse-name') - Number(left.evidenceKind === 'verse-name')
    )
    .filter(entry => {
      const subject = entry.correspondenceId ?? entry.normalizedWord
      if (seen.has(subject) || seen.has(entry.normalizedWord)) return false
      seen.add(subject)
      seen.add(entry.normalizedWord)
      return true
    })
    .slice(0, limit)
}

type TaggedIdentity = { kind: string; code: string }

const isStrongIdentity = (identity: TaggedIdentity): identity is StrongIdentity =>
  (STRONG_IDENTITY_KINDS as readonly string[]).includes(identity.kind)

/**
 * The Strong entries the tagged words of a verse open, each once, as a sense code (`H0430`,
 * `H1254A`): of the identities a word is tagged with, the most precise of each number, as a
 * reader is shown them. The site names a word by this code and reads its entry by it; the
 * Resource API reads the same entries for the verse study it gathers (ADR-0115), so neither
 * names a word the other has no entry for.
 */
export const verseStudyStrongCodes = (
  spans: readonly { identities: readonly TaggedIdentity[] }[]
): string[] => {
  const codes = spans.flatMap(span =>
    getDisplayedStrongIdentities(span.identities.filter(isStrongIdentity)).flatMap(identity =>
      /^[hg]\d+[a-z]*$/iu.test(identity.code)
        ? [
            createStrongIdentity(
              identity.code,
              identity.code[0]?.toLowerCase() === 'h' ? 'hebrew' : 'greek'
            ).code,
          ]
        : []
    )
  )
  return [...new Set(codes)]
}
