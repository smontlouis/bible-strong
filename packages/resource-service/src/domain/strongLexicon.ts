import { Context, Data, Effect } from 'effect'

import {
  StrongLexiconChapterEntitiesResponseDto,
  StrongLexiconChapterEntityDto,
  StrongLexiconEntryDto,
  StrongLexiconEntryCardDto,
  StrongLexiconEntryCardsDto,
  StrongLexiconEntityResponseDto,
  StrongLexiconEntityDto,
  StrongLexiconEntityRelationDto,
  StrongLexiconModuleStateDto,
  StrongLexiconMorphologyDto,
  StrongLexiconMorphologyResponseDto,
  StrongLexiconRelationDto,
  StrongLexiconResourceDto,
  StrongLexiconSearchResultDto,
  StrongLexiconSearchResponseDto,
} from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import type {
  StrongLexiconChapterEntity,
  StrongLexiconEntry,
  StrongLexiconEntryCard,
  StrongLexiconEntity,
  StrongLexiconMorphology,
  StrongLexiconSearchResult,
  StrongLexiconPage,
} from '@bible-strong/resource-domain/strong-lexicon'
import type { StrongIdentityKind } from '@bible-strong/resource-domain/strong-identities'

export type StrongLexiconLanguage = 'fr' | 'en'
export type StrongLexicalLanguage = 'greek' | 'hebrew'
export type StrongLexiconModuleId = 'core' | 'resources' | 'entities'

export const STRONG_LEXICON_ENTRY_RESPONSE_REVISION = 'strong-lexicon-classic-relation-expansion-v1'

export type ActiveStrongLexiconValue<T> = { revision: string; value: T }
export type StrongLexiconModuleState = {
  moduleId: StrongLexiconModuleId
  status: 'available' | 'unavailable' | 'incompatible'
  revision?: string
  dependencyRevision?: string
}

export class ActiveStrongLexiconPublicationUnavailable extends Data.TaggedError(
  'ActiveStrongLexiconPublicationUnavailable'
)<{ readonly moduleId: StrongLexiconModuleId }> {}
export class StrongLexiconEntryNotFound extends Data.TaggedError('StrongLexiconEntryNotFound')<{
  readonly reference: string
}> {}
export class StrongLexiconEntityNotFound extends Data.TaggedError('StrongLexiconEntityNotFound')<{
  readonly uniqueName: string
}> {}
export class StrongLexiconRepositoryFailure extends Data.TaggedError(
  'StrongLexiconRepositoryFailure'
)<{ readonly cause: unknown }> {}

export type StrongLexiconRepositoryError =
  | ActiveStrongLexiconPublicationUnavailable
  | StrongLexiconEntryNotFound
  | StrongLexiconEntityNotFound
  | StrongLexiconRepositoryFailure

export type StrongLexiconRepositoryService = {
  getModuleState: (
    moduleId: StrongLexiconModuleId
  ) => Effect.Effect<StrongLexiconModuleState, StrongLexiconRepositoryFailure>
  findEntry: (input: {
    reference: string
    language: StrongLexiconLanguage
    kind?: StrongIdentityKind
  }) => Effect.Effect<ActiveStrongLexiconValue<StrongLexiconEntry>, StrongLexiconRepositoryError>
  findEntryCards?: (input: {
    identities: { reference: string; kind: StrongIdentityKind }[]
    language: StrongLexiconLanguage
  }) => Effect.Effect<
    ActiveStrongLexiconValue<StrongLexiconEntryCard>[],
    StrongLexiconRepositoryError
  >
  listEntries: (input: {
    language: StrongLexiconLanguage
    lexicalLanguage?: StrongLexicalLanguage
    search?: string
    prefix?: string
    limit: number
    cursor?: string
  }) => Effect.Effect<ActiveStrongLexiconValue<StrongLexiconPage>, StrongLexiconRepositoryError>
  findRandom: (input: {
    language: StrongLexiconLanguage
    lexicalLanguage: StrongLexicalLanguage
  }) => Effect.Effect<
    ActiveStrongLexiconValue<StrongLexiconSearchResult[]>,
    StrongLexiconRepositoryError
  >
  findMorphologies: (input: {
    language: StrongLexiconLanguage
    codes: string[]
  }) => Effect.Effect<
    ActiveStrongLexiconValue<StrongLexiconMorphology[]>,
    StrongLexiconRepositoryError
  >
  findEntity: (input: {
    language: StrongLexiconLanguage
    uniqueName: string
  }) => Effect.Effect<ActiveStrongLexiconValue<StrongLexiconEntity>, StrongLexiconRepositoryError>
  findChapterEntities: (input: {
    language: StrongLexiconLanguage
    bookCode: string
    chapter: number
    strongCodes: string[]
  }) => Effect.Effect<
    ActiveStrongLexiconValue<StrongLexiconChapterEntity[]>,
    StrongLexiconRepositoryError
  >
}

export class StrongLexiconRepository extends Context.Tag('StrongLexiconRepository')<
  StrongLexiconRepository,
  StrongLexiconRepositoryService
>() {}

const entityDto = (entity: StrongLexiconEntity) =>
  new StrongLexiconEntityDto({
    ...entity,
    relations: entity.relations.map(relation => new StrongLexiconEntityRelationDto(relation)),
  })

