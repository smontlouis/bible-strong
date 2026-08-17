import { Context, Data, Effect } from 'effect'

import {
  TimelineImageDto,
  TimelineRelatedDto,
  TimelineVideoDto,
  TimelineEventDto,
  TimelineEventsResponseDto,
  TimelineEventResponseDto,
  TimelineRevisionDto,
} from '../../../src/features/resources/timelineContract'

export type TimelineLanguage = 'fr' | 'en'
export type TimelineEvent = {
  id: string
  slug: string
  title: string
  description: string
  article: string
  period: string
  dates: string
  related: Array<{ slug: string; title: string }>
  images: Array<{ caption: string; file: string }>
  videos: Array<{ title: string; caption: string; filename: string }>
  scriptures: string[]
}

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
    language: TimelineLanguage
  ) => Effect.Effect<
    { language: TimelineLanguage; revision: string; events: TimelineEvent[] },
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

export const readTimelineEvents = (language: TimelineLanguage) =>
  Effect.gen(function* () {
    const active = yield* (yield* TimelineRepository).listEvents(language)
    return new TimelineEventsResponseDto({
      resource: revisionDto(active.language, active.revision),
      events: active.events.map(eventDto),
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
