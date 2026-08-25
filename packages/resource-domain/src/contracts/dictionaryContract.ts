import { Schema } from 'effect'
import { decodeDictionaryPageCursor, encodeDictionaryPageCursor } from '../resourcePageCursor'

export { decodeDictionaryPageCursor, encodeDictionaryPageCursor }

const DictionaryPageCursor = Schema.NonEmptyString.pipe(
  Schema.filter(value => decodeDictionaryPageCursor(value) !== undefined)
)

const DictionaryVerseKey = Schema.String.pipe(
  Schema.pattern(/^[^\\/\u0000-\u001f\s]+-[^\\/\u0000-\u001f\s]+-[^\\/\u0000-\u001f\s]+$/u)
)

export class DictionaryLanguagePath extends Schema.Class<DictionaryLanguagePath>(
  'DictionaryLanguagePath'
)({
  language: Schema.Literal('fr', 'en'),
}) {}

export class DictionaryEntryPath extends Schema.Class<DictionaryEntryPath>('DictionaryEntryPath')({
  ...DictionaryLanguagePath.fields,
  word: Schema.NonEmptyString,
}) {}

export class DictionaryEntryIdPath extends Schema.Class<DictionaryEntryIdPath>(
  'DictionaryEntryIdPath'
)({
  ...DictionaryLanguagePath.fields,
  id: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
}) {}

export class DictionaryVersePath extends Schema.Class<DictionaryVersePath>('DictionaryVersePath')({
  ...DictionaryLanguagePath.fields,
  verseKey: DictionaryVerseKey,
}) {}

export class DictionaryEntriesQuery extends Schema.Class<DictionaryEntriesQuery>(
  'DictionaryEntriesQuery'
)({
  initial: Schema.optional(Schema.NonEmptyString),
  search: Schema.optional(Schema.NonEmptyString),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 500))),
  cursor: Schema.optional(DictionaryPageCursor),
}) {}

export class DictionaryEntriesBatchQuery extends Schema.Class<DictionaryEntriesBatchQuery>(
  'DictionaryEntriesBatchQuery'
)({
  words: Schema.NonEmptyString,
}) {}

export class DictionaryRevisionDto extends Schema.Class<DictionaryRevisionDto>(
  'DictionaryRevisionDto'
)({
  kind: Schema.Literal('dictionary'),
  language: Schema.Literal('fr', 'en'),
  revision: Schema.NonEmptyString,
}) {}

export class DictionarySummaryDto extends Schema.Class<DictionarySummaryDto>(
  'DictionarySummaryDto'
)({
  id: Schema.Int.pipe(Schema.positive()),
  word: Schema.NonEmptyString,
  normalizedWord: Schema.NonEmptyString,
}) {}

export class DictionaryEntryDto extends Schema.Class<DictionaryEntryDto>('DictionaryEntryDto')({
  id: Schema.Int.pipe(Schema.positive()),
  word: Schema.NonEmptyString,
  definition: Schema.String,
}) {}

export class DictionaryEntriesResponseDto extends Schema.Class<DictionaryEntriesResponseDto>(
  'DictionaryEntriesResponseDto'
)({
  resource: DictionaryRevisionDto,
  entries: Schema.Array(DictionarySummaryDto),
  limit: Schema.Int.pipe(Schema.positive()),
  nextCursor: Schema.optional(Schema.NonEmptyString),
}) {}

export class DictionaryEntryResponseDto extends Schema.Class<DictionaryEntryResponseDto>(
  'DictionaryEntryResponseDto'
)({
  resource: DictionaryRevisionDto,
  entry: DictionaryEntryDto,
}) {}

export class DictionaryEntriesBatchResponseDto extends Schema.Class<DictionaryEntriesBatchResponseDto>(
  'DictionaryEntriesBatchResponseDto'
)({
  resource: DictionaryRevisionDto,
  entries: Schema.Array(DictionaryEntryDto),
}) {}

export class DictionaryVerseWordsResponseDto extends Schema.Class<DictionaryVerseWordsResponseDto>(
  'DictionaryVerseWordsResponseDto'
)({
  resource: DictionaryRevisionDto,
  verseKey: DictionaryVerseKey,
  words: Schema.Array(Schema.NonEmptyString),
}) {}
