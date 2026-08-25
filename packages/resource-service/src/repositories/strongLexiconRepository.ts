import { Effect } from 'effect'
import { sql, type Kysely } from 'kysely'
import { normalizeBibleSearchText } from '@bible-strong/mobile/src/helpers/bibleSearchInput'

import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import type { ResourceDatabase } from '../database/types'
import {
  ActiveStrongLexiconPublicationUnavailable,
  StrongLexiconEntityNotFound,
  StrongLexiconEntryNotFound,
  StrongLexiconRepositoryFailure,
  type ActiveStrongLexiconValue,
  type StrongLexiconLanguage,
  type StrongLexiconModuleId,
  type StrongLexiconModuleState,
  type StrongLexiconRepositoryService,
} from '../domain/strongLexicon'
import type {
  StrongLexiconChapterEntity,
  StrongLexiconEntity,
  StrongLexiconEntityRelation,
  StrongLexiconEntry,
  StrongLexiconEntryCard,
  StrongLexiconMorphology,
  StrongLexiconSearchResult,
} from '@bible-strong/mobile/src/features/resources/strongLexiconAccess'
import {
  decodeStrongLexiconPageCursor,
  encodeStrongLexiconPageCursor,
} from '@bible-strong/mobile/src/features/resources/strongLexiconContract'
import {
  createStrongIdentity,
  getDisplayedStrongIdentities,
  type StrongIdentityKind,
} from '@bible-strong/mobile/src/helpers/strongIdentities'

type Payload = Record<string, string | number | null>
type Publication = { id: number; revision: string; metadata: Record<string, unknown> }

const DOMAIN_TABLE_SOURCES: Record<string, string> = {
  StepEntries: `SELECT publication_id, md5(payload::text) AS record_key, entry_id, language, e_strong AS code, NULL::text AS unique_name, payload FROM strong_lexicon_entries`,
  StepEntryIdentities: `SELECT publication_id, md5(step_entry_id::text || step_code) AS record_key, step_entry_id AS entry_id, NULL::text AS language, step_code AS code, NULL::text AS unique_name, jsonb_build_object('stepEntryId', step_entry_id, 'stepCode', step_code) AS payload FROM strong_lexicon_entry_identities`,
  LexiconTranslations: `SELECT publication_id, md5(step_entry_id::text || language) AS record_key, step_entry_id AS entry_id, language, NULL::text AS code, NULL::text AS unique_name, payload FROM strong_lexicon_translations`,
  LexiconRelations: `SELECT publication_id, md5(relation_id::text) AS record_key, from_entry_id AS entry_id, NULL::text AS language, NULL::text AS code, NULL::text AS unique_name, payload FROM strong_lexicon_relations`,
  RelationKinds: `SELECT publication_id, md5(relation_kind_id::text) AS record_key, relation_kind_id AS entry_id, NULL::text AS language, kind AS code, NULL::text AS unique_name, payload FROM strong_lexicon_relation_kinds`,
  MorphologyCodes: `SELECT publication_id, md5(morphology_code_id::text) AS record_key, morphology_code_id AS entry_id, language, code, NULL::text AS unique_name, payload FROM strong_lexicon_morphology_codes`,
  MorphologyCodeTranslations: `SELECT publication_id, md5(morphology_code_id::text || language) AS record_key, morphology_code_id AS entry_id, language, NULL::text AS code, NULL::text AS unique_name, payload FROM strong_lexicon_morphology_code_translations`,
  LexiconResources: `SELECT publication_id, md5(resource_id::text) AS record_key, step_entry_id AS entry_id, NULL::text AS language, NULL::text AS code, NULL::text AS unique_name, payload FROM strong_lexicon_resources`,
  LexiconResourceTranslations: `SELECT publication_id, md5(resource_id::text || language) AS record_key, resource_id AS entry_id, language, NULL::text AS code, NULL::text AS unique_name, payload FROM strong_lexicon_resource_translations`,
  Entities: `SELECT publication_id, md5(entity_id::text) AS record_key, entity_id AS entry_id, NULL::text AS language, NULL::text AS code, unique_name, payload FROM strong_lexicon_entities`,
  EntityTranslations: `SELECT publication_id, md5(translation_id::text) AS record_key, entity_id AS entry_id, language, NULL::text AS code, NULL::text AS unique_name, payload FROM strong_lexicon_entity_translations`,
  EntityRefs: `SELECT publication_id, md5(entity_id::text || book || chapter::text || verse::text || suffix) AS record_key, entity_id AS entry_id, NULL::text AS language, NULL::text AS code, NULL::text AS unique_name, payload FROM strong_lexicon_entity_refs`,
  EntityRelations: `SELECT publication_id, md5(relation_id::text) AS record_key, from_entity_id AS entry_id, NULL::text AS language, NULL::text AS code, NULL::text AS unique_name, payload FROM strong_lexicon_entity_relations`,
  EntityPlaces: `SELECT publication_id, md5(entity_id::text) AS record_key, entity_id AS entry_id, NULL::text AS language, NULL::text AS code, NULL::text AS unique_name, payload FROM strong_lexicon_entity_places`,
}

const text = (row: Payload, key: string): string =>
  typeof row[key] === 'string' ? row[key] : String(row[key] ?? '')
const number = (row: Payload, key: string): number => Number(row[key] ?? 0)
const localized = (language: StrongLexiconLanguage, translated: string, fallback: string) =>
  language === 'fr' && translated.trim() ? translated : fallback
const normalizeCode = (value: string) => value.trim().toUpperCase()
const normalizeText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase()

const classicStrong = (row: Payload) =>
  `${text(row, 'language') === 'greek' ? 'G' : 'H'}${String(number(row, 'baseCode')).padStart(4, '0')}`

const mapRepositoryCause = (
  cause: unknown
):
  | ActiveStrongLexiconPublicationUnavailable
  | StrongLexiconEntryNotFound
  | StrongLexiconEntityNotFound
  | StrongLexiconRepositoryFailure => {
  if (
    cause instanceof ActiveStrongLexiconPublicationUnavailable ||
    cause instanceof StrongLexiconEntryNotFound ||
    cause instanceof StrongLexiconEntityNotFound
  ) {
    return cause
  }
  if (cause && typeof cause === 'object' && 'cause' in cause) {
    return mapRepositoryCause(cause.cause)
  }
  return new StrongLexiconRepositoryFailure({ cause })
}

