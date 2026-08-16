import { Schema } from 'effect'

export class BibleChapterRequest extends Schema.Class<BibleChapterRequest>('BibleChapterRequest')({
  version: Schema.String.pipe(Schema.pattern(/^[A-Z0-9][A-Z0-9-]{1,31}$/)),
  book: Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 66)),
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
  number: Schema.Int.pipe(Schema.positive()),
  text: Schema.String,
  presentation: BibleVersePresentationDto,
}) {}

export class BibleTextRevisionDto extends Schema.Class<BibleTextRevisionDto>(
  'BibleTextRevisionDto'
)({
  kind: Schema.Literal('bible-text'),
  versionId: Schema.NonEmptyString,
  revision: Schema.NonEmptyString,
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

export type BibleChapter = typeof BibleChapterDto.Type
