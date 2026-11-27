import { Effect } from 'effect'

import {
  VerseStudyLexiconEntryDto,
  VerseStudyResponseDto,
  VerseStudySpanDto,
  VerseStudyWordsDto,
} from '@bible-strong/resource-domain/contracts/verseStudyContract'
import { TIPNR_BOOK_CODES } from '@bible-strong/resource-domain/strong-lexicon'
import { verseStudyStrongCodes } from '@bible-strong/resource-domain/verse-study'
import {
  bibleVersification,
  convertVerseKey,
  convertVerseKeyToOne,
  parseVerseKey,
  RESOURCE_VERSIFICATIONS,
  type VersificationId,
} from '@bible-strong/resource-domain/versification'
import { CommentaryVerseSectionDto } from '@bible-strong/resource-domain/contracts/supplementaryContract'
import {
  ENGLISH_STRONG_BIBLE_PRIORITY,
  FRENCH_STRONG_BIBLE_PRIORITY,
} from '@bible-strong/resource-catalog/strong-bibles'

import { discoverDictionaryPassageEntries } from './dictionary'
import { readNaveVerseTopics } from './nave'
import { readStrongBibleVerseSpans } from './strongBible'
import { readStrongLexiconChapterEntities, readStrongLexiconEntryCards } from './strongLexicon'
import { readCommentaryVerseSections, readCrossReferences } from './supplementary'

export type VerseStudyLanguage = 'fr' | 'en'

export type VerseStudyLookup = {
  language: VerseStudyLanguage
  book: number
  chapter: number
  verse: number
  /** The commentaries whose section on the verse is read, in the order of the answer. */
  commentaries: readonly string[]
  /**
   * `org`: the verse is in the pivot numbering; each part is read at the verse that stands for
   * it in its resource's numbering, and the answer speaks `org`. Otherwise every part is read at
   * the verse as given.
   */
  numbering?: 'org'
  /** With `numbering`, the reader's numbering, in which an unmeasured resource is read. */
  reader?: VersificationId
}

const keyOf = ({ book, chapter, verse }: Pick<VerseStudyLookup, 'book' | 'chapter' | 'verse'>) =>
  `${book}-${chapter}-${verse}`

/** The keys the studied verse has in a numbering; the verse as given without `numbering`. */
const keysIn = (input: VerseStudyLookup, versification: VersificationId | undefined): string[] =>
  input.numbering === 'org'
    ? convertVerseKey(keyOf(input), 'org', versification ?? input.reader)
    : [keyOf(input)]

/** A verse key a resource returned, in the answer's numbering; undefined without an equivalent. */
const keyBack = (
  input: VerseStudyLookup,
  key: string,
  versification: VersificationId | undefined
): string | undefined =>
  input.numbering === 'org' ? convertVerseKeyToOne(key, versification ?? input.reader, 'org') : key

/**
 * The Strong-tagged Bible a language borrows its words from: the one the site and the app
 * read Strong numbers in first. A page reading another tagged Bible reads its own words.
 */
export const VERSE_STUDY_STRONG_VERSION = {
  fr: FRENCH_STRONG_BIBLE_PRIORITY[0],
  en: ENGLISH_STRONG_BIBLE_PRIORITY[0],
} as const satisfies Record<VerseStudyLanguage, string>

/**
 * A part the verse has nothing for is empty, as its own route answers 404 for it. A part
 * that could not be read fails the whole study: an answer with an empty part would be kept
 * thirty days, and the page rendered from it a month, as if nothing were there.
 */
const absentAs =
  <Empty>(empty: Empty, ...tags: readonly string[]) =>
  <A, E extends { readonly _tag: string }, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.catchIf(
        cause => tags.includes(cause._tag),
        () => Effect.succeed(empty)
      )
    )

const readWords = (input: VerseStudyLookup) =>
  Effect.gen(function* () {
    const versionId = VERSE_STUDY_STRONG_VERSION[input.language]
    const verse =
      input.numbering === 'org'
        ? parseVerseKey(
            convertVerseKeyToOne(keyOf(input), 'org', bibleVersification(versionId)) ?? ''
          )
        : input
    const spans = verse
      ? yield* readStrongBibleVerseSpans({
          versionId,
          book: verse.book,
          chapter: verse.chapter,
          verse: verse.verse,
        }).pipe(absentAs([], 'UnsupportedStrongBibleVersion', 'StrongBibleChapterNotFound'))
      : []
    // The entries a page reads for the words, by the same codes and at the same level.
    const codes = verseStudyStrongCodes(spans)
    const cards = codes.length
      ? yield* readStrongLexiconEntryCards({
          identities: codes.map(code => ({ kind: 'dstrong' as const, reference: code })),
          language: input.language,
          level: 'simple',
        }).pipe(
          Effect.map(found => found.entries),
          absentAs([], 'StrongLexiconEntryNotFound', 'StrongLexiconEntityNotFound')
        )
      : []
    return new VerseStudyWordsDto({
      versionId,
      spans: spans.map(
        span =>
          new VerseStudySpanDto({
            startOffset: span.startOffset,
            length: span.length,
            identities: span.identities.map(({ kind, code }) => ({ kind, code })),
          })
      ),
      entries: cards.map(
        card =>
          new VerseStudyLexiconEntryDto({
            selectedIdentity: card.selectedIdentity,
            original: card.original,
            transliteration: card.transliteration,
            gloss: card.gloss,
          })
      ),
    })
  })

