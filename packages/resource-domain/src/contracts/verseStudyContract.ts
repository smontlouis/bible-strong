import * as Schema from 'effect/Schema'

import { DictionaryPassageDiscoveryEntryDto } from './dictionaryContract'
import { NaveTopicReferenceDto } from './naveContract'
import { StrongLexiconChapterEntityDto, StrongLexiconIdentityKind } from './strongLexiconContract'
import {
  COMMENTARY_VERSE_SECTIONS_MAX_COMMENTARIES,
  CommentaryVerseSectionDto,
} from './supplementaryContract'

// The verse study of one verse in one language: what a verse page gathers around its verse
// that is the same in every Bible of that language, answered in one read (ADR-0115). The verse
// in the Bible being read, in the other Bibles, and the texts of the passages it is read with
// are read beside it: they change with the Bible, and this answer is shared by all of them.

export class VerseStudyPath extends Schema.Class<VerseStudyPath>('VerseStudyPath')({
  language: Schema.Literal('fr', 'en'),
  /** `book-chapter-verse`, the verse being at least 1. */
  verseKey: Schema.String.pipe(Schema.pattern(/^[1-9]\d*-[1-9]\d*-[1-9]\d*$/u)),
}) {}

export class VerseStudyQuery extends Schema.Class<VerseStudyQuery>('VerseStudyQuery')({
  /**
   * `org`: the verse key is in the pivot numbering (`@bible-strong/resource-domain/versification`).
   * Each part is then read at the verse that stands for it in its resource's numbering, and the
   * verse keys and verse numbers of the answer are in `org` too, so every Bible of a language
   * shares the answer whatever its numbering. Without it, every part is read at the key as given.
   */
  numbering: Schema.optional(Schema.Literal('org')),
  /**
   * With `numbering`, the numbering of the reader's Bible: a resource whose numbering is not
   * known is read at the reader's verse, as without `numbering`. Without it, such a resource is
   * read at the `org` verse.
   */
  reader: Schema.optional(Schema.Literal('org', 'bs-eng', 'bs-kjv', 'bs-nrsv')),
  /**
   * The commentaries whose section on the verse is read, separated by commas, in the order of
   * the answer. Without it, no commentary is read. The site names those that comment the
   * chapter, so every Bible of the language asks the same question.
   */
  commentaries: Schema.optional(
    Schema.String.pipe(
      Schema.filter(value => {
        const collections = value.split(',')
        return collections.length <= COMMENTARY_VERSE_SECTIONS_MAX_COMMENTARIES &&
          new Set(collections).size === collections.length &&
          collections.every(collection => /^[A-Za-z0-9][A-Za-z0-9-]{1,63}$/u.test(collection))
          ? undefined
          : `Expected 1 to ${COMMENTARY_VERSE_SECTIONS_MAX_COMMENTARIES} distinct comma-separated commentaries`
      })
    )
  ),
}) {}

/** A tagged word of the verse: where it stands in the text, and the entries it is tagged with. */
export class VerseStudySpanDto extends Schema.Class<VerseStudySpanDto>('VerseStudySpanDto')({
  startOffset: Schema.Int.pipe(Schema.nonNegative()),
  length: Schema.Int.pipe(Schema.nonNegative()),
  identities: Schema.Array(Schema.Struct({ kind: StrongLexiconIdentityKind, code: Schema.String })),
}) {}

/** What a verse study shows of an entry of the simple lexicon of its language. */
export class VerseStudyLexiconEntryDto extends Schema.Class<VerseStudyLexiconEntryDto>(
  'VerseStudyLexiconEntryDto'
)({
  selectedIdentity: Schema.Struct({ kind: StrongLexiconIdentityKind, code: Schema.String }),
  original: Schema.String,
  transliteration: Schema.String,
  gloss: Schema.String,
}) {}

export class VerseStudyWordsDto extends Schema.Class<VerseStudyWordsDto>('VerseStudyWordsDto')({
  /**
   * The Strong-tagged Bible of the language the words are taken from (LSG, KJV). A page that
   * reads another tagged Bible reads its own words; one that reads an untagged Bible borrows
   * these.
   */
  versionId: Schema.NonEmptyString,
  /** The tagged words of the verse in that Bible, in its order; none when it has no tags. */
  spans: Schema.Array(VerseStudySpanDto),
  /** The entry of each Strong code the words name (`verseStudyStrongCodes`). */
  entries: Schema.Array(VerseStudyLexiconEntryDto),
}) {}

export class VerseStudyResponseDto extends Schema.Class<VerseStudyResponseDto>(
  'VerseStudyResponseDto'
)({
  verseKey: Schema.NonEmptyString,
  language: Schema.Literal('fr', 'en'),
  words: VerseStudyWordsDto,
  /**
   * The cross-references of the verse as they are published, words and verse keys mixed;
   * `crossReferenceVerses` reads the passages out of them. The list is the same in every
   * language.
   */
  crossReferences: Schema.Array(Schema.String),
  /** The section of each commentary asked that bears most closely on the verse, in the order asked. */
  commentaries: Schema.Array(CommentaryVerseSectionDto),
  /** The Nave topics that name the verse itself. */
  topics: Schema.Array(NaveTopicReferenceDto),
  /** Every dictionary article of the language that names or cites the verse. */
  dictionary: Schema.Array(DictionaryPassageDiscoveryEntryDto),
  /** The people, places and nations of the chapter the verse names. */
  entities: Schema.Array(StrongLexiconChapterEntityDto),
}) {}
