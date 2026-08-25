import { Context, Data, Effect } from 'effect'

import {
  NaveRevisionDto,
  NaveTopicDto,
  NaveTopicListResponseDto,
  NaveTopicReferenceDto,
  NaveTopicResponseDto,
  NaveTopicSummaryDto,
  NaveVerseTopicsResponseDto,
} from '@bible-strong/mobile/src/features/resources/naveContract'

export type NaveLanguage = 'fr' | 'en'

export type NaveTopic = {
  normalizedName: string
  name: string
  initial: string
  description: string
}

export type NaveTopicLookup = { language: NaveLanguage; normalizedName: string }
export type NaveTopicList = {
  language: NaveLanguage
  initial?: string
  search?: string
  limit?: number
  cursor?: string
}
export type NaveVerseLookup = { language: NaveLanguage; verseKey: string }

type ActiveNaveTopic = {
  language: NaveLanguage
  revision: string
  topic: NaveTopic
}

type ActiveNaveTopicList = {
  language: NaveLanguage
  revision: string
  topics: readonly NaveTopic[]
  limit: number
  nextCursor?: string
}

type ActiveNaveVerseTopics = {
  language: NaveLanguage
  revision: string
  verseKey: string
  verseTopics: readonly NaveTopic[]
  chapterTopics: readonly NaveTopic[]
}

export class UnsupportedNaveLanguage extends Data.TaggedError('UnsupportedNaveLanguage')<{
  readonly language: NaveLanguage
}> {}

export class ActiveNavePublicationUnavailable extends Data.TaggedError(
  'ActiveNavePublicationUnavailable'
)<{
  readonly language: NaveLanguage
}> {}

export class NaveTopicNotFound extends Data.TaggedError('NaveTopicNotFound')<NaveTopicLookup> {}

export class NaveRepositoryFailure extends Data.TaggedError('NaveRepositoryFailure')<{
  readonly cause: unknown
}> {}

export type NaveRepositoryError =
  | ActiveNavePublicationUnavailable
  | NaveTopicNotFound
  | NaveRepositoryFailure

export type NaveRepositoryService = {
  findTopic: (input: NaveTopicLookup) => Effect.Effect<ActiveNaveTopic, NaveRepositoryError>
  listTopics: (input: NaveTopicList) => Effect.Effect<ActiveNaveTopicList, NaveRepositoryError>
  findVerseTopics: (
    input: NaveVerseLookup
  ) => Effect.Effect<ActiveNaveVerseTopics, NaveRepositoryError>
  findRandomTopic: (language: NaveLanguage) => Effect.Effect<ActiveNaveTopic, NaveRepositoryError>
}

export class NaveRepository extends Context.Tag('NaveRepository')<
  NaveRepository,
  NaveRepositoryService
>() {}

const assertSupported = (language: NaveLanguage) =>
  language === 'fr' || language === 'en'
    ? Effect.void
    : Effect.fail(new UnsupportedNaveLanguage({ language }))

const revisionDto = (language: NaveLanguage, revision: string) =>
  new NaveRevisionDto({ kind: 'nave', language, revision })

const topicDto = (topic: NaveTopic) => new NaveTopicDto(topic)
const summaryDto = (topic: NaveTopic) =>
  new NaveTopicSummaryDto({
    normalizedName: topic.normalizedName,
    name: topic.name,
    initial: topic.initial,
  })
const referenceDto = (topic: NaveTopic) =>
  new NaveTopicReferenceDto({ normalizedName: topic.normalizedName, name: topic.name })

export const readNaveTopic = (input: NaveTopicLookup) =>
  Effect.gen(function* () {
    yield* assertSupported(input.language)
    const repository = yield* NaveRepository
    const active = yield* repository.findTopic(input)
    return new NaveTopicResponseDto({
      resource: revisionDto(active.language, active.revision),
      topic: topicDto(active.topic),
    })
  })

export const browseNaveTopics = (input: NaveTopicList) =>
  Effect.gen(function* () {
    yield* assertSupported(input.language)
    const repository = yield* NaveRepository
    const active = yield* repository.listTopics(input)
    return new NaveTopicListResponseDto({
      resource: revisionDto(active.language, active.revision),
      topics: active.topics.map(summaryDto),
      limit: active.limit,
      ...(active.nextCursor === undefined ? {} : { nextCursor: active.nextCursor }),
    })
  })

export const readNaveVerseTopics = (input: NaveVerseLookup) =>
  Effect.gen(function* () {
    yield* assertSupported(input.language)
    const repository = yield* NaveRepository
    const active = yield* repository.findVerseTopics(input)
    return new NaveVerseTopicsResponseDto({
      resource: revisionDto(active.language, active.revision),
      verseKey: active.verseKey,
      verseTopics: active.verseTopics.map(referenceDto),
      chapterTopics: active.chapterTopics.map(referenceDto),
    })
  })

export const readRandomNaveTopic = (language: NaveLanguage) =>
  Effect.gen(function* () {
    yield* assertSupported(language)
    const repository = yield* NaveRepository
    const active = yield* repository.findRandomTopic(language)
    return new NaveTopicResponseDto({
      resource: revisionDto(active.language, active.revision),
      topic: topicDto(active.topic),
    })
  })
