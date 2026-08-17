import { Schema } from 'effect'

const Language = Schema.Literal('fr', 'en')

export class TimelineLanguagePath extends Schema.Class<TimelineLanguagePath>(
  'TimelineLanguagePath'
)({
  language: Language,
}) {}

export class TimelineEventPath extends Schema.Class<TimelineEventPath>('TimelineEventPath')({
  ...TimelineLanguagePath.fields,
  slug: Schema.NonEmptyString,
}) {}

export class TimelineRevisionDto extends Schema.Class<TimelineRevisionDto>('TimelineRevisionDto')({
  kind: Schema.Literal('timeline'),
  language: Language,
  revision: Schema.NonEmptyString,
}) {}

export class TimelineRelatedDto extends Schema.Class<TimelineRelatedDto>('TimelineRelatedDto')({
  slug: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
}) {}

export class TimelineImageDto extends Schema.Class<TimelineImageDto>('TimelineImageDto')({
  caption: Schema.String,
  file: Schema.NonEmptyString,
}) {}

export class TimelineVideoDto extends Schema.Class<TimelineVideoDto>('TimelineVideoDto')({
  title: Schema.String,
  caption: Schema.String,
  filename: Schema.NonEmptyString,
}) {}

export class TimelineEventDto extends Schema.Class<TimelineEventDto>('TimelineEventDto')({
  id: Schema.NonEmptyString,
  slug: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  description: Schema.String,
  article: Schema.String,
  period: Schema.String,
  dates: Schema.String,
  related: Schema.Array(TimelineRelatedDto),
  images: Schema.Array(TimelineImageDto),
  videos: Schema.Array(TimelineVideoDto),
  scriptures: Schema.Array(Schema.String),
}) {}

export class TimelineEventsResponseDto extends Schema.Class<TimelineEventsResponseDto>(
  'TimelineEventsResponseDto'
)({
  resource: TimelineRevisionDto,
  events: Schema.Array(TimelineEventDto),
}) {}

export class TimelineEventResponseDto extends Schema.Class<TimelineEventResponseDto>(
  'TimelineEventResponseDto'
)({
  resource: TimelineRevisionDto,
  event: TimelineEventDto,
}) {}
