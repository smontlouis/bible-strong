import { Context, Data, Effect } from 'effect'

import {
  TimelineImageDto,
  TimelineRelatedDto,
  TimelineVideoDto,
  TimelineEventDto,
  TimelineEventSummaryDto,
  TimelineEventsResponseDto,
  TimelineEventResponseDto,
  TimelineRevisionDto,
} from '@bible-strong/resource-domain/contracts/timelineContract'

export type TimelineLanguage = 'fr' | 'en'
export type TimelineEvent = {
  id: string
  slug: string
  title: string
  description: string
  article: string
  period: string
  dates: string
  related: { slug: string; title: string }[]
  images: { caption: string; file: string }[]
  videos: { title: string; caption: string; filename: string }[]
  scriptures: string[]
}
export type TimelineEventSummary = Pick<
  TimelineEvent,
  'id' | 'slug' | 'title' | 'description' | 'period' | 'dates' | 'images'
>

export class ActiveTimelinePublicationUnavailable extends Data.TaggedError(
  'ActiveTimelinePublicationUnavailable'
)<{ readonly language: TimelineLanguage }> {}
export class TimelineEventNotFound extends Data.TaggedError('TimelineEventNotFound')<{
  readonly language: TimelineLanguage
  readonly slug: string
}> {}
export class TimelineRepositoryFailure extends Data.TaggedError('TimelineRepositoryFailure')<{
  readonly cause: unknown
}> {}
export type TimelineRepositoryError =
  | ActiveTimelinePublicationUnavailable
  | TimelineEventNotFound
  | TimelineRepositoryFailure
export type TimelineRepositoryService = {
  listEvents: (
    language: TimelineLanguage,
    options?: { search?: string; limit?: number }
  ) => Effect.Effect<
    { language: TimelineLanguage; revision: string; events: TimelineEventSummary[] },
    TimelineRepositoryError
  >
  findEvent: (input: {
    language: TimelineLanguage
    slug: string
  }) => Effect.Effect<
    { language: TimelineLanguage; revision: string; event: TimelineEvent },
    TimelineRepositoryError
  >
}
export class TimelineRepository extends Context.Tag('TimelineRepository')<
  TimelineRepository,
  TimelineRepositoryService
>() {}

const revisionDto = (language: TimelineLanguage, revision: string) =>
  new TimelineRevisionDto({ kind: 'timeline', language, revision })
const eventDto = (event: TimelineEvent) =>
  new TimelineEventDto({
    ...event,
    related: event.related.map(related => new TimelineRelatedDto(related)),
    images: event.images.map(image => new TimelineImageDto(image)),
    videos: event.videos.map(video => new TimelineVideoDto(video)),
  })
const eventSummaryDto = (event: TimelineEventSummary) =>
  new TimelineEventSummaryDto({
    ...event,
    images: event.images.map(image => new TimelineImageDto(image)),
  })

export const readTimelineEvents = (
  language: TimelineLanguage,
  options?: { search?: string; limit?: number }
) =>
  Effect.gen(function* () {
    const active = yield* (yield* TimelineRepository).listEvents(language, options)
    return new TimelineEventsResponseDto({
      resource: revisionDto(active.language, active.revision),
      events: active.events.map(eventSummaryDto),
    })
  })

export const readTimelineEvent = (input: { language: TimelineLanguage; slug: string }) =>
  Effect.gen(function* () {
    const active = yield* (yield* TimelineRepository).findEvent(input)
    return new TimelineEventResponseDto({
      resource: revisionDto(active.language, active.revision),
      event: eventDto(active.event),
    })
  })
