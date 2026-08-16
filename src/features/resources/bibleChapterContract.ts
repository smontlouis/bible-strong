import { Schema } from 'effect'

export class BibleChapterRequest extends Schema.Class<BibleChapterRequest>('BibleChapterRequest')({
  version: Schema.String.pipe(Schema.pattern(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)),
  book: Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 77)),
  chapter: Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 200)),
}) {}

export class BibleVersionPath extends Schema.Class<BibleVersionPath>('BibleVersionPath')({
  version: BibleChapterRequest.fields.version,
}) {}

export class BibleVersePresentationDto extends Schema.Class<BibleVersePresentationDto>(
  'BibleVersePresentationDto'
)({
  startTags: Schema.Array(
    Schema.Struct({
      tag: Schema.String,
      attributes: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
    })
  ),
  layout: Schema.Array(
    Schema.Struct({
      offset: Schema.Number,
      order: Schema.Number,
      type: Schema.Literal('open', 'close', 'self'),
      tag: Schema.String,
      attributes: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
    })
  ),
  notes: Schema.Array(
    Schema.Struct({
      offset: Schema.Number,
      order: Schema.Number,
      kind: Schema.Literal('note', 'reference'),
      markup: Schema.String,
    })
  ),
  headings: Schema.Array(
    Schema.Struct({
      offset: Schema.Number,
      order: Schema.Number,
      kind: Schema.String,
      type: Schema.String,
      text: Schema.String,
      markup: Schema.String,
      attributes: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
    })
  ),
}) {}

export type BibleVersePresentation = typeof BibleVersePresentationDto.Type

export class BibleChapterVerseDto extends Schema.Class<BibleChapterVerseDto>(
  'BibleChapterVerseDto'
)({
  number: Schema.Int.pipe(Schema.nonNegative()),
  text: Schema.String,
  presentation: BibleVersePresentationDto,
}) {}

export class BibleTextRevisionDto extends Schema.Class<BibleTextRevisionDto>(
  'BibleTextRevisionDto'
)({
  kind: Schema.Literal('bible-text'),
  versionId: Schema.NonEmptyString,
  revision: Schema.NonEmptyString,
  textRevision: Schema.optional(Schema.NonEmptyString),
  textSha256: Schema.optional(Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))),
}) {}

export class BibleChapterDto extends Schema.Class<BibleChapterDto>('BibleChapterDto')({
  resource: BibleTextRevisionDto,
  book: Schema.Int.pipe(Schema.positive()),
  chapter: Schema.Int.pipe(Schema.positive()),
  verses: Schema.Array(BibleChapterVerseDto),
}) {}

export class BibleVersionCoverageDto extends Schema.Class<BibleVersionCoverageDto>(
  'BibleVersionCoverageDto'
)({
  resource: BibleTextRevisionDto,
  canon: Schema.Struct({
    id: Schema.NonEmptyString,
    orderedBooks: Schema.Array(Schema.Int.pipe(Schema.positive())),
  }),
  versification: Schema.NonEmptyString,
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

export class BiblePericopeVerseDto extends Schema.Class<BiblePericopeVerseDto>(
  'BiblePericopeVerseDto'
)({
  book: Schema.Int.pipe(Schema.positive()),
  chapter: Schema.Int.pipe(Schema.positive()),
  verse: Schema.Int.pipe(Schema.nonNegative()),
  headings: BibleVersePresentationDto.fields.headings,
}) {}

export class BiblePericopeIndexDto extends Schema.Class<BiblePericopeIndexDto>(
  'BiblePericopeIndexDto'
)({
  resource: BibleTextRevisionDto,
  verses: Schema.Array(BiblePericopeVerseDto),
}) {}

export type BibleChapter = typeof BibleChapterDto.Type
