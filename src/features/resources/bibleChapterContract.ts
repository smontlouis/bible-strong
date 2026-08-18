import { Schema } from 'effect'

export class BibleChapterRequest extends Schema.Class<BibleChapterRequest>('BibleChapterRequest')({
  version: Schema.String.pipe(Schema.pattern(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)),
  book: Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 77)),
  chapter: Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 200)),
}) {}

export class BibleVersionPath extends Schema.Class<BibleVersionPath>('BibleVersionPath')({
  version: BibleChapterRequest.fields.version,
}) {}

export type BibleVerseLocation = { book: number; chapter: number; verse: number }

export const parseBibleVerseKey = (value: string): BibleVerseLocation | undefined => {
  const match = /^(\d+)-(\d+)-(\d+)$/.exec(value)
  if (!match) return undefined
  const [, bookValue, chapterValue, verseValue] = match
  const book = Number(bookValue)
  const chapter = Number(chapterValue)
  const verse = Number(verseValue)
  return Number.isInteger(book) &&
    Number.isInteger(chapter) &&
    Number.isInteger(verse) &&
    book >= 1 &&
    book <= 77 &&
    chapter >= 1 &&
    chapter <= 200 &&
    verse >= 0 &&
    verse <= 200
    ? { book, chapter, verse }
    : undefined
}

export class BibleVerseTextsQuery extends Schema.Class<BibleVerseTextsQuery>(
  'BibleVerseTextsQuery'
)({
  references: Schema.String.pipe(
    Schema.filter(value => {
      const references = value.split(',')
      return references.length >= 1 &&
        references.length <= 200 &&
        references.every(reference => parseBibleVerseKey(reference) !== undefined)
        ? undefined
        : 'Expected 1 to 200 comma-separated Bible verse keys'
    })
  ),
}) {}

export class BibleSearchQuery extends Schema.Class<BibleSearchQuery>('BibleSearchQuery')({
  q: Schema.NonEmptyString,
  book: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 77))),
  section: Schema.optional(Schema.Literal('ot', 'nt')),
  sortOrder: Schema.optional(Schema.Literal('relevance', 'book')),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 100))),
  offset: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.nonNegative())),
}) {}

export class BibleSearchResultDto extends Schema.Class<BibleSearchResultDto>(
  'BibleSearchResultDto'
)({
  version: Schema.NonEmptyString,
  book: Schema.Int.pipe(Schema.positive()),
  chapter: Schema.Int.pipe(Schema.positive()),
  verse: Schema.Int.pipe(Schema.nonNegative()),
  text: Schema.String,
  highlighted: Schema.String,
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

export class BibleSearchResponseDto extends Schema.Class<BibleSearchResponseDto>(
  'BibleSearchResponseDto'
)({
  resource: BibleTextRevisionDto,
  results: Schema.Array(BibleSearchResultDto),
  count: Schema.NonNegativeInt,
}) {}

export class BibleChapterDto extends Schema.Class<BibleChapterDto>('BibleChapterDto')({
  resource: BibleTextRevisionDto,
  book: Schema.Int.pipe(Schema.positive()),
  chapter: Schema.Int.pipe(Schema.positive()),
  verses: Schema.Array(BibleChapterVerseDto),
}) {}

export class BibleVerseTextDto extends Schema.Class<BibleVerseTextDto>('BibleVerseTextDto')({
  book: Schema.Int.pipe(Schema.between(1, 77)),
  chapter: Schema.Int.pipe(Schema.between(1, 200)),
  number: Schema.Int.pipe(Schema.nonNegative()),
  text: Schema.String,
}) {}

export class BibleVerseTextsDto extends Schema.Class<BibleVerseTextsDto>('BibleVerseTextsDto')({
  resource: BibleTextRevisionDto,
  verses: Schema.Array(BibleVerseTextDto),
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
