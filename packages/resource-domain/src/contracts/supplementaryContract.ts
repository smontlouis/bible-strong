import * as Schema from 'effect/Schema'

const VerseKey = Schema.String.pipe(Schema.pattern(/^[1-9]\d*-(?:0-0|[1-9]\d*-(?:0|[1-9]\d*))$/u))
const CommentaryCollection = Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9][A-Za-z0-9-]{1,63}$/u))
const CommentaryLanguage = Schema.Literal('fr', 'en')

export class CommentaryPath extends Schema.Class<CommentaryPath>('CommentaryPath')({
  collection: CommentaryCollection,
  language: CommentaryLanguage,
  verseKey: VerseKey,
}) {}

export class CommentaryChapterPath extends Schema.Class<CommentaryChapterPath>(
  'CommentaryChapterPath'
)({
  collection: CommentaryCollection,
  language: CommentaryLanguage,
  book: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
  chapter: Schema.NumberFromString.pipe(Schema.int(), Schema.nonNegative()),
}) {}

export class CommentaryCoveragePath extends Schema.Class<CommentaryCoveragePath>(
  'CommentaryCoveragePath'
)({
  collection: CommentaryCollection,
  language: CommentaryLanguage,
}) {}

/** How many commentaries one read of the sections of a verse may name. */
export const COMMENTARY_VERSE_SECTIONS_MAX_COMMENTARIES = 10

export class CommentaryVerseSectionsPath extends Schema.Class<CommentaryVerseSectionsPath>(
  'CommentaryVerseSectionsPath'
)({
  /** `book-chapter-verse`, the verse being at least 1. */
  verseKey: Schema.String.pipe(Schema.pattern(/^[1-9]\d*-[1-9]\d*-[1-9]\d*$/u)),
}) {}

export class CommentaryVerseSectionsQuery extends Schema.Class<CommentaryVerseSectionsQuery>(
  'CommentaryVerseSectionsQuery'
)({
  language: CommentaryLanguage,
  /** The publications to read, separated by commas, in the order of the answer. */
  commentaries: Schema.String.pipe(
    Schema.filter(value => {
      const collections = value.split(',')
      return collections.length <= COMMENTARY_VERSE_SECTIONS_MAX_COMMENTARIES &&
        new Set(collections).size === collections.length &&
        collections.every(collection => /^[A-Za-z0-9][A-Za-z0-9-]{1,63}$/u.test(collection))
        ? undefined
        : `Expected 1 to ${COMMENTARY_VERSE_SECTIONS_MAX_COMMENTARIES} distinct comma-separated commentaries`
    })
  ),
}) {}

export class CrossReferencePath extends Schema.Class<CrossReferencePath>('CrossReferencePath')({
  language: Schema.Literal('fr'),
  verseKey: VerseKey,
}) {}

export class SupplementaryRevisionDto extends Schema.Class<SupplementaryRevisionDto>(
  'SupplementaryRevisionDto'
)({
  kind: Schema.Literal('commentary', 'cross-references'),
  resourceId: CommentaryCollection,
  language: CommentaryLanguage,
  revision: Schema.NonEmptyString,
}) {}

export class CommentaryVerseResponseDto extends Schema.Class<CommentaryVerseResponseDto>(
  'CommentaryVerseResponseDto'
)({
  resource: SupplementaryRevisionDto,
  verseKey: VerseKey,
  content: Schema.String,
}) {}

export class CommentaryChapterResponseDto extends Schema.Class<CommentaryChapterResponseDto>(
  'CommentaryChapterResponseDto'
)({
  resource: SupplementaryRevisionDto,
  book: Schema.Int.pipe(Schema.positive()),
  chapter: Schema.Int.pipe(Schema.nonNegative()),
  serializedComments: Schema.String,
}) {}

/**
 * The section of a commentary that bears most closely on a verse, as
 * `closestCommentarySection` picks it among the sections of the chapter.
 */
export class CommentaryVerseSectionDto extends Schema.Class<CommentaryVerseSectionDto>(
  'CommentaryVerseSectionDto'
)({
  resource: SupplementaryRevisionDto,
  /** The section segment of the public route grammar (ADR-0054). */
  slug: Schema.NonEmptyString,
  startVerse: Schema.Int.pipe(Schema.nonNegative()),
  endVerse: Schema.Int.pipe(Schema.positive()),
  content: Schema.String,
}) {}

export class CommentaryVerseSectionsResponseDto extends Schema.Class<CommentaryVerseSectionsResponseDto>(
  'CommentaryVerseSectionsResponseDto'
)({
  verseKey: Schema.NonEmptyString,
  /** One section per commentary that comments the verse, in the order they were asked. */
  sections: Schema.Array(CommentaryVerseSectionDto),
  /** The commentaries asked for that have no active publication in the language. */
  unavailable: Schema.Array(CommentaryCollection),
}) {}

export class CommentaryCoverageResponseDto extends Schema.Class<CommentaryCoverageResponseDto>(
  'CommentaryCoverageResponseDto'
)({
  resource: SupplementaryRevisionDto,
  books: Schema.Array(Schema.Int.pipe(Schema.positive())),
  chaptersByBook: Schema.Record({
    key: Schema.String,
    value: Schema.Array(Schema.Int.pipe(Schema.positive())),
  }),
}) {}

export class CrossReferenceResponseDto extends Schema.Class<CrossReferenceResponseDto>(
  'CrossReferenceResponseDto'
)({
  resource: SupplementaryRevisionDto,
  verseKey: VerseKey,
  references: Schema.Array(Schema.String),
}) {}
