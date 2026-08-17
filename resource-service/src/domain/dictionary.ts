import { Context, Data, Effect } from 'effect'

import {
  DictionaryEntriesResponseDto,
  DictionaryEntryDto,
  DictionaryEntryResponseDto,
  DictionaryRevisionDto,
  DictionarySummaryDto,
  DictionaryVerseWordsResponseDto,
} from '../../../src/features/resources/dictionaryContract'

export type DictionaryLanguage = 'fr' | 'en'

export type DictionarySummary = {
  id: number
  word: string
  normalizedWord: string
}

export type DictionaryEntry = {
  id: number
  word: string
  definition: string
}

export type DictionaryListInput = {
  language: DictionaryLanguage
  initial?: string
  search?: string
  limit?: number
  offset?: number
}

export type DictionaryEntryLookup = { language: DictionaryLanguage; word: string }
export type DictionaryEntryIdLookup = { language: DictionaryLanguage; id: number }
export type DictionaryVerseLookup = { language: DictionaryLanguage; verseKey: string }

type ActiveDictionaryBase = { language: DictionaryLanguage; revision: string }
export type ActiveDictionaryList = ActiveDictionaryBase & {
  entries: readonly DictionarySummary[]
  offset: number
  limit: number
  nextOffset?: number
}
export type ActiveDictionaryEntry = ActiveDictionaryBase & { entry: DictionaryEntry }
export type ActiveDictionaryVerseWords = ActiveDictionaryBase & {
  verseKey: string
  words: readonly string[]
}

export class UnsupportedDictionaryLanguage extends Data.TaggedError(
  'UnsupportedDictionaryLanguage'
)<{ readonly language: DictionaryLanguage }> {}

export class ActiveDictionaryPublicationUnavailable extends Data.TaggedError(
  'ActiveDictionaryPublicationUnavailable'
)<{ readonly language: DictionaryLanguage }> {}

export class DictionaryEntryNotFound extends Data.TaggedError('DictionaryEntryNotFound')<{
  readonly language: DictionaryLanguage
  readonly word?: string
  readonly id?: number
}> {}

export class DictionaryRepositoryFailure extends Data.TaggedError('DictionaryRepositoryFailure')<{
  readonly cause: unknown
}> {}

export type DictionaryRepositoryError =
  | ActiveDictionaryPublicationUnavailable
  | DictionaryEntryNotFound
  | DictionaryRepositoryFailure

export type DictionaryRepositoryService = {
  listEntries: (
    input: DictionaryListInput
  ) => Effect.Effect<ActiveDictionaryList, DictionaryRepositoryError>
  findEntry: (
    input: DictionaryEntryLookup
  ) => Effect.Effect<ActiveDictionaryEntry, DictionaryRepositoryError>
  findEntryById: (
    input: DictionaryEntryIdLookup
  ) => Effect.Effect<ActiveDictionaryEntry, DictionaryRepositoryError>
  findVerseWords: (
    input: DictionaryVerseLookup
  ) => Effect.Effect<ActiveDictionaryVerseWords, DictionaryRepositoryError>
}

export class DictionaryRepository extends Context.Tag('DictionaryRepository')<
  DictionaryRepository,
  DictionaryRepositoryService
>() {}

const revisionDto = (language: DictionaryLanguage, revision: string) =>
  new DictionaryRevisionDto({ kind: 'dictionary', language, revision })

export const browseDictionaryEntries = (input: DictionaryListInput) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const active = yield* repository.listEntries(input)
    return new DictionaryEntriesResponseDto({
      resource: revisionDto(active.language, active.revision),
      entries: active.entries.map(entry => new DictionarySummaryDto(entry)),
      offset: active.offset,
      limit: active.limit,
      ...(active.nextOffset === undefined ? {} : { nextOffset: active.nextOffset }),
    })
  })

export const readDictionaryEntry = (input: DictionaryEntryLookup) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const active = yield* repository.findEntry(input)
    return new DictionaryEntryResponseDto({
      resource: revisionDto(active.language, active.revision),
      entry: new DictionaryEntryDto(active.entry),
    })
  })

export const readDictionaryEntryById = (input: DictionaryEntryIdLookup) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const active = yield* repository.findEntryById(input)
    return new DictionaryEntryResponseDto({
      resource: revisionDto(active.language, active.revision),
      entry: new DictionaryEntryDto(active.entry),
    })
  })

export const readDictionaryVerseWords = (input: DictionaryVerseLookup) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const active = yield* repository.findVerseWords(input)
    return new DictionaryVerseWordsResponseDto({
      resource: revisionDto(active.language, active.revision),
      verseKey: active.verseKey,
      words: [...active.words],
    })
  })
