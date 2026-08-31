import { Context, Data, Effect } from 'effect'

import {
  DictionaryCatalogResponseDto,
  DictionaryDirectoryItemDto,
  DictionaryDirectoryResponseDto,
  DictionaryDirectorySourceDto,
  DictionaryEntriesBatchResponseDto,
  DictionaryEntriesResponseDto,
  DictionaryPassageAnchorDto,
  DictionaryPassageAnchorsResponseDto,
  DictionaryPassageDiscoveryEntryDto,
  DictionaryPassageDiscoveryResponseDto,
  DictionaryEntryDto,
  DictionaryEntryResponseDto,
  DictionaryRevisionDto,
  DictionarySummaryDto,
  DictionaryVerseWordsResponseDto,
  DictionaryWorkDto,
} from '@bible-strong/resource-domain/contracts/dictionaryContract'

export type DictionaryLanguage = 'fr' | 'en'
export type DictionaryWorkId = string

export type DictionaryWork = {
  work: DictionaryWorkId
  language: DictionaryLanguage
  revision: string
  resourceId: string
  title: string
  abbreviation: string
  authors: readonly string[]
  description: string
  edition: string
  source: string
  attribution: string
  onlineAccess: boolean
  offlineDownload: boolean
}

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

type DictionaryResourceLookup = {
  work: DictionaryWorkId
  language: DictionaryLanguage
}

export type DictionaryListInput = DictionaryResourceLookup & {
  initial?: string
  search?: string
  limit?: number
  cursor?: string
}
export type DictionaryDirectoryInput = {
  language: DictionaryLanguage
  initial?: string
  search?: string
  limit?: number
  cursor?: string
}

export type DictionaryEntryLookup = DictionaryResourceLookup & { word: string }
export type DictionaryEntryIdLookup = DictionaryResourceLookup & { id: number }
export type DictionaryEntriesLookup = DictionaryResourceLookup & { words: readonly string[] }
export type DictionaryVerseLookup = DictionaryResourceLookup & { verseKey: string }
export type DictionaryPassageDiscoveryLookup = {
  verseKey: string
  language?: DictionaryLanguage
}

type ActiveDictionaryBase = DictionaryResourceLookup & { revision: string }
export type ActiveDictionaryList = ActiveDictionaryBase & {
  entries: readonly DictionarySummary[]
  limit: number
  nextCursor?: string
}
export type ActiveDictionaryEntry = ActiveDictionaryBase & { entry: DictionaryEntry }
export type ActiveDictionaryVerseWords = ActiveDictionaryBase & {
  verseKey: string
  words: readonly string[]
}
export type DictionaryPassageAnchor = DictionarySummary & {
  evidenceKind: 'source-citation'
}
export type ActiveDictionaryPassageAnchors = ActiveDictionaryBase & {
  verseKey: string
  entries: readonly DictionaryPassageAnchor[]
}
export type DictionaryPassageDiscoveryEntry = DictionaryPassageAnchor & {
  work: DictionaryWorkId
  language: DictionaryLanguage
  revision: string
  resourceId: string
  title: string
  abbreviation: string
  correspondenceId?: string
}
export type DictionaryDirectorySource = DictionarySummary & {
  work: DictionaryWorkId
  language: DictionaryLanguage
  revision: string
  resourceId: string
  title: string
  abbreviation: string
}
export type DictionaryDirectoryItem = {
  key: string
  label: string
  normalizedLabel: string
  correspondenceId?: string
  sources: readonly DictionaryDirectorySource[]
}
export type DictionaryDirectoryPage = {
  items: readonly DictionaryDirectoryItem[]
  limit: number
  nextCursor?: string
}

export class UnsupportedDictionaryLanguage extends Data.TaggedError(
  'UnsupportedDictionaryLanguage'
)<{ readonly language: DictionaryLanguage }> {}

export class ActiveDictionaryPublicationUnavailable extends Data.TaggedError(
  'ActiveDictionaryPublicationUnavailable'
)<DictionaryResourceLookup> {}

export class DictionaryEntryNotFound extends Data.TaggedError('DictionaryEntryNotFound')<
  DictionaryResourceLookup & {
    readonly word?: string
    readonly id?: number
  }
> {}

export class DictionaryRepositoryFailure extends Data.TaggedError('DictionaryRepositoryFailure')<{
  readonly cause: unknown
}> {}

export type DictionaryRepositoryError =
  | ActiveDictionaryPublicationUnavailable
  | DictionaryEntryNotFound
  | DictionaryRepositoryFailure

export type DictionaryRepositoryService = {
  listWorks: (
    language?: DictionaryLanguage
  ) => Effect.Effect<readonly DictionaryWork[], DictionaryRepositoryError>
  listEntries: (
    input: DictionaryListInput
  ) => Effect.Effect<ActiveDictionaryList, DictionaryRepositoryError>
  findEntry: (
    input: DictionaryEntryLookup
  ) => Effect.Effect<ActiveDictionaryEntry, DictionaryRepositoryError>
  findEntryById: (
    input: DictionaryEntryIdLookup
  ) => Effect.Effect<ActiveDictionaryEntry, DictionaryRepositoryError>
  findEntries: (
    input: DictionaryEntriesLookup
  ) => Effect.Effect<
    ActiveDictionaryBase & { entries: readonly DictionaryEntry[] },
    DictionaryRepositoryError
  >
  findVerseWords: (
    input: DictionaryVerseLookup
  ) => Effect.Effect<ActiveDictionaryVerseWords, DictionaryRepositoryError>
  findPassageAnchors: (
    input: DictionaryVerseLookup
  ) => Effect.Effect<ActiveDictionaryPassageAnchors, DictionaryRepositoryError>
  discoverPassageEntries: (
    input: DictionaryPassageDiscoveryLookup
  ) => Effect.Effect<readonly DictionaryPassageDiscoveryEntry[], DictionaryRepositoryError>
  browseDirectory: (
    input: DictionaryDirectoryInput
  ) => Effect.Effect<DictionaryDirectoryPage, DictionaryRepositoryError>
}