const moduleStateFrom = (
  moduleId: StrongLexiconModuleId,
  publication: Publication | undefined,
  coreRevision?: string
): StrongLexiconModuleState => {
  if (!publication) return { moduleId, status: 'unavailable' }
  const dependencies = publication.metadata.dependencies
  const dependencyRevision =
    Array.isArray(dependencies) && dependencies[0] && typeof dependencies[0] === 'object'
      ? String((dependencies[0] as Record<string, unknown>).revision ?? '')
      : undefined
  if (moduleId !== 'core' && dependencyRevision !== coreRevision) {
    return {
      moduleId,
      status: 'incompatible',
      revision: publication.revision,
      ...(dependencyRevision ? { dependencyRevision } : {}),
    }
  }
  return {
    moduleId,
    status: 'available',
    revision: publication.revision,
    ...(dependencyRevision ? { dependencyRevision } : {}),
  }
}

const moduleStateRevision = (state: StrongLexiconModuleState): string =>
  `${state.status}:${state.revision ?? ''}:${state.dependencyRevision ?? ''}`

const entryRepresentationRevision = (
  core: Publication,
  resources: StrongLexiconModuleState,
  entities: StrongLexiconModuleState
): string =>
  [
    `core:${core.revision}`,
    `resources:${moduleStateRevision(resources)}`,
    `entities:${moduleStateRevision(entities)}`,
  ].join('|')

const entityRepresentationRevision = (
  core: Publication,
  entities: StrongLexiconModuleState
): string => `core:${core.revision}|entities:${moduleStateRevision(entities)}`

