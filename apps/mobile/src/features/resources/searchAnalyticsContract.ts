import { Schema } from 'effect'

const SearchAnalyticsEventNameSchema = Schema.Literal('search_performed', 'result_opened')
export type SearchAnalyticsEventName = typeof SearchAnalyticsEventNameSchema.Type

const SearchAnalyticsOriginSchema = Schema.Literal('typed', 'example')
export type SearchAnalyticsOrigin = typeof SearchAnalyticsOriginSchema.Type

const SearchAnalyticsInputKindSchema = Schema.Literal(
  'reference',
  'strong',
  'hebrew',
  'greek',
  'transliteration',
  'keyword',
  'natural_language'
)
export type SearchAnalyticsInputKind = typeof SearchAnalyticsInputKindSchema.Type

const SearchAnalyticsSourceSchema = Schema.Literal('passages', 'strong', 'dictionary', 'nave')
export type SearchAnalyticsSource = typeof SearchAnalyticsSourceSchema.Type

const SearchAnalyticsOutcomeSchema = Schema.Literal(
  'success',
  'zero_results',
  'partial_error',
  'error'
)
export type SearchAnalyticsOutcome = typeof SearchAnalyticsOutcomeSchema.Type

const SearchAnalyticsMatchKindSchema = Schema.Literal(
  'none',
  'lexical',
  'topic',
  'semantic',
  'hybrid',
  'mixed'
)
export type SearchAnalyticsMatchKind = typeof SearchAnalyticsMatchKindSchema.Type

const SearchAnalyticsResultTypeSchema = Schema.Literal(
  'none',
  'reference',
  'passage',
  'strong',
  'dictionary',
  'nave'
)
export type SearchAnalyticsResultType = typeof SearchAnalyticsResultTypeSchema.Type

const Counter = Schema.Number.pipe(Schema.int(), Schema.between(0, 1_000_000))

export class SearchAnalyticsResultCountsDto extends Schema.Class<SearchAnalyticsResultCountsDto>(
  'SearchAnalyticsResultCountsDto'
)({
  total: Counter,
  references: Counter,
  passages: Counter,
  strong: Counter,
  dictionary: Counter,
  nave: Counter,
}) {}

export class SearchAnalyticsEventDto extends Schema.Class<SearchAnalyticsEventDto>(
  'SearchAnalyticsEventDto'
)({
  event: SearchAnalyticsEventNameSchema,
  query: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(512)),
  language: Schema.Literal('fr', 'en'),
  origin: SearchAnalyticsOriginSchema,
  inputKind: SearchAnalyticsInputKindSchema,
  sources: Schema.Array(SearchAnalyticsSourceSchema).pipe(Schema.maxItems(4)),
  versionIds: Schema.Array(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(32))).pipe(
    Schema.maxItems(8)
  ),
  outcome: SearchAnalyticsOutcomeSchema,
  resultCounts: SearchAnalyticsResultCountsDto,
  matchKind: SearchAnalyticsMatchKindSchema,
  topicId: Schema.optional(Schema.String.pipe(Schema.maxLength(128))),
  durationMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 120_000))),
  clickedResultType: Schema.optional(SearchAnalyticsResultTypeSchema),
  clickedResultKey: Schema.optional(Schema.String.pipe(Schema.maxLength(128))),
  clickedRank: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 10_000))),
}) {}

export class SearchAnalyticsAcceptedDto extends Schema.Class<SearchAnalyticsAcceptedDto>(
  'SearchAnalyticsAcceptedDto'
)({
  accepted: Schema.Boolean,
}) {}
