import * as Schema from 'effect/Schema'
import { SupplementaryRevisionDto } from '@bible-strong/resource-domain/contracts/supplementaryContract'

export const COMMENTARY_READING_INDEX_VERSION = 2 as const
export const COMMENTARY_READING_EXCERPT_LENGTH = 160
const PositiveInt = Schema.Int.pipe(Schema.positive())
const VerseNumber = Schema.Int.pipe(Schema.nonNegative())

export class CommentaryReadingSelection extends Schema.Class<CommentaryReadingSelection>(
  'CommentaryReadingSelection'
)({
  resourceId: Schema.String.pipe(Schema.pattern(/^[A-Za-z0-9][A-Za-z0-9-]{1,63}$/u)),
  language: Schema.Literal('fr', 'en'),
}) {}

/** A bounded batch, independent of the number of verses and sections in the chapter. */
export class CommentaryReadingIndexRequest extends Schema.Class<CommentaryReadingIndexRequest>(
  'CommentaryReadingIndexRequest'
)({
  book: PositiveInt,
  chapter: PositiveInt,
  resources: Schema.Array(CommentaryReadingSelection).pipe(Schema.minItems(1), Schema.maxItems(5)),
}) {}

export class CommentaryReadingIndexEntry extends Schema.Class<CommentaryReadingIndexEntry>(
  'CommentaryReadingIndexEntry'
)({
  id: Schema.NonEmptyString,
  rangeStartVerse: VerseNumber,
  rangeEndVerse: VerseNumber,
  excerpt: Schema.String.pipe(Schema.maxLength(COMMENTARY_READING_EXCERPT_LENGTH)),
}) {}

export class CommentaryReadingResourceIndex extends Schema.Class<CommentaryReadingResourceIndex>(
  'CommentaryReadingResourceIndex'
)({
  resource: SupplementaryRevisionDto,
  sections: Schema.Array(CommentaryReadingIndexEntry),
}) {}

export class CommentaryReadingIndexResponse extends Schema.Class<CommentaryReadingIndexResponse>(
  'CommentaryReadingIndexResponse'
)({
  book: PositiveInt,
  chapter: PositiveInt,
  indexes: Schema.Array(CommentaryReadingResourceIndex),
  unavailable: Schema.Array(
    Schema.Struct({
      resourceId: Schema.NonEmptyString,
      language: Schema.Literal('fr', 'en'),
      cause: Schema.Literal('not-found', 'temporary-unavailable', 'index-unavailable'),
    })
  ),
}) {}

/** The revision is mandatory: an index must never open a different edition's section. */
export class CommentaryReadingSectionRequest extends Schema.Class<CommentaryReadingSectionRequest>(
  'CommentaryReadingSectionRequest'
)({
  resourceId: Schema.NonEmptyString,
  language: Schema.Literal('fr', 'en'),
  revision: Schema.NonEmptyString,
  book: PositiveInt,
  chapter: PositiveInt,
  sectionId: Schema.NonEmptyString,
}) {}

export class CommentaryReadingSectionResponse extends Schema.Class<CommentaryReadingSectionResponse>(
  'CommentaryReadingSectionResponse'
)({
  resource: SupplementaryRevisionDto,
  book: PositiveInt,
  chapter: PositiveInt,
  section: Schema.Struct({
    id: Schema.NonEmptyString,
    rangeStartVerse: VerseNumber,
    rangeEndVerse: VerseNumber,
    content: Schema.String,
  }),
}) {}
