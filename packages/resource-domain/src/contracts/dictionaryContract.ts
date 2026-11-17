import * as Schema from 'effect/Schema'
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
  search: Schema.optional(Schema.NonEmptyString.pipe(Schema.maxLength(200))),
  limit: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 500))),
  cursor: Schema.optional(DictionaryPageCursor),
}) {}

export class DictionaryDirectoryQuery extends Schema.Class<DictionaryDirectoryQuery>(
  'DictionaryDirectoryQuery'
)({
  language: Schema.Literal('fr', 'en'),
  initial: Schema.optional(Schema.NonEmptyString),
  search: Schema.optional(Schema.NonEmptyString.pipe(Schema.maxLength(200))),
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

/**
 * The slug a heading is written as in an address: its letters without their accents, in lower
 * case, every other run of characters a hyphen. A heading with no Latin letter or digit is
 * `article`. The public site names a term page by the slug of its notion's label, and the
 * Resource API finds the notion back by it (ADR-0115): the database compares the same rule,
 * written in SQL next to its index, which a test keeps equal to this one.
 */
export const dictionaryTermSlug = (word: string): string =>
  word
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '') || 'article'

export const DictionaryTermSlug = Schema.String.pipe(
  Schema.maxLength(200),
  Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
)

export class DictionaryTermPath extends Schema.Class<DictionaryTermPath>('DictionaryTermPath')({
  slug: DictionaryTermSlug,
}) {}

export class DictionaryTermQuery extends Schema.Class<DictionaryTermQuery>('DictionaryTermQuery')({
  language: Schema.Literal('fr', 'en'),
}) {}

/**
 * The notion of the directory of a language whose label has this slug, as the directory lists
 * it; the first in the order of the directory when several share it. A slug no notion has is
 * answered without one, not as absent: the site reads an absent answer as a Resource API that
 * does not know the route yet.
 */
export class DictionaryTermResponseDto extends Schema.Class<DictionaryTermResponseDto>(
  'DictionaryTermResponseDto'
)({
  language: Schema.Literal('fr', 'en'),
  slug: DictionaryTermSlug,
  notion: Schema.optional(DictionaryDirectoryItemDto),
}) {}
