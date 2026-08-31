import { Schema } from 'effect'

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
