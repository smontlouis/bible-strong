import { Schema } from 'effect'
import {
  decodeDictionaryDirectoryPageCursor,
  decodeDictionaryPageCursor,
  encodeDictionaryDirectoryPageCursor,
  encodeDictionaryPageCursor,
} from '../resourcePageCursor'

export {
  decodeDictionaryDirectoryPageCursor,
  decodeDictionaryPageCursor,
  encodeDictionaryDirectoryPageCursor,
  encodeDictionaryPageCursor,
}

const DictionaryPageCursor = Schema.NonEmptyString.pipe(
  Schema.filter(value => decodeDictionaryPageCursor(value) !== undefined)
)

const DictionaryDirectoryCursor = Schema.NonEmptyString.pipe(
  Schema.filter(value => decodeDictionaryDirectoryPageCursor(value) !== undefined)
)

const DictionaryVerseKey = Schema.String.pipe(
  Schema.pattern(/^[^\\/\u0000-\u001f\s]+-[^\\/\u0000-\u001f\s]+-[^\\/\u0000-\u001f\s]+$/u)
)

export const DictionaryPassageEvidenceKind = Schema.Literal(
  'source-citation',
  'verse-name',
  'verse-phrase'
)

export const DictionaryWorkId = Schema.String.pipe(Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u))

export class DictionaryCatalogQuery extends Schema.Class<DictionaryCatalogQuery>(
  'DictionaryCatalogQuery'
)({
  language: Schema.optional(Schema.Literal('fr', 'en')),
}) {}

export class DictionaryResourcePath extends Schema.Class<DictionaryResourcePath>(
  'DictionaryResourcePath'
)({
  work: DictionaryWorkId,
  language: Schema.Literal('fr', 'en'),
}) {}

export class DictionaryEntryPath extends Schema.Class<DictionaryEntryPath>('DictionaryEntryPath')({
  ...DictionaryResourcePath.fields,
  word: Schema.NonEmptyString,
}) {}

export class DictionaryEntryIdPath extends Schema.Class<DictionaryEntryIdPath>(
  'DictionaryEntryIdPath'
)({
  ...DictionaryResourcePath.fields,
  id: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
}) {}

export class DictionaryVersePath extends Schema.Class<DictionaryVersePath>('DictionaryVersePath')({
  ...DictionaryResourcePath.fields,
  verseKey: DictionaryVerseKey,
}) {}

export class DictionaryPassagePath extends Schema.Class<DictionaryPassagePath>(
  'DictionaryPassagePath'
)({
  verseKey: DictionaryVerseKey,
}) {}

export class DictionaryPassageQuery extends Schema.Class<DictionaryPassageQuery>(
  'DictionaryPassageQuery'
)({
  language: Schema.optional(Schema.Literal('fr', 'en')),
}) {}

export class DictionaryEntriesQuery extends Schema.Class<DictionaryEntriesQuery>(
  'DictionaryEntriesQuery'
)({
  initial: Schema.optional(Schema.NonEmptyString),
  search: Schema.optional(Schema.NonEmptyString),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 500))),
  cursor: Schema.optional(DictionaryPageCursor),
}) {}

export class DictionaryDirectoryQuery extends Schema.Class<DictionaryDirectoryQuery>(
  'DictionaryDirectoryQuery'
)({
  language: Schema.Literal('fr', 'en'),
  initial: Schema.optional(Schema.NonEmptyString),
  search: Schema.optional(Schema.NonEmptyString),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 500))),
  cursor: Schema.optional(DictionaryDirectoryCursor),
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
  work: DictionaryWorkId,
  language: Schema.Literal('fr', 'en'),
  revision: Schema.NonEmptyString,
}) {}

export class DictionaryWorkDto extends Schema.Class<DictionaryWorkDto>('DictionaryWorkDto')({
  resource: DictionaryRevisionDto,
  resourceId: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  abbreviation: Schema.NonEmptyString,
  authors: Schema.Array(Schema.NonEmptyString),
  description: Schema.NonEmptyString,
  edition: Schema.NonEmptyString,
  source: Schema.NonEmptyString,
  attribution: Schema.NonEmptyString,
  onlineAccess: Schema.Boolean,
  offlineDownload: Schema.Boolean,
}) {}

export class DictionaryCatalogResponseDto extends Schema.Class<DictionaryCatalogResponseDto>(
  'DictionaryCatalogResponseDto'
)({
  dictionaries: Schema.Array(DictionaryWorkDto),
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

export class DictionaryPassageAnchorDto extends Schema.Class<DictionaryPassageAnchorDto>(
  'DictionaryPassageAnchorDto'
)({
  id: Schema.Int.pipe(Schema.positive()),
  word: Schema.NonEmptyString,
  normalizedWord: Schema.NonEmptyString,
  evidenceKind: DictionaryPassageEvidenceKind,
}) {}

export class DictionaryPassageAnchorsResponseDto extends Schema.Class<DictionaryPassageAnchorsResponseDto>(
  'DictionaryPassageAnchorsResponseDto'
)({
  resource: DictionaryRevisionDto,
  verseKey: DictionaryVerseKey,
  entries: Schema.Array(DictionaryPassageAnchorDto),
}) {}

export class DictionaryPassageDiscoveryEntryDto extends Schema.Class<DictionaryPassageDiscoveryEntryDto>(
  'DictionaryPassageDiscoveryEntryDto'
)({
  resource: DictionaryRevisionDto,
  resourceId: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  abbreviation: Schema.NonEmptyString,
  id: Schema.Int.pipe(Schema.positive()),
  word: Schema.NonEmptyString,
  normalizedWord: Schema.NonEmptyString,
  evidenceKind: DictionaryPassageEvidenceKind,
  correspondenceId: Schema.optional(Schema.NonEmptyString),
}) {}

export class DictionaryPassageDiscoveryResponseDto extends Schema.Class<DictionaryPassageDiscoveryResponseDto>(
  'DictionaryPassageDiscoveryResponseDto'
)({
  verseKey: DictionaryVerseKey,
  entries: Schema.Array(DictionaryPassageDiscoveryEntryDto),
}) {}

export class DictionaryDirectorySourceDto extends Schema.Class<DictionaryDirectorySourceDto>(
  'DictionaryDirectorySourceDto'
)({
  resource: DictionaryRevisionDto,
  resourceId: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  abbreviation: Schema.NonEmptyString,
  id: Schema.Int.pipe(Schema.positive()),
  word: Schema.NonEmptyString,
  normalizedWord: Schema.NonEmptyString,
}) {}

export class DictionaryDirectoryItemDto extends Schema.Class<DictionaryDirectoryItemDto>(
  'DictionaryDirectoryItemDto'
)({
  key: Schema.NonEmptyString,
  label: Schema.NonEmptyString,
  normalizedLabel: Schema.NonEmptyString,
  correspondenceId: Schema.optional(Schema.NonEmptyString),
  sources: Schema.Array(DictionaryDirectorySourceDto).pipe(Schema.minItems(1)),
}) {}

export class DictionaryDirectoryResponseDto extends Schema.Class<DictionaryDirectoryResponseDto>(
  'DictionaryDirectoryResponseDto'
)({
  language: Schema.Literal('fr', 'en'),
  items: Schema.Array(DictionaryDirectoryItemDto),
  limit: Schema.Int.pipe(Schema.positive()),
  nextCursor: Schema.optional(Schema.NonEmptyString),
}) {}