export class DictionaryRepository extends Context.Tag('DictionaryRepository')<
  DictionaryRepository,
  DictionaryRepositoryService
>() {}

const revisionDto = (work: DictionaryWorkId, language: DictionaryLanguage, revision: string) =>
  new DictionaryRevisionDto({ kind: 'dictionary', work, language, revision })

export const listDictionaryWorks = (language?: DictionaryLanguage) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const dictionaries = yield* repository.listWorks(language)
    return new DictionaryCatalogResponseDto({
      dictionaries: dictionaries.map(
        dictionary =>
          new DictionaryWorkDto({
            resource: revisionDto(dictionary.work, dictionary.language, dictionary.revision),
            resourceId: dictionary.resourceId,
            title: dictionary.title,
            abbreviation: dictionary.abbreviation,
            authors: [...dictionary.authors],
            description: dictionary.description,
            edition: dictionary.edition,
            source: dictionary.source,
            attribution: dictionary.attribution,
            onlineAccess: dictionary.onlineAccess,
            offlineDownload: dictionary.offlineDownload,
          })
      ),
    })
  })

export const browseDictionaryEntries = (input: DictionaryListInput) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const active = yield* repository.listEntries(input)
    return new DictionaryEntriesResponseDto({
      resource: revisionDto(active.work, active.language, active.revision),
      entries: active.entries.map(entry => new DictionarySummaryDto(entry)),
      limit: active.limit,
      ...(active.nextCursor === undefined ? {} : { nextCursor: active.nextCursor }),
    })
  })

export const browseDictionaryDirectory = (input: DictionaryDirectoryInput) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const page = yield* repository.browseDirectory(input)
    return new DictionaryDirectoryResponseDto({
      language: input.language,
      items: page.items.map(
        item =>
          new DictionaryDirectoryItemDto({
            key: item.key,
            label: item.label,
            normalizedLabel: item.normalizedLabel,
            ...(item.correspondenceId ? { correspondenceId: item.correspondenceId } : {}),
            sources: item.sources.map(
              source =>
                new DictionaryDirectorySourceDto({
                  resource: revisionDto(source.work, source.language, source.revision),
                  resourceId: source.resourceId,
                  title: source.title,
                  abbreviation: source.abbreviation,
                  id: source.id,
                  word: source.word,
                  normalizedWord: source.normalizedWord,
                })
            ),
          })
      ),
      limit: page.limit,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
    })
  })

export const readDictionaryEntry = (input: DictionaryEntryLookup) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const active = yield* repository.findEntry(input)
    return new DictionaryEntryResponseDto({
      resource: revisionDto(active.work, active.language, active.revision),
      entry: new DictionaryEntryDto(active.entry),
    })
  })

export const readDictionaryEntryById = (input: DictionaryEntryIdLookup) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const active = yield* repository.findEntryById(input)
    return new DictionaryEntryResponseDto({
      resource: revisionDto(active.work, active.language, active.revision),
      entry: new DictionaryEntryDto(active.entry),
    })
  })

export const readDictionaryEntries = (input: DictionaryEntriesLookup) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const active = yield* repository.findEntries(input)
    return new DictionaryEntriesBatchResponseDto({
      resource: revisionDto(active.work, active.language, active.revision),
      entries: active.entries.map(entry => new DictionaryEntryDto(entry)),
    })
  })

export const readDictionaryVerseWords = (input: DictionaryVerseLookup) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const active = yield* repository.findVerseWords(input)
    return new DictionaryVerseWordsResponseDto({
      resource: revisionDto(active.work, active.language, active.revision),
      verseKey: active.verseKey,
      words: [...active.words],
    })
  })

export const readDictionaryPassageAnchors = (input: DictionaryVerseLookup) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const active = yield* repository.findPassageAnchors(input)
    return new DictionaryPassageAnchorsResponseDto({
      resource: revisionDto(active.work, active.language, active.revision),
      verseKey: active.verseKey,
      entries: active.entries.map(entry => new DictionaryPassageAnchorDto(entry)),
    })
  })

export const discoverDictionaryPassageEntries = (input: DictionaryPassageDiscoveryLookup) =>
  Effect.gen(function* () {
    const repository = yield* DictionaryRepository
    const entries = yield* repository.discoverPassageEntries(input)
    return new DictionaryPassageDiscoveryResponseDto({
      verseKey: input.verseKey,
      entries: entries.map(
        entry =>
          new DictionaryPassageDiscoveryEntryDto({
            resource: revisionDto(entry.work, entry.language, entry.revision),
            resourceId: entry.resourceId,
            title: entry.title,
            abbreviation: entry.abbreviation,
            id: entry.id,
            word: entry.word,
            normalizedWord: entry.normalizedWord,
            evidenceKind: entry.evidenceKind,
            ...(entry.correspondenceId ? { correspondenceId: entry.correspondenceId } : {}),
          })
      ),
    })
  })