/** Reads a part at a key, or answers nothing when the verse has no equivalent there. */
const optionalRead = <A, E, R>(
  key: string | undefined,
  read: (key: string) => Effect.Effect<readonly A[], E, R>
): Effect.Effect<readonly A[], E, R> => (key ? read(key) : Effect.succeed([]))

const TRESOR = 'cross-references:TRESOR'

/**
 * The cross-references of the verse: a verse may stand for several Trésor verses (LSG
 * 2 Corinthians 13:12 is KJV 13:12-13), and the targets are given back in the answer's numbering.
 */
const readStudyCrossReferences = (input: VerseStudyLookup) =>
  Effect.gen(function* () {
    const versification = RESOURCE_VERSIFICATIONS[TRESOR]
    const lists = yield* Effect.all(
      keysIn(input, versification).map(verseKey =>
        readCrossReferences({ language: 'fr', verseKey }).pipe(
          Effect.map(found => found.references),
          absentAs([] as readonly string[], 'SupplementaryContentNotFound')
        )
      )
    )
    // The words a group of references bears on are kept; a target without an equivalent is not.
    return lists.flat().flatMap(reference => {
      if (!parseVerseKey(reference)) return [reference]
      const key = keyBack(input, reference, versification)
      return key ? [key] : []
    })
  })

/**
 * The section of each commentary on the verse, each read at the verse that stands for it in its
 * own numbering, in the order asked. With `numbering`, the verses of a section are given in
 * `org`, within the studied chapter.
 */
const readStudyCommentaries = (input: VerseStudyLookup) =>
  Effect.gen(function* () {
    if (input.commentaries.length === 0) return []
    const groups = new Map<string, string[]>()
    for (const collection of input.commentaries) {
      const key = keysIn(input, RESOURCE_VERSIFICATIONS[`commentary:${collection}`])[0]
      if (key) groups.set(key, [...(groups.get(key) ?? []), collection])
    }
    const read = yield* Effect.all(
      [...groups].map(([key, collections]) => {
        const verse = parseVerseKey(key)!
        return readCommentaryVerseSections({
          collections,
          language: input.language,
          ...verse,
        }).pipe(
          Effect.map(found => found.sections.map(section => ({ section, verse }))),
          absentAs([], 'SupplementaryContentNotFound')
        )
      })
    )
    const sections = read.flat().map(({ section, verse }) => {
      if (input.numbering !== 'org') return section
      const versification = RESOURCE_VERSIFICATIONS[`commentary:${section.resource.resourceId}`]
      const toStudied = (number: number) => {
        const back = parseVerseKey(
          keyBack(input, `${verse.book}-${verse.chapter}-${number}`, versification) ?? ''
        )
        return back && back.chapter === input.chapter ? back.verse : input.verse
      }
      const startVerse = section.startVerse === 0 ? 0 : toStudied(section.startVerse)
      const endVerse = Math.max(toStudied(section.endVerse), startVerse, 1)
      return new CommentaryVerseSectionDto({ ...section, startVerse, endVerse })
    })
    const order = (collection: string) => input.commentaries.indexOf(collection)
    return sections.sort(
      (left, right) => order(left.resource.resourceId) - order(right.resource.resourceId)
    )
  })

/**
 * What a verse page gathers around a verse that is the same in every Bible of a language, in
 * one read (ADR-0115). Each part is what its own route answers for the verse; the parts are
 * read together, on the connections the request has.
 */
export const readVerseStudy = (input: VerseStudyLookup) =>
  Effect.gen(function* () {
    const verseKey = keyOf(input)
    const bookCode = TIPNR_BOOK_CODES[input.book - 1]
    const parts = yield* Effect.all(
      {
        words: readWords(input),
        // The cross-references are published once, in French, for every language.
        crossReferences: readStudyCrossReferences(input),
        commentaries: readStudyCommentaries(input),
        topics: optionalRead(
          keysIn(input, RESOURCE_VERSIFICATIONS[`nave:${input.language}`])[0],
          naveKey =>
            readNaveVerseTopics({ language: input.language, verseKey: naveKey }).pipe(
              Effect.map(found => found.verseTopics),
              absentAs([], 'UnsupportedNaveLanguage', 'NaveTopicNotFound')
            )
        ),
        dictionary: optionalRead(
          keysIn(input, RESOURCE_VERSIFICATIONS[`dictionary-presence:${input.language}`])[0],
          dictionaryKey =>
            discoverDictionaryPassageEntries({
              verseKey: dictionaryKey,
              language: input.language,
            }).pipe(
              Effect.map(found => found.entries),
              absentAs([], 'DictionaryEntryNotFound')
            )
        ),
        // The entities of the chapter, as its end lists them in the app, then those of this verse.
        entities: optionalRead(
          bookCode ? keysIn(input, RESOURCE_VERSIFICATIONS['entities:tipnr'])[0] : undefined,
          entityKey => {
            const { chapter, verse } = parseVerseKey(entityKey)!
            return readStrongLexiconChapterEntities({
              bookCode: bookCode!,
              chapter,
              language: input.language,
              strongCodes: [],
            }).pipe(
              Effect.map(found => found.entities.filter(entity => entity.verses.includes(verse))),
              absentAs([], 'StrongLexiconEntityNotFound', 'StrongLexiconEntryNotFound')
            )
          }
        ),
      },
      { concurrency: 'unbounded' }
    )
    return new VerseStudyResponseDto({
      verseKey,
      language: input.language,
      words: parts.words,
      crossReferences: [...parts.crossReferences],
      commentaries: [...parts.commentaries],
      topics: [...parts.topics],
      dictionary: [...parts.dictionary],
      entities: [...parts.entities],
    })
  })
