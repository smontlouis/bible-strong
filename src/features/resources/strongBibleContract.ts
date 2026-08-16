import { Schema } from 'effect'

const VersionId = Schema.String.pipe(Schema.pattern(/^[A-Z0-9][A-Z0-9_-]{1,31}$/))
const Book = Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 77))
const Chapter = Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 200))
const Reference = Schema.String.pipe(Schema.pattern(/^(?:[HG])?\d+[A-Z]*$/i))

export class StrongBibleVersionPath extends Schema.Class<StrongBibleVersionPath>(
  'StrongBibleVersionPath'
)({
  version: VersionId,
}) {}

export class StrongBibleChapterPath extends Schema.Class<StrongBibleChapterPath>(
  'StrongBibleChapterPath'
)({
  version: VersionId,
  book: Book,
  chapter: Chapter,
}) {}

export class StrongBibleIdentityPath extends Schema.Class<StrongBibleIdentityPath>(
  'StrongBibleIdentityPath'
)({
  version: VersionId,
  book: Book,
  reference: Reference,
}) {}

export class StrongBibleOccurrencesQuery extends Schema.Class<StrongBibleOccurrencesQuery>(
  'StrongBibleOccurrencesQuery'
)({
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 500))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.nonNegative())),
  allBooks: Schema.optional(Schema.Literal('true', 'false')),
  lexemeId: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.positive())),
}) {}

export class StrongBibleRevisionDto extends Schema.Class<StrongBibleRevisionDto>(
  'StrongBibleRevisionDto'
)({
  kind: Schema.Literal('strong-bible-index'),
  versionId: Schema.NonEmptyString,
  datasetId: Schema.NonEmptyString,
  revision: Schema.NonEmptyString,
  textRevision: Schema.NonEmptyString,
  textSha256: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/)),
  strongRevision: Schema.NonEmptyString,
}) {}

export class StrongBibleIdentityDto extends Schema.Class<StrongBibleIdentityDto>(
  'StrongBibleIdentityDto'
)({
  id: Schema.optional(Schema.Int.pipe(Schema.positive())),
  kind: Schema.Literal('strong', 'estrong', 'dstrong', 'ustrong'),
  code: Schema.NonEmptyString,
}) {}

export class StrongBibleMorphologyDto extends Schema.Class<StrongBibleMorphologyDto>(
  'StrongBibleMorphologyDto'
)({
  identity: StrongBibleIdentityDto,
  codes: Schema.Array(Schema.NonEmptyString),
}) {}

export class StrongBibleSpanDto extends Schema.Class<StrongBibleSpanDto>('StrongBibleSpanDto')({
  ordinal: Schema.Int.pipe(Schema.nonNegative()),
  startOffset: Schema.Int.pipe(Schema.nonNegative()),
  length: Schema.Int.pipe(Schema.nonNegative()),
  stepTokenIds: Schema.optional(Schema.Array(Schema.Int.pipe(Schema.positive()))),
  identities: Schema.Array(StrongBibleIdentityDto),
  morphologies: Schema.optional(Schema.Array(StrongBibleMorphologyDto)),
}) {}

export class StrongBibleChapterVerseDto extends Schema.Class<StrongBibleChapterVerseDto>(
  'StrongBibleChapterVerseDto'
)({
  number: Schema.Int.pipe(Schema.nonNegative()),
  spans: Schema.Array(StrongBibleSpanDto),
}) {}

export class StrongBibleChapterDto extends Schema.Class<StrongBibleChapterDto>(
  'StrongBibleChapterDto'
)({
  resource: StrongBibleRevisionDto,
  book: Schema.Int.pipe(Schema.positive()),
  chapter: Schema.Int.pipe(Schema.positive()),
  verses: Schema.Array(StrongBibleChapterVerseDto),
}) {}

export class StrongBibleCoverageDto extends Schema.Class<StrongBibleCoverageDto>(
  'StrongBibleCoverageDto'
)({
  resource: StrongBibleRevisionDto,
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

export class StrongBibleBookCountDto extends Schema.Class<StrongBibleBookCountDto>(
  'StrongBibleBookCountDto'
)({
  book: Schema.Int.pipe(Schema.positive()),
  verseCount: Schema.Int.pipe(Schema.nonNegative()),
}) {}

export class StrongBibleCountsDto extends Schema.Class<StrongBibleCountsDto>(
  'StrongBibleCountsDto'
)({
  resource: StrongBibleRevisionDto,
  identity: Schema.optional(StrongBibleIdentityDto),
  counts: Schema.Array(StrongBibleBookCountDto),
}) {}

export class StrongBibleOccurrenceVerseDto extends Schema.Class<StrongBibleOccurrenceVerseDto>(
  'StrongBibleOccurrenceVerseDto'
)({
  book: Schema.Int.pipe(Schema.positive()),
  chapter: Schema.Int.pipe(Schema.positive()),
  verse: Schema.Int.pipe(Schema.nonNegative()),
  spans: Schema.Array(StrongBibleSpanDto),
}) {}

export class StrongBibleOccurrencesDto extends Schema.Class<StrongBibleOccurrencesDto>(
  'StrongBibleOccurrencesDto'
)({
  resource: StrongBibleRevisionDto,
  identity: Schema.optional(StrongBibleIdentityDto),
  verses: Schema.Array(StrongBibleOccurrenceVerseDto),
  nextOffset: Schema.optional(Schema.Int.pipe(Schema.nonNegative())),
}) {}

export class StrongBibleLemmaStatDto extends Schema.Class<StrongBibleLemmaStatDto>(
  'StrongBibleLemmaStatDto'
)({
  id: Schema.Int.pipe(Schema.positive()),
  lemma: Schema.NonEmptyString,
  partOfSpeech: Schema.NonEmptyString,
  occurrenceCount: Schema.Int.pipe(Schema.nonNegative()),
}) {}

export class StrongBibleLemmaStatsDto extends Schema.Class<StrongBibleLemmaStatsDto>(
  'StrongBibleLemmaStatsDto'
)({
  resource: StrongBibleRevisionDto,
  identity: Schema.optional(StrongBibleIdentityDto),
  lemmas: Schema.Array(StrongBibleLemmaStatDto),
}) {}
