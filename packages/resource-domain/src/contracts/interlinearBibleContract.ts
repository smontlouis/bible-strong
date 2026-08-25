import { Schema } from 'effect'

const VersionId = Schema.Literal('BHG')
const Language = Schema.Literal('fr', 'en')
const Book = Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 77))
const Chapter = Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 200))

export class InterlinearBibleCoveragePath extends Schema.Class<InterlinearBibleCoveragePath>(
  'InterlinearBibleCoveragePath'
)({
  version: VersionId,
  language: Language,
}) {}

export class InterlinearBibleChapterPath extends Schema.Class<InterlinearBibleChapterPath>(
  'InterlinearBibleChapterPath'
)({
  version: VersionId,
  language: Language,
  book: Book,
  chapter: Chapter,
}) {}

export class InterlinearBibleRevisionDto extends Schema.Class<InterlinearBibleRevisionDto>(
  'InterlinearBibleRevisionDto'
)({
  kind: Schema.Literal('interlinear-index'),
  versionId: VersionId,
  datasetId: Schema.Literal('STEP'),
  language: Language,
  revision: Schema.NonEmptyString,
  textRevision: Schema.NonEmptyString,
  textSha256: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/)),
}) {}

export class InterlinearIdentityDto extends Schema.Class<InterlinearIdentityDto>(
  'InterlinearIdentityDto'
)({
  kind: Schema.Literal('strong', 'estrong', 'dstrong', 'ustrong'),
  code: Schema.NonEmptyString,
}) {}

export class InterlinearSegmentDto extends Schema.Class<InterlinearSegmentDto>(
  'InterlinearSegmentDto'
)({
  ordinal: Schema.Int.pipe(Schema.nonNegative()),
  startOffset: Schema.Int.pipe(Schema.nonNegative()),
  length: Schema.Int.pipe(Schema.nonNegative()),
  transliteration: Schema.String,
  lemma: Schema.String,
  morphology: Schema.String,
  gloss: Schema.String,
  identities: Schema.Array(InterlinearIdentityDto),
}) {}

export class InterlinearTokenDto extends Schema.Class<InterlinearTokenDto>('InterlinearTokenDto')({
  id: Schema.Int.pipe(Schema.positive()),
  ordinal: Schema.Int.pipe(Schema.nonNegative()),
  startOffset: Schema.Int.pipe(Schema.nonNegative()),
  length: Schema.Int.pipe(Schema.nonNegative()),
  segments: Schema.Array(InterlinearSegmentDto),
}) {}

export class InterlinearChapterVerseDto extends Schema.Class<InterlinearChapterVerseDto>(
  'InterlinearChapterVerseDto'
)({
  number: Schema.Int.pipe(Schema.nonNegative()),
  tokens: Schema.Array(InterlinearTokenDto),
}) {}

export class InterlinearBibleChapterDto extends Schema.Class<InterlinearBibleChapterDto>(
  'InterlinearBibleChapterDto'
)({
  resource: InterlinearBibleRevisionDto,
  book: Schema.Int.pipe(Schema.positive()),
  chapter: Schema.Int.pipe(Schema.positive()),
  verses: Schema.Array(InterlinearChapterVerseDto),
}) {}

export class InterlinearBibleCoverageDto extends Schema.Class<InterlinearBibleCoverageDto>(
  'InterlinearBibleCoverageDto'
)({
  resource: InterlinearBibleRevisionDto,
  books: Schema.Array(Schema.Int.pipe(Schema.positive())),
  chaptersByBook: Schema.Record({
    key: Schema.String,
    value: Schema.Array(Schema.Int.pipe(Schema.positive())),
  }),
  verseCountByBookChapter: Schema.Record({
    key: Schema.String,
    value: Schema.Int.pipe(Schema.nonNegative()),
  }),
}) {}
