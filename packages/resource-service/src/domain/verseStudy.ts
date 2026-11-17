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
}

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
    const spans = yield* readStrongBibleVerseSpans({
      versionId,
      book: input.book,
      chapter: input.chapter,
      verse: input.verse,
    }).pipe(absentAs([], 'UnsupportedStrongBibleVersion', 'StrongBibleChapterNotFound'))
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

/**
 * What a verse page gathers around a verse that is the same in every Bible of a language, in
 * one read (ADR-0115). Each part is what its own route answers for the verse; the parts are
 * read together, on the connections the request has.
 */
export const readVerseStudy = (input: VerseStudyLookup) =>
  Effect.gen(function* () {
    const verseKey = `${input.book}-${input.chapter}-${input.verse}`
    const bookCode = TIPNR_BOOK_CODES[input.book - 1]
    const parts = yield* Effect.all(
      {
        words: readWords(input),
        // The cross-references are published once, in French, for every language.
        crossReferences: readCrossReferences({ language: 'fr', verseKey }).pipe(
          Effect.map(found => found.references),
          absentAs([] as readonly string[], 'SupplementaryContentNotFound')
        ),
        commentaries: input.commentaries.length
          ? readCommentaryVerseSections({
              collections: input.commentaries,
              language: input.language,
              book: input.book,
              chapter: input.chapter,
              verse: input.verse,
            }).pipe(
              Effect.map(found => found.sections),
              absentAs([], 'SupplementaryContentNotFound')
            )
          : Effect.succeed([]),
        topics: readNaveVerseTopics({ language: input.language, verseKey }).pipe(
          Effect.map(found => found.verseTopics),
          absentAs([], 'UnsupportedNaveLanguage', 'NaveTopicNotFound')
        ),
        dictionary: discoverDictionaryPassageEntries({ verseKey, language: input.language }).pipe(
          Effect.map(found => found.entries),
          absentAs([], 'DictionaryEntryNotFound')
        ),
        // The entities of the chapter, as its end lists them in the app, then those of this verse.
        entities: bookCode
          ? readStrongLexiconChapterEntities({
              bookCode,
              chapter: input.chapter,
              language: input.language,
              strongCodes: [],
            }).pipe(
              Effect.map(found =>
                found.entities.filter(entity => entity.verses.includes(input.verse))
              ),
              absentAs([], 'StrongLexiconEntityNotFound', 'StrongLexiconEntryNotFound')
            )
          : Effect.succeed([]),
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
