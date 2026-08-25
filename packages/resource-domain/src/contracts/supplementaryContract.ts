import { Schema } from 'effect'

const VerseKey = Schema.String.pipe(Schema.pattern(/^[1-9]\d*-[1-9]\d*-(?:0|[1-9]\d*)$/u))

export class CommentaryPath extends Schema.Class<CommentaryPath>('CommentaryPath')({
  collection: Schema.Literal('MHY'),
  language: Schema.Literal('fr'),
  verseKey: VerseKey,
}) {}

export class CommentaryChapterPath extends Schema.Class<CommentaryChapterPath>(
  'CommentaryChapterPath'
)({
  collection: Schema.Literal('MHY'),
  language: Schema.Literal('fr'),
  book: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
  chapter: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
}) {}

export class CrossReferencePath extends Schema.Class<CrossReferencePath>('CrossReferencePath')({
  language: Schema.Literal('fr'),
  verseKey: VerseKey,
}) {}

export class SupplementaryRevisionDto extends Schema.Class<SupplementaryRevisionDto>(
  'SupplementaryRevisionDto'
)({
  kind: Schema.Literal('commentary', 'cross-references'),
  resourceId: Schema.Literal('MHY', 'TRESOR'),
  language: Schema.Literal('fr'),
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
  chapter: Schema.Int.pipe(Schema.positive()),
  serializedComments: Schema.String,
}) {}

export class CrossReferenceResponseDto extends Schema.Class<CrossReferenceResponseDto>(
  'CrossReferenceResponseDto'
)({
  resource: SupplementaryRevisionDto,
  verseKey: VerseKey,
  references: Schema.Array(Schema.String),
}) {}