export const makeKyselyStrongLexiconRepository = (
  database: Kysely<ResourceDatabase>
): StrongLexiconRepositoryService => {
  const activePublication = (moduleId: StrongLexiconModuleId) =>
    database
      .selectFrom('resource_publications')
      .select(['id', 'revision', 'metadata'])
      .where('resource_identity', '=', `strong-lexicon:${moduleId}`)
      .where('status', '=', 'active')
      .executeTakeFirst()

  const records = async (
    publicationId: number,
    tableName: string,
    configure?: (
      query: ReturnType<typeof database.selectFrom<'strong_lexicon_records'>>
    ) => ReturnType<typeof database.selectFrom<'strong_lexicon_records'>>
  ): Promise<Payload[]> => {
    const domainSource = DOMAIN_TABLE_SOURCES[tableName]
    const source = (
      domainSource
        ? sql<Record<string, unknown>>`(${sql.raw(domainSource)})`.as('strong_lexicon_records')
        : sql<Record<string, unknown>>`strong_lexicon_records`.as('strong_lexicon_records')
    ) as never
    let query: any = (database.selectFrom(source) as any)
      .selectAll()
      .where('publication_id', '=', publicationId)
    if (!domainSource) query = query.where('table_name', '=', tableName)
    if (configure) query = configure(query)
    return (
      (await query.orderBy('entry_id').orderBy('record_key').execute()) as {
        payload: Payload
      }[]
    ).map(row => row.payload)
  }

  const getState = async (moduleId: StrongLexiconModuleId) => {
    const [publication, core] = await Promise.all([
      activePublication(moduleId),
      moduleId === 'core' ? Promise.resolve(undefined) : activePublication('core'),
    ])
    return moduleStateFrom(moduleId, publication, core?.revision)
  }

  const requiredCore = async (): Promise<Publication> => {
    const core = await activePublication('core')
    if (!core) throw new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'core' })
    return core
  }

  const translationFor = async (
    publicationId: number,
    tableName: string,
    entryId: number,
    language: StrongLexiconLanguage
  ) =>
    (
      await records(publicationId, tableName, query =>
        query.where('entry_id', '=', entryId).where('language', '=', language)
      )
    )[0]

  const searchResult = (
    entry: Payload,
    identity: Payload,
    translation: Payload | undefined,
    language: StrongLexiconLanguage
  ): StrongLexiconSearchResult => ({
    id: number(entry, 'id'),
    stepCode: text(identity, 'stepCode'),
    classicStrong: classicStrong(entry),
    language: text(entry, 'language') === 'greek' ? 'greek' : 'hebrew',
    original: text(entry, 'original'),
    transliteration: text(entry, 'classicTransliteration') || text(entry, 'transliteration'),
    gloss: localized(language, text(translation ?? {}, 'gloss'), text(entry, 'gloss')),
  })

  const findCoreEntry = async (core: Publication, reference: string, kind?: StrongIdentityKind) => {
    const normalized = normalizeCode(reference)
    const identity =
      kind === 'ustrong'
        ? undefined
        : (
            await records(core.id, 'StepEntryIdentities', query =>
              query.where('code', '=', normalized)
            )
          )[0]
    const base = Number(normalized.replace(/^[HG]/u, '').replace(/^0+/u, ''))
    const identityEntry = identity
      ? (
          await records(core.id, 'StepEntries', query =>
            query.where('entry_id', '=', number(identity, 'stepEntryId'))
          )
        )[0]
      : undefined
    const entry =
      identityEntry ??
      (kind === 'dstrong'
        ? (
            await records(core.id, 'StepEntries', query =>
              query.where(sql<boolean>`upper(payload->>'dStrong') LIKE ${`${normalized}%`}`)
            )
          )[0]
        : kind === 'estrong'
          ? (
              await records(core.id, 'StepEntries', query =>
                query.where(sql<boolean>`upper(payload->>'eStrong') = ${normalized}`)
              )
            )[0]
          : kind === 'ustrong'
            ? (
                await records(core.id, 'StepEntries', query =>
                  query.where(sql<boolean>`upper(payload->>'uStrong') = ${normalized}`)
                )
              )[0]
            : (
                await records(core.id, 'StepEntries', query =>
                  query.where(
                    sql<boolean>`(upper(payload->>'eStrong') = ${normalized} OR upper(payload->>'dStrong') = ${normalized} OR upper(payload->>'uStrong') = ${normalized} OR ((payload->>'baseCode')::integer = ${Number.isFinite(base) ? base : -1} AND payload->>'language' = ${normalized.startsWith('G') ? 'greek' : 'hebrew'}))`
                  )
                )
              )[0])
    if (!entry) return undefined
    const resolvedIdentity =
      identity && number(identity, 'stepEntryId') === number(entry, 'id')
        ? identity
        : (
            await records(core.id, 'StepEntryIdentities', query =>
              query.where('entry_id', '=', number(entry, 'id'))
            )
          )[0]
    return resolvedIdentity ? { entry, identity: resolvedIdentity } : undefined
  }

  const findEntryCardsBatch = async (input: {
    identities: { reference: string; kind: StrongIdentityKind }[]
    language: StrongLexiconLanguage
  }): Promise<ActiveStrongLexiconValue<StrongLexiconEntryCard>[]> => {
    if (!input.identities.length) return []
    const core = await requiredCore()
    const references = [
      ...new Set(input.identities.map(identity => normalizeCode(identity.reference))),
    ]
    const requestedIdentityRows = await records(core.id, 'StepEntryIdentities', query =>
      query.where('code', 'in', references)
    )
    const requestedEntryIds = requestedIdentityRows.map(row => number(row, 'stepEntryId'))
    const referenceSql = sql.join(references.map(reference => sql`${reference}`))
    const baseFilters = input.identities.map(identity => {
      const reference = normalizeCode(identity.reference)
      const base = Number(reference.replace(/^[HG]/u, '').replace(/^0+/u, ''))
      return sql<boolean>`(
        (payload->>'baseCode')::integer = ${Number.isFinite(base) ? base : -1}
        AND payload->>'language' = ${reference.startsWith('G') ? 'greek' : 'hebrew'}
      )`
    })
    const entryIdFilter = requestedEntryIds.length
      ? sql<boolean>`entry_id IN (${sql.join(requestedEntryIds.map(id => sql`${id}`))})`
      : sql<boolean>`false`
    const entries = await records(core.id, 'StepEntries', query =>
      query.where(sql<boolean>`(
        ${entryIdFilter}
        OR upper(payload->>'eStrong') IN (${referenceSql})
        OR upper(payload->>'dStrong') IN (${referenceSql})
        OR upper(payload->>'uStrong') IN (${referenceSql})
        OR ${sql.join(baseFilters, sql` OR `)}
      )`)
    )
    if (!entries.length) return []
    const entryIds = entries.map(entry => number(entry, 'id'))
    const [identities, translations, morphologyRows] = await Promise.all([
      records(core.id, 'StepEntryIdentities', query => query.where('entry_id', 'in', entryIds)),
      records(core.id, 'LexiconTranslations', query =>
        query.where('entry_id', 'in', entryIds).where('language', '=', input.language)
      ),
      records(core.id, 'MorphologyCodes'),
    ])
    const morphologyIds = morphologyRows.map(row => number(row, 'id'))
    const morphologyTranslations = morphologyIds.length
      ? await records(core.id, 'MorphologyCodeTranslations', query =>
          query.where('entry_id', 'in', morphologyIds).where('language', '=', input.language)
        )
      : []
    return input.identities.flatMap(requested => {
      const reference = normalizeCode(requested.reference)
      const requestedIdentity = requestedIdentityRows.find(
        identity => text(identity, 'stepCode') === reference
      )
      const base = Number(reference.replace(/^[HG]/u, '').replace(/^0+/u, ''))
      const lexicalLanguage = reference.startsWith('G') ? 'greek' : 'hebrew'
      const entry = entries
        .map((candidate, index) => {
          const candidateId = number(candidate, 'id')
          let rank: number | undefined

          if (requestedIdentity && candidateId === number(requestedIdentity, 'stepEntryId')) {
            rank = 0
          } else if (
            requested.kind === 'dstrong' &&
            text(candidate, 'dStrong').startsWith(reference)
          ) {
            rank = 1
          } else if (requested.kind === 'estrong' && text(candidate, 'eStrong') === reference) {
            rank = 1
          } else if (requested.kind === 'ustrong' && text(candidate, 'uStrong') === reference) {
            rank = 1
          } else if (
            requested.kind === 'strong' &&
            number(candidate, 'baseCode') === base &&
            text(candidate, 'language') === lexicalLanguage
          ) {
            rank = 1
          } else if (
            [
              text(candidate, 'eStrong'),
              text(candidate, 'dStrong'),
              text(candidate, 'uStrong'),
            ].includes(reference)
          ) {
            rank = 2
          }

          return rank === undefined ? undefined : { candidate, index, rank }
        })
        .filter(
          (match): match is { candidate: Payload; index: number; rank: number } =>
            match !== undefined
        )
        .sort((left, right) => left.rank - right.rank || left.index - right.index)[0]?.candidate
      if (!entry) return []
      const entryId = number(entry, 'id')
      const entryIdentities = identities.filter(
        candidate => number(candidate, 'stepEntryId') === entryId
      )
      const identity =
        entryIdentities.find(candidate => text(candidate, 'stepCode') === reference) ??
        entryIdentities[0]
      if (!identity) return []
      const translation =
        translations.find(candidate => number(candidate, 'stepEntryId') === entryId) ?? {}
      const morphologyRow = morphologyRows.find(
        row =>
          text(row, 'scope') === 'lexical_brief' &&
          [text(row, 'code'), text(row, 'normalizedCode')].includes(text(entry, 'morph'))
      )
      const morphologyTranslation = morphologyRow
        ? (morphologyTranslations.find(
            row => number(row, 'morphologyCodeId') === number(morphologyRow, 'id')
          ) ?? {})
        : {}
      const meaning = morphologyRow
        ? localized(
            input.language,
            text(morphologyTranslation, 'meaning'),
            text(morphologyRow, 'meaning')
          )
        : ''
      const definition = localized(
        input.language,
        text(translation, 'meaningHtml') || text(translation, 'meaning'),
        text(entry, 'meaning')
      )
      const nameMeaning = localized(
        input.language,
        text(entry, 'nameMeaningFrHtml'),
        text(entry, 'nameMeaningEnHtml')
      )
      return [
        {
          revision: `core:${core.revision}`,
          value: {
            id: entryId,
            selectedIdentity: {
              kind: requested.kind,
              code: reference,
            },
            stepCode: text(identity, 'stepCode'),
            classicStrong: classicStrong(entry),
            eStrong: text(entry, 'eStrong'),
            dStrong: text(entry, 'dStrong'),
            language: text(entry, 'language') === 'greek' ? 'greek' : 'hebrew',
            baseCode: number(entry, 'baseCode'),
            original: text(entry, 'original'),
            transliteration:
              text(entry, 'classicTransliteration') || text(entry, 'transliteration'),
            ...(text(entry, 'pronunciation')
              ? { pronunciation: text(entry, 'pronunciation') }
              : {}),
            gloss: localized(input.language, text(translation, 'gloss'), text(entry, 'gloss')),
            ...(nameMeaning ? { nameMeaningHtml: nameMeaning } : {}),
            ...(definition ? { definitionHtml: definition } : {}),
            ...(morphologyRow ? { morphology: { code: text(entry, 'morph'), meaning } } : {}),
          },
        },
      ]
    })
  }

  const hydrateEntity = async (
    core: Publication,
    entityPublication: Publication,
    entity: Payload,
    language: StrongLexiconLanguage
  ): Promise<StrongLexiconEntity> => {
    const entityId = number(entity, 'id')
    const [translation, place, relationRows] = await Promise.all([
      translationFor(entityPublication.id, 'EntityTranslations', entityId, language),
      records(entityPublication.id, 'EntityPlaces', query =>
        query.where('entry_id', '=', entityId)
      ).then(rows => rows[0]),
      records(entityPublication.id, 'EntityRelations', query =>
        query.where('entry_id', '=', entityId)
      ),
    ])
    const targetIds = [
      ...new Set(relationRows.map(relation => number(relation, 'toEntityId')).filter(id => id > 0)),
    ]
    const targetNames = [
      ...new Set(
        relationRows
          .map(relation => text(relation, 'toUniqueName').split('|').at(-1) ?? '')
          .filter(Boolean)
      ),
    ]
    const targetRows =
      targetIds.length || targetNames.length
        ? await records(entityPublication.id, 'Entities', query => {
            const idFilter = targetIds.length
              ? sql<boolean>`entry_id IN (${sql.join(targetIds.map(id => sql`${id}`))})`
              : sql<boolean>`false`
            const nameFilter = targetNames.length
              ? sql<boolean>`unique_name IN (${sql.join(targetNames.map(name => sql`${name}`))})`
              : sql<boolean>`false`
            return query.where(sql<boolean>`(${idFilter} OR ${nameFilter})`)
          })
        : []
    const targetTranslations = targetRows.length
      ? await records(entityPublication.id, 'EntityTranslations', query =>
          query
            .where(
              'entry_id',
              'in',
              targetRows.map(row => number(row, 'id'))
            )
            .where('language', '=', language)
        )
      : []
    const relevantUStrongs = [
      ...new Set([entity, ...targetRows].map(row => text(row, 'uStrong')).filter(Boolean)),
    ]
    const coreEntries = relevantUStrongs.length
      ? await records(core.id, 'StepEntries', query =>
          query.where(
            sql<boolean>`payload->>'uStrong' IN (${sql.join(relevantUStrongs.map(code => sql`${code}`))})`
          )
        )
      : []
    const coreIdentities = coreEntries.length
      ? await records(core.id, 'StepEntryIdentities', query =>
          query.where(
            'entry_id',
            'in',
            coreEntries.map(row => number(row, 'id'))
          )
        )
      : []
    const codesForUStrong = (uStrong: string) =>
      getDisplayedStrongIdentities(
        coreEntries
          .filter(row => text(row, 'uStrong') === uStrong)
          .flatMap(row =>
            coreIdentities
              .filter(identity => number(identity, 'stepEntryId') === number(row, 'id'))
              .map(identity => {
                const code = text(identity, 'stepCode')
                return createStrongIdentity(
                  code,
                  code.toUpperCase().startsWith('G') ? 'greek' : 'hebrew'
                )
              })
          )
      ).map(identity => identity.code)
    const resolvedRelations: {
      relation: Payload
      target?: Payload
      targetTranslation?: Payload
    }[] = relationRows.map(relation => {
      const targetUniqueName = text(relation, 'toUniqueName').split('|').at(-1) ?? ''
      const targetId = number(relation, 'toEntityId')
      const target =
        targetId > 0
          ? targetRows.find(row => number(row, 'id') === targetId)
          : targetRows.find(row => text(row, 'uniqueName') === targetUniqueName)
      const targetTranslation = target
        ? targetTranslations.find(
            translated => number(translated, 'entityId') === number(target, 'id')
          )
        : undefined
      return { relation, target, targetTranslation }
    })
    const relations: StrongLexiconEntityRelation[] = resolvedRelations
      .sort((left, right) => {
        const relationOrder = text(left.relation, 'relation').localeCompare(
          text(right.relation, 'relation')
        )
        if (relationOrder !== 0) return relationOrder
        return text(left.target ?? {}, 'displayName').localeCompare(
          text(right.target ?? {}, 'displayName')
        )
      })
      .slice(0, 60)
      .map(({ relation, target, targetTranslation }) => {
        const targetUniqueName = text(relation, 'toUniqueName').split('|').at(-1) ?? ''
        return {
          relation: text(relation, 'relation'),
          certainty: text(relation, 'certainty'),
          ...(target ? { targetId: number(target, 'id') } : {}),
          ...(target ? { targetUniqueName: text(target, 'uniqueName') } : {}),
          ...(target && codesForUStrong(text(target, 'uStrong')).length
            ? { targetStepCodes: codesForUStrong(text(target, 'uStrong')) }
            : {}),
          ...(target
            ? { targetCategory: text(target, 'category'), targetType: text(target, 'type') }
            : {}),
          targetName: (
            localized(
              language,
              text(targetTranslation ?? {}, 'displayName'),
              text(target ?? {}, 'displayName')
            ) || targetUniqueName
          ).replace(/_+/gu, ' '),
        }
      })
    return {
      id: entityId,
      uniqueName: text(entity, 'uniqueName'),
      strongCodes: codesForUStrong(text(entity, 'uStrong')),
      name: localized(
        language,
        text(translation ?? {}, 'displayName'),
        text(entity, 'displayName')
      ).replace(/_+/gu, ' '),
      category: text(entity, 'category'),
      type: text(entity, 'type'),
      description: localized(
        language,
        text(translation ?? {}, 'description'),
        text(entity, 'description')
      ),
      shortDescription: localized(
        language,
        text(translation ?? {}, 'shortDescription'),
        text(entity, 'shortDescription')
      ),
      summaryHtml: localized(
        language,
        text(translation ?? {}, 'summaryHtml'),
        text(entity, 'summaryHtml')
      ),
      brief: localized(language, text(translation ?? {}, 'brief'), text(entity, 'brief')),
      articleHtml: localized(
        language,
        text(translation ?? {}, 'articleHtml'),
        text(entity, 'articleHtml')
      ),
      ...(place
        ? {
            place: {
              name: text(place, 'openBibleName').replace(/_+/gu, ' '),
              area: text(place, 'area'),
              ...(place.latitude == null ? {} : { latitude: number(place, 'latitude') }),
              ...(place.longitude == null ? {} : { longitude: number(place, 'longitude') }),
              ...(text(place, 'googleMapUrl') ? { googleMapUrl: text(place, 'googleMapUrl') } : {}),
              ...(text(place, 'palopenmapsUrl')
                ? { palopenmapsUrl: text(place, 'palopenmapsUrl') }
                : {}),
            },
          }
        : {}),
      relations,
    }
  }

  return {
    findEntryCards: input =>
      tryDatabasePromise('strong-lexicon.entries-batch', () => findEntryCardsBatch(input)).pipe(
        Effect.mapError(mapRepositoryCause)
      ),
    getModuleState: moduleId =>
      tryDatabasePromise('strong-lexicon.module-state', () => getState(moduleId)).pipe(
        Effect.mapError(cause => new StrongLexiconRepositoryFailure({ cause }))
      ),

    findEntry: input =>
      tryDatabasePromise('strong-lexicon.entry', async () => {
        const core = await requiredCore()
        const found = await findCoreEntry(core, input.reference, input.kind)
        if (!found) throw new StrongLexiconEntryNotFound({ reference: input.reference })
        const { entry, identity } = found
        const entryId = number(entry, 'id')
        const [
          translation,
          relationRows,
          relationKinds,
          morphologyRows,
          resourcesState,
          entitiesState,
        ] = await Promise.all([
          translationFor(core.id, 'LexiconTranslations', entryId, input.language),
          records(core.id, 'LexiconRelations', query => query.where('entry_id', '=', entryId)).then(
            rows =>
              rows.sort((left, right) => number(left, 'sortOrder') - number(right, 'sortOrder'))
          ),
          records(core.id, 'RelationKinds'),
          records(core.id, 'MorphologyCodes'),
          getState('resources'),
          getState('entities'),
        ])
        const targetIds = relationRows.map(row => number(row, 'toStepEntryId')).filter(Boolean)
        const targetEntries = targetIds.length
          ? await records(core.id, 'StepEntries', query => query.where('entry_id', 'in', targetIds))
          : []
        const relationTranslations = targetEntries.length
          ? await records(core.id, 'LexiconTranslations', query =>
              query
                .where(
                  'entry_id',
                  'in',
                  targetEntries.map(row => number(row, 'id'))
                )
                .where('language', '=', input.language)
            )
          : []
        const morphologyRow = morphologyRows.find(
          row =>
            text(row, 'scope') === 'lexical_brief' &&
            [text(row, 'code'), text(row, 'normalizedCode')].includes(text(entry, 'morph'))
        )
        let morphology: StrongLexiconMorphology | undefined
        if (morphologyRow) {
          const translated = await translationFor(
            core.id,
            'MorphologyCodeTranslations',
            number(morphologyRow, 'id'),
            input.language
          )
          const meaning = localized(
            input.language,
            text(translated ?? {}, 'meaning'),
            text(morphologyRow, 'meaning')
          )
          const description = localized(
            input.language,
            text(translated ?? {}, 'description'),
            text(morphologyRow, 'description')
          )
          morphology = {
            code: text(entry, 'morph'),
            meaning,
            ...(description && normalizeText(description) !== normalizeText(meaning)
              ? { description }
              : {}),
          }
        }
        const resourcePublication =
          resourcesState.status === 'available' ? await activePublication('resources') : undefined
        const resourceRows = resourcePublication
          ? (
              await records(resourcePublication.id, 'LexiconResources', query =>
                query.where('entry_id', '=', entryId)
              )
            ).sort((left, right) => number(left, 'id') - number(right, 'id'))
          : []
        const resourceTranslations =
          resourcePublication && resourceRows.length
            ? await records(resourcePublication.id, 'LexiconResourceTranslations', query =>
                query
                  .where(
                    'entry_id',
                    'in',
                    resourceRows.map(row => number(row, 'id'))
                  )
                  .where('language', '=', input.language)
              )
            : []
        let entity: StrongLexiconEntity | undefined
        if (entitiesState.status === 'available') {
          const entityPublication = await activePublication('entities')
          let entityCandidates = entityPublication
            ? await records(entityPublication.id, 'Entities', query =>
                query.where(
                  sql<boolean>`(payload->>'uStrong' = ${text(entry, 'uStrong')} OR payload->>'uStrong' = ${text(entry, 'eStrong')})`
                )
              )
            : []
          if (entityPublication && entityCandidates.length === 0) {
            const prefix = text(entry, 'language') === 'greek' ? 'G' : 'H'
            const baseCode = number(entry, 'baseCode')
            const gloss = normalizeText(text(entry, 'gloss'))
            entityCandidates = (
              await records(entityPublication.id, 'Entities', query =>
                query.where(
                  sql<boolean>`upper(payload->>'uStrong') ~ ${`^${prefix}0*${baseCode}(?:[^0-9]|$)`}`
                )
              )
            ).filter(row => {
              const match = text(row, 'uStrong').match(/^([HG])0*(\d+)/u)
              return Boolean(
                match &&
                match[1] === prefix &&
                Number(match[2]) === baseCode &&
                normalizeText(text(row, 'displayName')) === gloss
              )
            })
          }
          const entityRow = entityCandidates.sort(
            (left, right) =>
              (text(left, 'uStrong') === text(entry, 'uStrong') ? 0 : 1) -
                (text(right, 'uStrong') === text(entry, 'uStrong') ? 0 : 1) ||
              number(left, 'id') - number(right, 'id')
          )[0]
          if (entityPublication && entityRow) {
            entity = await hydrateEntity(core, entityPublication, entityRow, input.language)
          }
        }
        const selectedCode = text(identity, 'stepCode')
        const selectedKind =
          input.kind ??
          (normalizeCode(input.reference) === text(entry, 'dStrong')
            ? 'dstrong'
            : normalizeCode(input.reference) === text(entry, 'eStrong')
              ? 'estrong'
              : normalizeCode(input.reference) === text(entry, 'uStrong')
                ? 'ustrong'
                : 'strong')
        const relationGroupOrder: Record<string, number> = { family: 0, identity: 1, subentry: 2 }
        const relationRowsForDisplay = relationRows
          .slice()
          .sort(
            (left, right) =>
              (relationGroupOrder[text(left, 'groupKind')] ?? 99) -
                (relationGroupOrder[text(right, 'groupKind')] ?? 99) ||
              number(left, 'sortOrder') - number(right, 'sortOrder')
          )
          .filter((row, _index, rows) => {
            const group = text(row, 'groupKind')
            return (
              rows
                .slice(0, rows.indexOf(row) + 1)
                .filter(candidate => text(candidate, 'groupKind') === group).length <= 24
            )
          })
          .slice(0, 72)
        let lsjAbsent = false
        const resources = resourceRows.slice(0, 5).flatMap(row => {
          const translatedResource = resourceTranslations.find(
            translated => number(translated, 'resourceId') === number(row, 'id')
          )
          const contentHtml = localized(
            input.language,
            text(translatedResource ?? {}, 'contentHtml'),
            text(row, 'contentHtml')
          )
          if (
            /LSJ (?:has|ne possède) no entry|Le LSJ ne contient aucune entrée/iu.test(contentHtml)
          ) {
            lsjAbsent = true
            return []
          }
          return [
            {
              id: number(row, 'id'),
              source: text(row, 'source'),
              kind: text(row, 'kind'),
              title:
                text(row, 'source') === 'TFLSJ'
                  ? input.language === 'fr'
                    ? 'Dictionnaire grec détaillé'
                    : 'Detailed Greek dictionary'
                  : input.language === 'fr'
                    ? 'Notice complémentaire'
                    : 'Additional resource',
              contentHtml,
            },
          ]
        })
        const value: StrongLexiconEntry = {
          id: entryId,
          selectedIdentity: { kind: selectedKind, code: selectedCode },
          stepCode: selectedCode,
          classicStrong: classicStrong(entry),
          eStrong: text(entry, 'eStrong'),
          dStrong: text(entry, 'dStrong'),
          language: text(entry, 'language') === 'greek' ? 'greek' : 'hebrew',
          baseCode: number(entry, 'baseCode'),
          original: text(entry, 'original'),
          transliteration: text(entry, 'classicTransliteration') || text(entry, 'transliteration'),
          ...(text(entry, 'pronunciation') ? { pronunciation: text(entry, 'pronunciation') } : {}),
          gloss: localized(input.language, text(translation ?? {}, 'gloss'), text(entry, 'gloss')),
          ...(localized(
            input.language,
            text(entry, 'nameMeaningFrHtml'),
            text(entry, 'nameMeaningEnHtml')
          )
            ? {
                nameMeaningHtml: localized(
                  input.language,
                  text(entry, 'nameMeaningFrHtml'),
                  text(entry, 'nameMeaningEnHtml')
                ),
              }
            : {}),
          ...(localized(
            input.language,
            text(translation ?? {}, 'meaningHtml') || text(translation ?? {}, 'meaning'),
            text(entry, 'meaning')
          )
            ? {
                definitionHtml: localized(
                  input.language,
                  text(translation ?? {}, 'meaningHtml') || text(translation ?? {}, 'meaning'),
                  text(entry, 'meaning')
                ),
              }
            : {}),
          ...(morphology ? { morphology } : {}),
          relations: relationRowsForDisplay.map(relation => {
            const target = targetEntries.find(
              row => number(row, 'id') === number(relation, 'toStepEntryId')
            )
            const targetTranslation = target
              ? relationTranslations.find(
                  translated => number(translated, 'stepEntryId') === number(target, 'id')
                )
              : undefined
            const kind = relationKinds.find(
              row => number(row, 'id') === number(relation, 'relationKindId')
            )
            return {
              group: text(relation, 'groupKind') as 'subentry' | 'identity' | 'family',
              relationKind: text(kind ?? {}, 'kind'),
              label:
                input.language === 'fr'
                  ? text(kind ?? {}, 'labelFr') || text(kind ?? {}, 'labelEn')
                  : text(kind ?? {}, 'labelEn'),
              stepCode: text(relation, 'toStepCode'),
              gloss: localized(
                input.language,
                text(targetTranslation ?? {}, 'gloss'),
                text(target ?? {}, 'gloss')
              ),
              original: text(target ?? {}, 'original'),
              transliteration:
                text(target ?? {}, 'classicTransliteration') ||
                text(target ?? {}, 'transliteration'),
            }
          }),
          resources,
          lsjAbsent,
          ...(entity ? { entity } : {}),
          modules: {
            resources: resourcesState as never,
            entities: entitiesState as never,
          },
        }
        return {
          revision: entryRepresentationRevision(core, resourcesState, entitiesState),
          value,
        }
      }).pipe(Effect.mapError(mapRepositoryCause)),

    listEntries: input =>
      tryDatabasePromise('strong-lexicon.entries', async () => {
        const core = await requiredCore()
        const search = input.search?.trim()
        const prefix = input.prefix?.trim()
        const cursor = decodeStrongLexiconPageCursor(input.cursor)
        const filters = [sql<boolean>`representative_rank = 1`]
        const candidateFilters = [sql<boolean>`e.publication_id=${core.id}`]
        if (input.lexicalLanguage) {
          candidateFilters.push(sql<boolean>`e.language = ${input.lexicalLanguage}`)
        }
        if (search) {
          const pattern = `%${normalizeBibleSearchText(search)}%`
          candidateFilters.push(
            sql<boolean>`(
              bible_search_normalize(coalesce(e.payload->>'original', '') || ' ' || coalesce(nullif(e.payload->>'classicTransliteration', ''), e.payload->>'transliteration', '') || ' ' || coalesce(e.payload->>'gloss', '') || ' ' || e.e_strong || ' ' || e.d_strong || ' ' || e.u_strong) LIKE ${pattern}
              OR bible_search_normalize(i.step_code) LIKE ${pattern}
              OR bible_search_normalize(coalesce(tr.payload->>'gloss', '')) LIKE ${pattern}
            )`
          )
        }
        if (prefix) {
          const pattern = `${prefix.toLocaleLowerCase()}%`
          candidateFilters.push(
            input.language === 'fr'
              ? sql<boolean>`lower(coalesce(nullif(tr.payload->>'gloss', ''), e.payload->>'gloss', '')) LIKE ${pattern}`
              : sql<boolean>`lower(coalesce(e.payload->>'gloss', '')) LIKE ${pattern}`
          )
        }
        if (cursor) {
          filters.push(
            sql<boolean>`(sort_gloss, base_code, entry_id) > (${cursor.gloss}, ${cursor.baseCode}, ${cursor.id})`
          )
        }
        type ListRow = {
          entry_id: number
          language: string
          base_code: number
          step_code: string
          original: string
          transliteration: string
          gloss: string
          sort_gloss: string
        }
        const result = await sql<ListRow>`
          WITH candidates AS (
            SELECT e.entry_id,
                   e.language,
                   (e.payload->>'baseCode')::integer AS base_code,
                   e.e_strong,
                   e.d_strong,
                   e.u_strong,
                   i.step_code,
                   e.payload->>'original' AS original,
                   COALESCE(NULLIF(e.payload->>'classicTransliteration', ''), e.payload->>'transliteration', '') AS transliteration,
                   CASE WHEN ${input.language} = 'fr'
                     THEN COALESCE(NULLIF(tr.payload->>'gloss', ''), e.payload->>'gloss', '')
                     ELSE COALESCE(e.payload->>'gloss', '')
                   END AS gloss,
                   lower(CASE WHEN ${input.language} = 'fr'
                     THEN COALESCE(NULLIF(tr.payload->>'gloss', ''), e.payload->>'gloss', '')
                     ELSE COALESCE(e.payload->>'gloss', '')
                   END) AS sort_gloss,
                   row_number() OVER (
                     PARTITION BY e.language, COALESCE(NULLIF(e.u_strong, ''), e.entry_id::text)
                     ORDER BY CASE WHEN i.step_code=e.u_strong THEN 0 ELSE 1 END, e.entry_id
                   ) AS representative_rank
              FROM strong_lexicon_entries e
              JOIN strong_lexicon_entry_identities i
                ON i.publication_id=e.publication_id AND i.step_entry_id=e.entry_id
              LEFT JOIN strong_lexicon_translations tr
                ON tr.publication_id=e.publication_id
               AND tr.step_entry_id=e.entry_id
               AND tr.language=${input.language}
             WHERE ${sql.join(candidateFilters, sql` AND `)}
          )
          SELECT entry_id, language, base_code, step_code, original, transliteration, gloss, sort_gloss
            FROM candidates
           WHERE ${sql.join(filters, sql` AND `)}
           ORDER BY sort_gloss, base_code, entry_id
           LIMIT ${input.limit + 1}
        `.execute(database)
        const rows = result.rows
        const hasNextPage = rows.length > input.limit
        const selected = rows.slice(0, input.limit)
        const last = selected.at(-1)
        return {
          revision: core.revision,
          value: {
            entries: selected.map(row => ({
              id: row.entry_id,
              stepCode: row.step_code,
              classicStrong: `${row.language === 'greek' ? 'G' : 'H'}${String(row.base_code).padStart(4, '0')}`,
              language: (row.language === 'greek' ? 'greek' : 'hebrew') as 'greek' | 'hebrew',
              original: row.original,
              transliteration: row.transliteration,
              gloss: row.gloss,
            })),
            ...(hasNextPage && last
              ? {
                  nextCursor: encodeStrongLexiconPageCursor({
                    gloss: last.sort_gloss,
                    baseCode: last.base_code,
                    id: last.entry_id,
                  }),
                }
              : {}),
          },
        }
      }).pipe(Effect.mapError(mapRepositoryCause)),

    findRandom: input =>
      tryDatabasePromise('strong-lexicon.random', async () => {
        const core = await requiredCore()
        type RandomRow = { payload: Payload; step_code: string; translation: Payload | null }
        const randomResult = await sql<RandomRow>`
          WITH bounds AS (
            SELECT min(entry_id) AS minimum, max(entry_id) AS maximum
              FROM strong_lexicon_entries
             WHERE publication_id=${core.id} AND language=${input.lexicalLanguage}
               AND payload->>'gloss' <> ''
          )
          SELECT e.payload, i.step_code, tr.payload AS translation
            FROM bounds
            JOIN LATERAL (
              SELECT * FROM strong_lexicon_entries
               WHERE publication_id=${core.id} AND language=${input.lexicalLanguage}
                 AND payload->>'gloss' <> ''
                 AND entry_id >= floor(random() * (bounds.maximum - bounds.minimum + 1) + bounds.minimum)
               ORDER BY entry_id
               LIMIT 1
            ) e ON true
            JOIN strong_lexicon_entry_identities i
              ON i.publication_id=e.publication_id AND i.step_entry_id=e.entry_id
            LEFT JOIN strong_lexicon_translations tr
              ON tr.publication_id=e.publication_id AND tr.step_entry_id=e.entry_id
             AND tr.language=${input.language}
        `.execute(database)
        const randomRow = randomResult.rows[0]
        if (!randomRow) return { revision: core.revision, value: [] }
        return {
          revision: core.revision,
          value: [
            searchResult(
              randomRow.payload,
              { stepCode: randomRow.step_code },
              randomRow.translation ?? undefined,
              input.language
            ),
          ],
        }
      }).pipe(Effect.mapError(mapRepositoryCause)),

    findMorphologies: input =>
      tryDatabasePromise('strong-lexicon.morphologies', async () => {
        const core = await requiredCore()
        const normalizedCodes = [
          ...new Set(input.codes.map(code => code.trim().toLocaleLowerCase()).filter(Boolean)),
        ]
        const all = normalizedCodes.length
          ? await records(core.id, 'MorphologyCodes', query =>
              query.where(
                sql<boolean>`(lower(payload->>'code') IN (${sql.join(normalizedCodes.map(code => sql`${code}`))}) OR lower(payload->>'normalizedCode') IN (${sql.join(normalizedCodes.map(code => sql`${code}`))}))`
              )
            )
          : []
        const translations = all.length
          ? await records(core.id, 'MorphologyCodeTranslations', query =>
              query
                .where(
                  'entry_id',
                  'in',
                  all.map(row => number(row, 'id'))
                )
                .where('language', '=', input.language)
            )
          : []
        const value = input.codes.map(code => {
          const normalizedCode = code.trim().toLocaleLowerCase()
          const row = all.find(candidate =>
            [text(candidate, 'code'), text(candidate, 'normalizedCode')].some(
              candidateCode => candidateCode.trim().toLocaleLowerCase() === normalizedCode
            )
          )
          if (!row) return { code, meaning: code }
          const translated = translations.find(
            candidate => number(candidate, 'morphologyCodeId') === number(row, 'id')
          )
          return {
            code,
            meaning: localized(
              input.language,
              text(translated ?? {}, 'meaning'),
              text(row, 'meaning')
            ),
            ...(localized(
              input.language,
              text(translated ?? {}, 'description'),
              text(row, 'description')
            ).trim() !==
              localized(
                input.language,
                text(translated ?? {}, 'meaning'),
                text(row, 'meaning')
              ).trim() &&
            localized(
              input.language,
              text(translated ?? {}, 'description'),
              text(row, 'description')
            )
              ? {
                  description: localized(
                    input.language,
                    text(translated ?? {}, 'description'),
                    text(row, 'description')
                  ),
                }
              : {}),
          }
        })
        return { revision: core.revision, value }
      }).pipe(Effect.mapError(mapRepositoryCause)),

    findEntity: input =>
      tryDatabasePromise('strong-lexicon.entity', async () => {
        const core = await requiredCore()
        const entityPublication = await activePublication('entities')
        const state = moduleStateFrom('entities', entityPublication, core.revision)
        if (!entityPublication || state.status !== 'available') {
          throw new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'entities' })
        }
        const entity = (
          await records(entityPublication.id, 'Entities', query =>
            query.where('unique_name', '=', input.uniqueName)
          )
        )[0]
        if (!entity) throw new StrongLexiconEntityNotFound({ uniqueName: input.uniqueName })
        return {
          revision: entityRepresentationRevision(core, state),
          value: await hydrateEntity(core, entityPublication, entity, input.language),
        }
      }).pipe(Effect.mapError(mapRepositoryCause)),

    findChapterEntities: input =>
      tryDatabasePromise('strong-lexicon.chapter-entities', async () => {
        const core = await requiredCore()
        const entityPublication = await activePublication('entities')
        const state = moduleStateFrom('entities', entityPublication, core.revision)
        if (!entityPublication || state.status !== 'available') {
          throw new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'entities' })
        }
        const refs = await records(entityPublication.id, 'EntityRefs', query =>
          query.where(
            sql<boolean>`payload->>'book' = ${input.bookCode} AND (payload->>'chapter')::integer = ${input.chapter}`
          )
        )
        const normalizedStrongCodes = [
          ...new Set(input.strongCodes.map(code => normalizeCode(code)).filter(Boolean)),
        ]
        const referencedIds = [...new Set(refs.map(row => number(row, 'entityId')))]
        type UniqueEntityRow = { payload: Payload }
        const codeEntities = normalizedStrongCodes.length
          ? (
              await sql<UniqueEntityRow>`
                SELECT payload
                  FROM (
                    SELECT payload, count(*) OVER (PARTITION BY upper(u_strong)) AS matches
                      FROM strong_lexicon_entities
                     WHERE publication_id=${entityPublication.id}
                       AND upper(u_strong) IN (${sql.join(normalizedStrongCodes.map(code => sql`${code}`))})
                  ) matching
                 WHERE matches=1
              `.execute(database)
            ).rows.map(row => row.payload)
          : []
        const ids = [...new Set([...referencedIds, ...codeEntities.map(row => number(row, 'id'))])]
        const entities = ids.length
          ? await records(entityPublication.id, 'Entities', query =>
              query.where('entry_id', 'in', ids)
            )
          : []
        const translations = entities.length
          ? await records(entityPublication.id, 'EntityTranslations', query =>
              query
                .where(
                  'entry_id',
                  'in',
                  entities.map(row => number(row, 'id'))
                )
                .where('language', '=', input.language)
            )
          : []
        const value: StrongLexiconChapterEntity[] = entities
          .map((entity): StrongLexiconChapterEntity => {
            const id = number(entity, 'id')
            const translation = translations.find(row => number(row, 'entityId') === id)
            const category = text(entity, 'category')
            const type = text(entity, 'type')
            const chapterCategory = (
              type.toLowerCase() === 'supernatural'
                ? 'supernatural'
                : category === 'person' || category === 'place' || category === 'group'
                  ? category
                  : 'other'
            ) as StrongLexiconChapterEntity['category']
            return {
              uniqueName: text(entity, 'uniqueName'),
              name: localized(
                input.language,
                text(translation ?? {}, 'displayName'),
                text(entity, 'displayName')
              ).replace(/_+/gu, ' '),
              category: chapterCategory,
              type,
              verses: [
                ...new Set(
                  refs
                    .filter(row => number(row, 'entityId') === id)
                    .map(row => number(row, 'verse'))
                    .filter(verse => verse > 0)
                ),
              ].sort((left, right) => left - right),
            }
          })
          .sort((left, right) => {
            const categoryOrder: Record<StrongLexiconChapterEntity['category'], number> = {
              person: 0,
              place: 1,
              group: 2,
              other: 3,
              supernatural: 3,
            }
            const categoryDifference = categoryOrder[left.category] - categoryOrder[right.category]
            return (
              categoryDifference ||
              left.name.localeCompare(right.name) ||
              left.uniqueName.localeCompare(right.uniqueName)
            )
          })
        return { revision: entityRepresentationRevision(core, state), value }
      }).pipe(Effect.mapError(mapRepositoryCause)),
  }
}

export const makeNeonStrongLexiconRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)
  return {
    repository: makeKyselyStrongLexiconRepository(database),
    dispose: () => database.destroy(),
  }
}
