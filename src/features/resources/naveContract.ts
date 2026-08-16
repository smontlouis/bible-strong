import { Schema } from 'effect'

export class NaveLanguagePath extends Schema.Class<NaveLanguagePath>('NaveLanguagePath')({
  language: Schema.Literal('fr', 'en'),
}) {}

export class NaveTopicPath extends Schema.Class<NaveTopicPath>('NaveTopicPath')({
  ...NaveLanguagePath.fields,
  normalizedName: Schema.NonEmptyString,
}) {}

export class NaveVersePath extends Schema.Class<NaveVersePath>('NaveVersePath')({
  ...NaveLanguagePath.fields,
  verseKey: Schema.String.pipe(Schema.pattern(/^[1-9]\d*-[1-9]\d*-[1-9]\d*$/)),
}) {}

export class NaveTopicsQuery extends Schema.Class<NaveTopicsQuery>('NaveTopicsQuery')({
  initial: Schema.optional(Schema.NonEmptyString),
  search: Schema.optional(Schema.NonEmptyString),
}) {}

export class NaveRevisionDto extends Schema.Class<NaveRevisionDto>('NaveRevisionDto')({
  kind: Schema.Literal('nave'),
  language: Schema.Literal('fr', 'en'),
  revision: Schema.NonEmptyString,
}) {}

export class NaveTopicSummaryDto extends Schema.Class<NaveTopicSummaryDto>('NaveTopicSummaryDto')({
  normalizedName: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  initial: Schema.NonEmptyString,
}) {}

export class NaveTopicDto extends Schema.Class<NaveTopicDto>('NaveTopicDto')({
  ...NaveTopicSummaryDto.fields,
  description: Schema.String,
}) {}

export class NaveTopicReferenceDto extends Schema.Class<NaveTopicReferenceDto>(
  'NaveTopicReferenceDto'
)({
  normalizedName: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
}) {}

export class NaveTopicResponseDto extends Schema.Class<NaveTopicResponseDto>(
  'NaveTopicResponseDto'
)({
  resource: NaveRevisionDto,
  topic: NaveTopicDto,
}) {}

export class NaveTopicListResponseDto extends Schema.Class<NaveTopicListResponseDto>(
  'NaveTopicListResponseDto'
)({
  resource: NaveRevisionDto,
  topics: Schema.Array(NaveTopicSummaryDto),
}) {}

export class NaveVerseTopicsResponseDto extends Schema.Class<NaveVerseTopicsResponseDto>(
  'NaveVerseTopicsResponseDto'
)({
  resource: NaveRevisionDto,
  verseKey: NaveVersePath.fields.verseKey,
  verseTopics: Schema.Array(NaveTopicReferenceDto),
  chapterTopics: Schema.Array(NaveTopicReferenceDto),
}) {}