export const readStrongLexiconModuleState = (moduleId: StrongLexiconModuleId) =>
  Effect.gen(function* () {
    const state = yield* (yield* StrongLexiconRepository).getModuleState(moduleId)
    return new StrongLexiconModuleStateDto(state)
  })

const strongLexiconEntryDto = (active: ActiveStrongLexiconValue<StrongLexiconEntry>) => {
  const toState = (
    moduleId: 'resources' | 'entities',
    value: StrongLexiconEntry['modules']['resources']
  ) =>
    new StrongLexiconModuleStateDto({
      moduleId,
      status:
        value.status === 'available'
          ? 'available'
          : value.status === 'incompatible'
            ? 'incompatible'
            : 'unavailable',
      ...('revision' in value && value.revision ? { revision: value.revision } : {}),
    })
  return new StrongLexiconEntryDto({
    resource: { revision: active.revision },
    ...active.value,
    ...(active.value.morphology
      ? { morphology: new StrongLexiconMorphologyDto(active.value.morphology) }
      : {}),
    relations: active.value.relations.map(relation => new StrongLexiconRelationDto(relation)),
    resources: active.value.resources.map(resource => new StrongLexiconResourceDto(resource)),
    ...(active.value.entity ? { entity: entityDto(active.value.entity) } : {}),
    modules: {
      resources: toState('resources', active.value.modules.resources),
      entities: toState('entities', active.value.modules.entities),
    },
  })
}

export const readStrongLexiconEntry = (input: {
  reference: string
  language: StrongLexiconLanguage
  kind?: StrongIdentityKind
}) =>
  Effect.gen(function* () {
    const active = yield* (yield* StrongLexiconRepository).findEntry(input)
    return strongLexiconEntryDto(active)
  })

export const readStrongLexiconEntryCards = (input: {
  identities: { reference: string; kind: StrongIdentityKind }[]
  language: StrongLexiconLanguage
}) =>
  Effect.gen(function* () {
    const repository = yield* StrongLexiconRepository
    const values = repository.findEntryCards
      ? yield* repository.findEntryCards(input)
      : yield* Effect.all(
          input.identities.map(identity =>
            repository.findEntry({ ...identity, language: input.language }).pipe(
              Effect.catchIf(
                cause => cause instanceof StrongLexiconEntryNotFound,
                () => Effect.succeed(undefined)
              )
            )
          ),
          { concurrency: 8 }
        )
    return new StrongLexiconEntryCardsDto({
      entries: values
        .filter(
          (value): value is ActiveStrongLexiconValue<StrongLexiconEntryCard> => value !== undefined
        )
        .map(
          active =>
            new StrongLexiconEntryCardDto({
              resource: { revision: active.revision },
              ...active.value,
              ...(active.value.morphology
                ? { morphology: new StrongLexiconMorphologyDto(active.value.morphology) }
                : {}),
            })
        ),
    })
  })

export const browseStrongLexicon = (input: {
  language: StrongLexiconLanguage
  lexicalLanguage?: StrongLexicalLanguage
  search?: string
  prefix?: string
  limit: number
  cursor?: string
}) =>
  Effect.gen(function* () {
    const active = yield* (yield* StrongLexiconRepository).listEntries(input)
    return new StrongLexiconSearchResponseDto({
      resource: { revision: active.revision },
      entries: active.value.entries.map(entry => new StrongLexiconSearchResultDto(entry)),
      ...(active.value.nextCursor ? { nextCursor: active.value.nextCursor } : {}),
    })
  })

export const readRandomStrongLexiconEntry = (input: {
  language: StrongLexiconLanguage
  lexicalLanguage: StrongLexicalLanguage
}) =>
  Effect.gen(function* () {
    const active = yield* (yield* StrongLexiconRepository).findRandom(input)
    return new StrongLexiconSearchResponseDto({
      resource: { revision: active.revision },
      entries: active.value.map(entry => new StrongLexiconSearchResultDto(entry)),
    })
  })

export const readStrongLexiconMorphologies = (input: {
  language: StrongLexiconLanguage
  codes: string[]
}) =>
  Effect.gen(function* () {
    const active = yield* (yield* StrongLexiconRepository).findMorphologies(input)
    return new StrongLexiconMorphologyResponseDto({
      resource: { revision: active.revision },
      morphologies: active.value.map(morphology => new StrongLexiconMorphologyDto(morphology)),
    })
  })

export const readStrongLexiconEntity = (input: {
  language: StrongLexiconLanguage
  uniqueName: string
}) =>
  Effect.gen(function* () {
    const active = yield* (yield* StrongLexiconRepository).findEntity(input)
    return new StrongLexiconEntityResponseDto({
      resource: { revision: active.revision },
      entity: entityDto(active.value),
    })
  })

export const readStrongLexiconChapterEntities = (input: {
  language: StrongLexiconLanguage
  bookCode: string
  chapter: number
  strongCodes: string[]
}) =>
  Effect.gen(function* () {
    const active = yield* (yield* StrongLexiconRepository).findChapterEntities(input)
    return new StrongLexiconChapterEntitiesResponseDto({
      resource: { revision: active.revision },
      entities: active.value.map(
        entity => new StrongLexiconChapterEntityDto({ ...entity, verses: entity.verses })
      ),
    })
  })
