import {
  getSimpleStrongModuleId,
  isStandaloneStrongModule,
} from '@bible-strong/resource-domain/strong-lexicon'
import { Effect } from 'effect'
import { sql, type Kysely, type RawBuilder } from 'kysely'
import { normalizeBibleSearchText } from '@bible-strong/resource-domain/bible-search-input'

import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import type { ResourceDatabase } from '../database/types'
import {
  ActiveStrongLexiconPublicationUnavailable,
  STRONG_LEXICON_ENTRY_RESPONSE_REVISION,
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
  StrongLexiconNumberSense,
  StrongLexiconSearchResult,
} from '@bible-strong/resource-domain/strong-lexicon'
import {
  decodeStrongLexiconPageCursor,
  encodeStrongLexiconPageCursor,
} from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import {
  createStrongIdentity,
  getDisplayedStrongIdentities,
  type StrongIdentityKind,
} from '@bible-strong/resource-domain/strong-identities'

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
const normalizeCode = (value: string) =>
  createStrongIdentity(value, value.trim().toUpperCase().startsWith('H') ? 'hebrew' : 'greek').code
const normalizeText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase()

const classicStrong = (row: Payload) =>
  `${text(row, 'language') === 'greek' ? 'G' : 'H'}${String(number(row, 'baseCode')).padStart(4, '0')}`

const parseClassicStrong = (
  value: string
): { code: string; language: 'greek' | 'hebrew'; baseCode: number } | undefined => {
  const code = normalizeCode(value)
  const match = /^([GH])(\d+)$/u.exec(code)
  if (!match) return undefined
  return {
    code,
    language: match[1] === 'G' ? 'greek' : 'hebrew',
    baseCode: Number(match[2]),
  }
}

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
  if (!isStandaloneStrongModule(moduleId) && dependencyRevision !== coreRevision) {
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
    STRONG_LEXICON_ENTRY_RESPONSE_REVISION,
    `core:${core.revision}`,
    `resources:${moduleStateRevision(resources)}`,
    `entities:${moduleStateRevision(entities)}`,
  ].join('|')

const entityRepresentationRevision = (
  core: Publication,
  entities: StrongLexiconModuleState
): string => `core:${core.revision}|entities:${moduleStateRevision(entities)}`

type EntryInput = Parameters<StrongLexiconRepositoryService['findEntry']>[0]

/**
 * How the rows of a detailed entry are fetched. `one-statement` gathers them in a single
 * round trip. `statement-by-statement` is the earlier read, one statement per kind of row,
 * kept as the reference the single statement is tested against.
 */
export type StrongLexiconDetailedEntryRead = 'one-statement' | 'statement-by-statement'

/**
 * How the rows of entry cards, and of the simple entry made of one, are fetched. The two
 * values mean what they mean for a detailed entry.
 */
export type StrongLexiconEntryCardsRead = 'one-statement' | 'statement-by-statement'

/**
 * How the senses of a classical number are fetched. `one-statement` gathers their cards and
 * what tells each apart in a single round trip. `read-by-read` reads the cards, then the
 * detailed entry of each sense, as a page of the public site did: it is the reference the
 * single statement is tested against.
 */
export type StrongLexiconNumberSensesRead = 'one-statement' | 'read-by-read'

export type StrongLexiconRepositoryOptions = {
  detailedEntryRead?: StrongLexiconDetailedEntryRead
  entryCardsRead?: StrongLexiconEntryCardsRead
  numberSensesRead?: StrongLexiconNumberSensesRead
}

// Row choices of a detailed entry. Both reads apply the same ones and compose the entry
// with the same functions, so they can differ only in how rows are fetched.
const findLexicalBriefMorphology = (rows: Payload[], entry: Payload): Payload | undefined =>
  rows.find(
    row =>
      text(row, 'scope') === 'lexical_brief' &&
      [text(row, 'code'), text(row, 'normalizedCode')].includes(text(entry, 'morph'))
  )

type ClassicStrongTarget = NonNullable<ReturnType<typeof parseClassicStrong>>

const unresolvedClassicTargetsOf = (relationRows: Payload[]): ClassicStrongTarget[] =>
  Array.from(
    new Map(
      relationRows
        .filter(row => !number(row, 'toStepEntryId'))
        .flatMap(row => {
          const target = parseClassicStrong(text(row, 'toStepCode'))
          return target ? [[target.code, target] as const] : []
        })
    ).values()
  )

const isClassicTargetOf = (targets: ClassicStrongTarget[]) => (row: Payload) =>
  targets.some(target => target.code === classicStrong(row))

const entityStrongPrefix = (entry: Payload) => (text(entry, 'language') === 'greek' ? 'G' : 'H')

const isEntityNamedLikeEntry = (entry: Payload) => {
  const prefix = entityStrongPrefix(entry)
  const baseCode = number(entry, 'baseCode')
  const gloss = normalizeText(text(entry, 'gloss'))
  return (row: Payload) => {
    const match = text(row, 'uStrong').match(/^([HG])0*(\d+)/u)
    return Boolean(
      match &&
      match[1] === prefix &&
      Number(match[2]) === baseCode &&
      normalizeText(text(row, 'displayName')) === gloss
    )
  }
}

const preferredEntityOf = (entry: Payload, candidates: Payload[]): Payload | undefined =>
  candidates.sort(
    (left, right) =>
      (text(left, 'uStrong') === text(entry, 'uStrong') ? 0 : 1) -
        (text(right, 'uStrong') === text(entry, 'uStrong') ? 0 : 1) ||
      number(left, 'id') - number(right, 'id')
  )[0]

// The entity of an entry: one filed under a code of the entry, or else one filed under its
// classical number and named like it.
const entityOfEntry = (
  entry: Payload,
  entitiesByCode: Payload[],
  entitiesByNumber: Payload[]
): Payload | undefined =>
  preferredEntityOf(
    entry,
    entitiesByCode.length ? entitiesByCode : entitiesByNumber.filter(isEntityNamedLikeEntry(entry))
  )

const entityBriefOf = (
  entity: Payload,
  translation: Payload | undefined,
  language: StrongLexiconLanguage
): string => localized(language, text(translation ?? {}, 'brief'), text(entity, 'brief'))

// The definition of an entry in a language; empty when it has none.
const definitionOf = (
  entry: Payload,
  translation: Payload | undefined,
  language: StrongLexiconLanguage
): string =>
  localized(
    language,
    text(translation ?? {}, 'meaningHtml') || text(translation ?? {}, 'meaning'),
    text(entry, 'meaning')
  )

const composeEntity = (
  rows: {
    entity: Payload
    translation: Payload | undefined
    place: Payload | undefined
    relationRows: Payload[]
    targetRows: Payload[]
    targetTranslations: Payload[]
    coreEntries: Payload[]
    coreIdentities: Payload[]
  },
  language: StrongLexiconLanguage
): StrongLexiconEntity => {
  const {
    entity,
    translation,
    place,
    relationRows,
    targetRows,
    targetTranslations,
    coreEntries,
    coreIdentities,
  } = rows
  const entityId = number(entity, 'id')
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
    brief: entityBriefOf(entity, translation, language),
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

const composeEntry = (
  input: EntryInput,
  rows: {
    core: Publication
    entry: Payload
    identity: Payload
    translation: Payload | undefined
    /** In the order of their `sortOrder`. */
    relationRows: Payload[]
    relationKinds: Payload[]
    morphologyRow: Payload | undefined
    morphologyTranslation: Payload | undefined
    directTargetEntries: Payload[]
    fallbackTargetEntries: Payload[]
    fallbackTargetIdentities: Payload[]
    relationTranslations: Payload[]
    /** In the order of their identifier. */
    resourceRows: Payload[]
    resourceTranslations: Payload[]
    entity: StrongLexiconEntity | undefined
    resourcesState: StrongLexiconModuleState
    entitiesState: StrongLexiconModuleState
  }
): ActiveStrongLexiconValue<StrongLexiconEntry> => {
  const {
    core,
    entry,
    identity,
    translation,
    relationRows,
    relationKinds,
    morphologyRow,
    morphologyTranslation,
    directTargetEntries,
    fallbackTargetEntries,
    fallbackTargetIdentities,
    relationTranslations,
    resourceRows,
    resourceTranslations,
    entity,
    resourcesState,
    entitiesState,
  } = rows
  const language = input.language
  const entryId = number(entry, 'id')
  let morphology: StrongLexiconMorphology | undefined
  if (morphologyRow) {
    const meaning = localized(
      language,
      text(morphologyTranslation ?? {}, 'meaning'),
      text(morphologyRow, 'meaning')
    )
    const description = localized(
      language,
      text(morphologyTranslation ?? {}, 'description'),
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
      language,
      text(translatedResource ?? {}, 'contentHtml'),
      text(row, 'contentHtml')
    )
    if (/LSJ (?:has|ne possède) no entry|Le LSJ ne contient aucune entrée/iu.test(contentHtml)) {
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
            ? language === 'fr'
              ? 'Dictionnaire grec détaillé'
              : 'Detailed Greek dictionary'
            : language === 'fr'
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
    gloss: localized(language, text(translation ?? {}, 'gloss'), text(entry, 'gloss')),
    ...(localized(language, text(entry, 'nameMeaningFrHtml'), text(entry, 'nameMeaningEnHtml'))
      ? {
          nameMeaningHtml: localized(
            language,
            text(entry, 'nameMeaningFrHtml'),
            text(entry, 'nameMeaningEnHtml')
          ),
        }
      : {}),
    ...(definitionOf(entry, translation, language)
      ? { definitionHtml: definitionOf(entry, translation, language) }
      : {}),
    ...(morphology ? { morphology } : {}),
    relations: relationRowsForDisplay.flatMap(relation => {
      const directTarget = directTargetEntries.find(
        row => number(row, 'id') === number(relation, 'toStepEntryId')
      )
      const classicTarget = parseClassicStrong(text(relation, 'toStepCode'))
      const targets = directTarget
        ? [directTarget]
        : classicTarget
          ? fallbackTargetEntries
              .filter(target => classicStrong(target) === classicTarget.code)
              .sort((left, right) => {
                const leftCode = text(
                  fallbackTargetIdentities.find(
                    identity => number(identity, 'stepEntryId') === number(left, 'id')
                  ) ?? {},
                  'stepCode'
                )
                const rightCode = text(
                  fallbackTargetIdentities.find(
                    identity => number(identity, 'stepEntryId') === number(right, 'id')
                  ) ?? {},
                  'stepCode'
                )
                return leftCode.localeCompare(rightCode)
              })
          : []
      const kind = relationKinds.find(
        row => number(row, 'id') === number(relation, 'relationKindId')
      )
      return targets.map(target => {
        const targetTranslation = relationTranslations.find(
          translated => number(translated, 'stepEntryId') === number(target, 'id')
        )
        const fallbackIdentity = fallbackTargetIdentities.find(
          identity => number(identity, 'stepEntryId') === number(target, 'id')
        )
        return {
          group: text(relation, 'groupKind') as 'subentry' | 'identity' | 'family',
          relationKind: text(kind ?? {}, 'kind'),
          label:
            language === 'fr'
              ? text(kind ?? {}, 'labelFr') || text(kind ?? {}, 'labelEn')
              : text(kind ?? {}, 'labelEn'),
          stepCode: directTarget
            ? text(relation, 'toStepCode')
            : text(fallbackIdentity ?? {}, 'stepCode'),
          gloss: localized(language, text(targetTranslation ?? {}, 'gloss'), text(target, 'gloss')),
          original: text(target, 'original'),
          transliteration:
            text(target, 'classicTransliteration') || text(target, 'transliteration'),
        }
      })
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
}

type EntryCardsInput = Parameters<NonNullable<StrongLexiconRepositoryService['findEntryCards']>>[0]
type EntryIdentityRow = { stepEntryId: number; stepCode: string }

/** The rows entry cards are made of, however they were fetched. */
type EntryCardRows = {
  core: Pick<Publication, 'revision'>
  /** The identities the references name, in the order of their entry. */
  requestedIdentityRows: EntryIdentityRow[]
  /** The entries of those identities, then the ones that carry a reference no identity names. */
  entries: Payload[]
  identities: EntryIdentityRow[]
  translations: Payload[]
  /** In the order of their identifier. */
  morphologyRows: Payload[]
  morphologyTranslations: Payload[]
}

type CarryingEntry = {
  eStrong: string
  dStrong: string
  uStrong: string
  language: string | null
  baseCode: number | null
  payload: Payload
}
/** The row the single statement of entry cards returns. */
type EntryCardRowsGathered = {
  core: { revision: string } | null
  exact_identities: EntryIdentityRow[]
  case_insensitive_identities: { step_entry_id: number; step_code: string }[]
  identity_entries: { entryId: number; payload: Payload }[]
  carrying_entries: CarryingEntry[]
  identities: EntryIdentityRow[]
  translations: Payload[]
  morphology_codes: Payload[]
  morphology_translations: Payload[]
}

// Row choices of entry cards. Both reads apply the same ones and compose the cards with
// the same function, so they can differ only in how rows are fetched.
const disambiguatedCodesWithoutIdentity = (
  identities: EntryCardsInput['identities'],
  requestedIdentityRows: EntryIdentityRow[]
): string[] =>
  identities
    .filter(
      identity =>
        identity.kind === 'dstrong' &&
        !requestedIdentityRows.some(row => row.stepCode === normalizeCode(identity.reference))
    )
    .map(identity => normalizeCode(identity.reference))

// A disambiguated code written in another case selects its entry when it names only one.
const identitiesNamedInAnotherCase = (
  codes: string[],
  candidates: { step_entry_id: number; step_code: string }[]
): EntryIdentityRow[] =>
  [...new Set(codes)].flatMap(code => {
    const matches = candidates.filter(row => row.step_code.toLowerCase() === code.toLowerCase())
    // Retain the requested spelling for selection; the canonical spelling is read with the entry.
    return matches.length === 1 ? [{ stepEntryId: matches[0]!.step_entry_id, stepCode: code }] : []
  })

const identitiesWithoutIdentityRow = (
  identities: EntryCardsInput['identities'],
  requestedIdentityRows: EntryIdentityRow[]
): EntryCardsInput['identities'] => {
  const named = new Set(requestedIdentityRows.map(row => row.stepCode))
  return identities.filter(identity => !named.has(normalizeCode(identity.reference)))
}

// The classical number a reference stands for, as the entries that carry it are looked up.
const classicalNumberOf = (
  reference: string
): { language: 'greek' | 'hebrew'; baseCode: number } => {
  const base = Number(reference.replace(/^[HG]/u, '').replace(/^0+/u, ''))
  return {
    language: reference.startsWith('G') ? 'greek' : 'hebrew',
    baseCode: Number.isFinite(base) ? base : -1,
  }
}

const uniqueEntries = (entries: Payload[]): Payload[] => [
  ...new Map(entries.map(entry => [number(entry, 'id'), entry])).values(),
]

const composeEntryCards = (
  { identities: requestedIdentities, language }: EntryCardsInput,
  rows: EntryCardRows
): ActiveStrongLexiconValue<StrongLexiconEntryCard>[] => {
  const {
    core,
    requestedIdentityRows,
    entries,
    identities,
    translations,
    morphologyRows,
    morphologyTranslations,
  } = rows
  return requestedIdentities.flatMap(requested => {
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
        (match): match is { candidate: Payload; index: number; rank: number } => match !== undefined
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
      ? localized(language, text(morphologyTranslation, 'meaning'), text(morphologyRow, 'meaning'))
      : ''
    const definition = definitionOf(entry, translation, language)
    const nameMeaning = localized(
      language,
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
          transliteration: text(entry, 'classicTransliteration') || text(entry, 'transliteration'),
          ...(text(entry, 'pronunciation') ? { pronunciation: text(entry, 'pronunciation') } : {}),
          gloss: localized(language, text(translation, 'gloss'), text(entry, 'gloss')),
          ...(nameMeaning ? { nameMeaningHtml: nameMeaning } : {}),
          ...(definition ? { definitionHtml: definition } : {}),
          ...(morphologyRow ? { morphology: { code: text(entry, 'morph'), meaning } } : {}),
        },
      },
    ]
  })
}

type NumberSensesInput = Parameters<StrongLexiconRepositoryService['findNumberSenses']>[0]
type NumberSenses = Effect.Effect.Success<
  ReturnType<StrongLexiconRepositoryService['findNumberSenses']>
>
type NumberSenseDetail = Pick<StrongLexiconNumberSense, 'detailedDefinitionHtml' | 'entityBrief'>

// A sense adds one letter to its classical number; a number that ran out of capitals goes on
// with small letters, which name other senses.
const NUMBER_SENSE_SUFFIXES = ['', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz']

const NUMBER_SENSES_RESPONSE_REVISION = 'strong-lexicon-number-senses-v1'

// Row choices of the senses of a number. Both reads apply the same ones, so they can differ
// only in how rows are fetched.

/**
 * The senses of a number are looked for in the simple lexicon of the language, under every
 * code one of them can carry: the lexicon is filed by gloss, not by number.
 */
const numberSenseCardsInput = (
  classicCode: string,
  language: StrongLexiconLanguage
): EntryCardsInput => ({
  language,
  level: 'simple',
  identities: NUMBER_SENSE_SUFFIXES.map(suffix => ({
    kind: 'dstrong',
    reference: `${classicCode}${suffix}`,
  })),
})

/**
 * The cards that are senses of the number, each once, in the order their codes were asked
 * for. A code may be answered by an entry of another number, and several codes by one entry.
 */
const numberSenseCardsOf = (
  classicCode: string,
  cards: ActiveStrongLexiconValue<StrongLexiconEntryCard>[]
): StrongLexiconEntryCard[] => {
  const seen = new Set<string>()
  return cards
    .map(card => card.value)
    .filter(card => {
      const key = `${card.id}\n${card.stepCode}`
      if (card.classicStrong !== classicCode || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const composeNumberSenses = (
  classicCode: string,
  revisions: { simple: string; core: string; entities: StrongLexiconModuleState },
  senses: { card: StrongLexiconEntryCard; detail: NumberSenseDetail }[]
): NumberSenses => ({
  revision: [
    NUMBER_SENSES_RESPONSE_REVISION,
    `simple:${revisions.simple}`,
    `core:${revisions.core}`,
    `entities:${moduleStateRevision(revisions.entities)}`,
  ].join('|'),
  value: {
    classicStrong: classicCode,
    senses: senses.map(({ card, detail }) => ({
      id: card.id,
      stepCode: card.stepCode,
      classicStrong: card.classicStrong,
      language: card.language,
      original: card.original,
      transliteration: card.transliteration,
      gloss: card.gloss,
      ...(detail.detailedDefinitionHtml === undefined
        ? {}
        : { detailedDefinitionHtml: detail.detailedDefinitionHtml }),
      ...(detail.entityBrief === undefined ? {} : { entityBrief: detail.entityBrief }),
    })),
  },
})

// What the detailed entry of a sense tells it apart by.
const numberSenseDetailOf = (entry: StrongLexiconEntry | undefined): NumberSenseDetail => ({
  ...(entry?.definitionHtml === undefined ? {} : { detailedDefinitionHtml: entry.definitionHtml }),
  ...(entry?.entity === undefined ? {} : { entityBrief: entry.entity.brief }),
})

export const makeKyselyStrongLexiconRepository = (
  database: Kysely<ResourceDatabase>,
  options: StrongLexiconRepositoryOptions = {}
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
      isStandaloneStrongModule(moduleId) ? Promise.resolve(undefined) : activePublication('core'),
    ])
    return moduleStateFrom(moduleId, publication, core?.revision)
  }

  const requiredCore = async (
    language: StrongLexiconLanguage,
    level?: 'simple' | 'detailed'
  ): Promise<Publication> => {
    const moduleId = level === 'simple' ? getSimpleStrongModuleId(language) : 'core'
    const core = await activePublication(moduleId)
    if (!core) throw new ActiveStrongLexiconPublicationUnavailable({ moduleId })
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
    let identity =
      kind === 'ustrong'
        ? undefined
        : (
            await records(core.id, 'StepEntryIdentities', query =>
              query.where('code', '=', normalized)
            )
          )[0]
    if (!identity && kind === 'dstrong') {
      const legacyMatches = await records(core.id, 'StepEntryIdentities', query =>
        query.where(sql<boolean>`lower(code) = ${normalized.toLowerCase()}`).limit(2)
      )
      if (legacyMatches.length === 1) identity = legacyMatches[0]
    }
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
              query.where(sql<boolean>`(payload->>'dStrong') LIKE ${`${normalized}%`}`)
            )
          )[0]
        : kind === 'estrong'
          ? (
              await records(core.id, 'StepEntries', query =>
                query.where(sql<boolean>`(payload->>'eStrong') = ${normalized}`)
              )
            )[0]
          : kind === 'ustrong'
            ? (
                await records(core.id, 'StepEntries', query =>
                  query.where(sql<boolean>`(payload->>'uStrong') = ${normalized}`)
                )
              )[0]
            : (
                await records(core.id, 'StepEntries', query =>
                  query.where(
                    sql<boolean>`((payload->>'eStrong') = ${normalized} OR (payload->>'dStrong') = ${normalized} OR (payload->>'uStrong') = ${normalized} OR ((payload->>'baseCode')::integer = ${Number.isFinite(base) ? base : -1} AND payload->>'language' = ${normalized.startsWith('G') ? 'greek' : 'hebrew'}))`
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

  // The earlier read of entry cards: one statement per kind of row, each waiting for the
  // previous one. It is the reference the single statement is tested against.
  const readEntryCardRowsStatementByStatement = async (
    input: EntryCardsInput
  ): Promise<EntryCardRows> => {
    const core = await requiredCore(input.language, input.level)
    const references = [
      ...new Set(input.identities.map(identity => normalizeCode(identity.reference))),
    ]
    const requestedIdentityRows = (
      await database
        .selectFrom('strong_lexicon_entry_identities')
        .select(['step_entry_id', 'step_code'])
        .where('publication_id', '=', core.id)
        .where('step_code', 'in', references)
        .orderBy('step_entry_id')
        .execute()
    ).map(row => ({ stepEntryId: row.step_entry_id, stepCode: row.step_code }))
    const missingLegacyCodes = disambiguatedCodesWithoutIdentity(
      input.identities,
      requestedIdentityRows
    )
    if (missingLegacyCodes.length) {
      const legacyRows = await database
        .selectFrom('strong_lexicon_entry_identities')
        .select(['step_entry_id', 'step_code'])
        .where('publication_id', '=', core.id)
        .where(
          sql<boolean>`lower(step_code) IN (${sql.join(missingLegacyCodes.map(code => sql`${code.toLowerCase()}`))})`
        )
        .execute()
      requestedIdentityRows.push(...identitiesNamedInAnotherCase(missingLegacyCodes, legacyRows))
    }
    const requestedEntryIds = requestedIdentityRows.map(row => number(row, 'stepEntryId'))
    const indexedEntries = requestedEntryIds.length
      ? await database
          .selectFrom('strong_lexicon_entries')
          .select('payload')
          .where('publication_id', '=', core.id)
          .where('entry_id', 'in', requestedEntryIds)
          .orderBy('entry_id')
          .execute()
      : []
    const unresolvedIdentities = identitiesWithoutIdentityRow(
      input.identities,
      requestedIdentityRows
    )
    const fallbackReferences = [
      ...new Set(unresolvedIdentities.map(identity => normalizeCode(identity.reference))),
    ]
    const fallbackEntries = fallbackReferences.length
      ? await database
          .selectFrom('strong_lexicon_entries')
          .select('payload')
          .where('publication_id', '=', core.id)
          .where(
            sql<boolean>`(
              e_strong IN (${sql.join(fallbackReferences.map(reference => sql`${reference}`))})
              OR d_strong IN (${sql.join(fallbackReferences.map(reference => sql`${reference}`))})
              OR u_strong IN (${sql.join(fallbackReferences.map(reference => sql`${reference}`))})
              OR ${sql.join(
                unresolvedIdentities.map(identity => {
                  const classical = classicalNumberOf(normalizeCode(identity.reference))
                  return sql<boolean>`(
                    (payload->>'baseCode')::integer = ${classical.baseCode}
                    AND payload->>'language' = ${classical.language}
                  )`
                }),
                sql` OR `
              )}
            )`
          )
          .orderBy('entry_id')
          .execute()
      : []
    const entries = uniqueEntries([...indexedEntries, ...fallbackEntries].map(row => row.payload))
    if (!entries.length) {
      return {
        core,
        requestedIdentityRows,
        entries,
        identities: [],
        translations: [],
        morphologyRows: [],
        morphologyTranslations: [],
      }
    }
    const entryIds = entries.map(entry => number(entry, 'id'))
    const morphologyCodes = [...new Set(entries.map(entry => text(entry, 'morph')).filter(Boolean))]
    const [identities, translations, morphologyRows] = await Promise.all([
      database
        .selectFrom('strong_lexicon_entry_identities')
        .select(['step_entry_id', 'step_code'])
        .where('publication_id', '=', core.id)
        .where('step_entry_id', 'in', entryIds)
        .orderBy('step_entry_id')
        .execute()
        .then(rows =>
          rows.map(row => ({ stepEntryId: row.step_entry_id, stepCode: row.step_code }))
        ),
      database
        .selectFrom('strong_lexicon_translations')
        .select('payload')
        .where('publication_id', '=', core.id)
        .where('step_entry_id', 'in', entryIds)
        .where('language', '=', input.language)
        .orderBy('step_entry_id')
        .execute()
        .then(rows => rows.map(row => row.payload)),
      morphologyCodes.length
        ? database
            .selectFrom('strong_lexicon_morphology_codes')
            .select('payload')
            .where('publication_id', '=', core.id)
            .where('scope', '=', 'lexical_brief')
            .where(expression =>
              expression.or([
                expression('code', 'in', morphologyCodes),
                expression('normalized_code', 'in', morphologyCodes),
              ])
            )
            .orderBy('morphology_code_id')
            .execute()
            .then(rows => rows.map(row => row.payload))
        : Promise.resolve([]),
    ])
    const morphologyIds = morphologyRows.map(row => number(row, 'id'))
    const morphologyTranslations = morphologyIds.length
      ? await database
          .selectFrom('strong_lexicon_morphology_code_translations')
          .select('payload')
          .where('publication_id', '=', core.id)
          .where('morphology_code_id', 'in', morphologyIds)
          .where('language', '=', input.language)
          .orderBy('morphology_code_id')
          .execute()
          .then(rows => rows.map(row => row.payload))
      : []
    return {
      core,
      requestedIdentityRows,
      entries,
      identities,
      translations,
      morphologyRows,
      morphologyTranslations,
    }
  }

  // Every row entry cards are made of, gathered in one round trip, as for a detailed entry.
  //
  // The statement only fetches. Two choices depend on rows it reads itself: which reference
  // written in another case names a single identity, and so which references are left for
  // the entries that carry them. It returns the candidates of both, and TypeScript chooses
  // with the rules the statement-by-statement read applies: a candidate entry comes with the
  // values it was matched on, so that the choice is made on what PostgreSQL compared.
  //
  // It is written as its common table expressions and the columns of its final SELECT, so
  // that the senses of a number are read with the same ones, followed by their own.
  const entryCardRowsStatement = (input: EntryCardsInput) => {
    const moduleId = input.level === 'simple' ? getSimpleStrongModuleId(input.language) : 'core'
    const references = [
      ...new Set(input.identities.map(identity => normalizeCode(identity.reference))),
    ]
    const classicalNumbers = references.map(classicalNumberOf)
    const disambiguated = [
      ...new Set(
        input.identities
          .filter(identity => identity.kind === 'dstrong')
          .map(identity => normalizeCode(identity.reference))
      ),
    ]
    return {
      moduleId,
      expressions: sql`
      core AS MATERIALIZED (
        SELECT id, revision
          FROM resource_publications
         WHERE resource_identity = ${`strong-lexicon:${moduleId}`}
           AND status = 'active'
      ),
      requested AS MATERIALIZED (
        SELECT reference.code, reference.language, reference.base_code
          FROM unnest(
                 ${references}::text[],
                 ${classicalNumbers.map(classical => classical.language)}::text[],
                 ${classicalNumbers.map(classical => classical.baseCode)}::integer[]
               ) AS reference(code, language, base_code)
      ),
      exact_identities AS MATERIALIZED (
        SELECT i.step_entry_id, i.step_code
          FROM strong_lexicon_entry_identities i
         WHERE i.publication_id = (SELECT id FROM core)
           AND i.step_code = ANY (${references}::text[])
      ),
      -- The references no identity names as they are written.
      unnamed AS MATERIALIZED (
        SELECT r.code, r.language, r.base_code
          FROM requested r
         WHERE NOT EXISTS (SELECT 1 FROM exact_identities x WHERE x.step_code = r.code)
      ),
      unnamed_disambiguated AS MATERIALIZED (
        SELECT d.lowered
          FROM unnest(
                 ${disambiguated}::text[],
                 ${disambiguated.map(code => code.toLowerCase())}::text[]
               ) AS d(code, lowered)
         WHERE d.code IN (SELECT code FROM unnamed)
      ),
      -- The identities such a disambiguated code names in another case. Read only when
      -- there is one: the scan is skipped otherwise.
      case_insensitive_identities AS MATERIALIZED (
        SELECT i.step_entry_id, i.step_code
          FROM strong_lexicon_entry_identities i
         WHERE i.publication_id = (SELECT id FROM core)
           AND EXISTS (SELECT 1 FROM unnamed_disambiguated)
           AND lower(i.step_code) = ANY (ARRAY(SELECT lowered FROM unnamed_disambiguated))
      ),
      identity_entries AS MATERIALIZED (
        SELECT e.entry_id, e.payload
          FROM strong_lexicon_entries e
         WHERE e.publication_id = (SELECT id FROM core)
           AND e.entry_id = ANY (
                 ARRAY(
                   SELECT step_entry_id FROM exact_identities
                   UNION ALL
                   SELECT step_entry_id FROM case_insensitive_identities
                 )
               )
      ),
      -- The entries that carry an unnamed reference as one of their codes or as their
      -- classical number. Each way of carrying it is looked up apart, on the index that
      -- serves it, rather than tested on every entry of the lexicon.
      carrying AS MATERIALIZED (
        SELECT e.entry_id
          FROM strong_lexicon_entries e
         WHERE e.publication_id = (SELECT id FROM core)
           AND e.e_strong = ANY (ARRAY(SELECT code FROM unnamed))
        UNION ALL
        SELECT e.entry_id
          FROM strong_lexicon_entries e
         WHERE e.publication_id = (SELECT id FROM core)
           AND e.d_strong = ANY (ARRAY(SELECT code FROM unnamed))
        UNION ALL
        SELECT e.entry_id
          FROM strong_lexicon_entries e
         WHERE e.publication_id = (SELECT id FROM core)
           AND e.u_strong = ANY (ARRAY(SELECT code FROM unnamed))
        UNION ALL
        -- The numbers alone select the index rows; the pair is then compared.
        SELECT e.entry_id
          FROM strong_lexicon_entries e
         WHERE e.publication_id = (SELECT id FROM core)
           AND (e.payload->>'baseCode')::integer
               = ANY (ARRAY(SELECT DISTINCT base_code FROM unnamed))
           AND (e.payload->>'language', (e.payload->>'baseCode')::integer)
               IN (SELECT language, base_code FROM unnamed)
      ),
      carrying_entries AS MATERIALIZED (
        SELECT e.entry_id,
               e.e_strong,
               e.d_strong,
               e.u_strong,
               e.payload->>'language' AS language,
               (e.payload->>'baseCode')::integer AS base_code,
               e.payload
          FROM strong_lexicon_entries e
         WHERE e.publication_id = (SELECT id FROM core)
           AND e.entry_id = ANY (ARRAY(SELECT entry_id FROM carrying))
      ),
      candidates AS MATERIALIZED (
        SELECT entry_id, coalesce(payload->>'morph', '') AS morph FROM identity_entries
        UNION
        SELECT entry_id, coalesce(payload->>'morph', '') AS morph FROM carrying_entries
      ),
      morphology_codes AS MATERIALIZED (
        SELECT m.morphology_code_id, m.payload
          FROM strong_lexicon_morphology_codes m
         WHERE m.publication_id = (SELECT id FROM core)
           AND m.scope = 'lexical_brief'
           AND (
                 m.code = ANY (ARRAY(SELECT morph FROM candidates WHERE morph <> ''))
                 OR m.normalized_code = ANY (ARRAY(SELECT morph FROM candidates WHERE morph <> ''))
               )
      )`,
      columns: sql`
        (SELECT jsonb_build_object('revision', revision) FROM core) AS core,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('stepEntryId', step_entry_id, 'stepCode', step_code)
                    ORDER BY step_entry_id
                  ),
                  '[]'::jsonb
                )
           FROM exact_identities) AS exact_identities,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('step_entry_id', step_entry_id, 'step_code', step_code)
                  ),
                  '[]'::jsonb
                )
           FROM case_insensitive_identities) AS case_insensitive_identities,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('entryId', entry_id, 'payload', payload) ORDER BY entry_id
                  ),
                  '[]'::jsonb
                )
           FROM identity_entries) AS identity_entries,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'eStrong', e_strong,
                      'dStrong', d_strong,
                      'uStrong', u_strong,
                      'language', language,
                      'baseCode', base_code,
                      'payload', payload
                    )
                    ORDER BY entry_id
                  ),
                  '[]'::jsonb
                )
           FROM carrying_entries) AS carrying_entries,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('stepEntryId', i.step_entry_id, 'stepCode', i.step_code)
                    ORDER BY i.step_entry_id
                  ),
                  '[]'::jsonb
                )
           FROM strong_lexicon_entry_identities i
          WHERE i.publication_id = (SELECT id FROM core)
            AND i.step_entry_id = ANY (ARRAY(SELECT entry_id FROM candidates))
        ) AS identities,
        (SELECT coalesce(jsonb_agg(t.payload ORDER BY t.step_entry_id), '[]'::jsonb)
           FROM strong_lexicon_translations t
          WHERE t.publication_id = (SELECT id FROM core)
            AND t.step_entry_id = ANY (ARRAY(SELECT entry_id FROM candidates))
            AND t.language = ${input.language}) AS translations,
        (SELECT coalesce(jsonb_agg(payload ORDER BY morphology_code_id), '[]'::jsonb)
           FROM morphology_codes) AS morphology_codes,
        (SELECT coalesce(jsonb_agg(t.payload ORDER BY t.morphology_code_id), '[]'::jsonb)
           FROM strong_lexicon_morphology_code_translations t
          WHERE t.publication_id = (SELECT id FROM core)
            AND t.morphology_code_id = ANY (
                  ARRAY(SELECT morphology_code_id FROM morphology_codes)
                )
            AND t.language = ${input.language}) AS morphology_translations`,
    }
  }

  const entryCardRowsOf = (input: EntryCardsInput, rows: EntryCardRowsGathered): EntryCardRows => {
    if (!rows.core) {
      throw new ActiveStrongLexiconPublicationUnavailable({
        moduleId: input.level === 'simple' ? getSimpleStrongModuleId(input.language) : 'core',
      })
    }

    const requestedIdentityRows = [...rows.exact_identities]
    requestedIdentityRows.push(
      ...identitiesNamedInAnotherCase(
        disambiguatedCodesWithoutIdentity(input.identities, requestedIdentityRows),
        rows.case_insensitive_identities
      )
    )
    const requestedEntryIds = new Set(requestedIdentityRows.map(row => row.stepEntryId))
    const indexedEntries = rows.identity_entries
      .filter(entry => requestedEntryIds.has(entry.entryId))
      .map(entry => entry.payload)

    const unresolvedIdentities = identitiesWithoutIdentityRow(
      input.identities,
      requestedIdentityRows
    )
    const fallbackReferences = new Set(
      unresolvedIdentities.map(identity => normalizeCode(identity.reference))
    )
    const unresolvedNumbers = [...fallbackReferences].map(classicalNumberOf)
    const fallbackEntries = rows.carrying_entries
      .filter(
        entry =>
          fallbackReferences.has(entry.eStrong) ||
          fallbackReferences.has(entry.dStrong) ||
          fallbackReferences.has(entry.uStrong) ||
          unresolvedNumbers.some(
            classical =>
              entry.baseCode === classical.baseCode && entry.language === classical.language
          )
      )
      .map(entry => entry.payload)

    return {
      core: rows.core,
      requestedIdentityRows,
      entries: uniqueEntries([...indexedEntries, ...fallbackEntries]),
      identities: rows.identities,
      translations: rows.translations,
      morphologyRows: rows.morphology_codes,
      morphologyTranslations: rows.morphology_translations,
    }
  }

  const readEntryCardRowsInOneStatement = async (
    input: EntryCardsInput
  ): Promise<EntryCardRows> => {
    const statement = entryCardRowsStatement(input)
    const gathered = await sql<EntryCardRowsGathered>`
      WITH ${statement.expressions}
      SELECT ${statement.columns}
    `.execute(database)
    const rows = gathered.rows[0]
    if (!rows) throw new ActiveStrongLexiconPublicationUnavailable({ moduleId: statement.moduleId })
    return entryCardRowsOf(input, rows)
  }
  const readEntryCardRows =
    options.entryCardsRead === 'statement-by-statement'
      ? readEntryCardRowsStatementByStatement
      : readEntryCardRowsInOneStatement

  const findEntryCardsBatch = async (
    input: EntryCardsInput
  ): Promise<ActiveStrongLexiconValue<StrongLexiconEntryCard>[]> => {
    if (!input.identities.length) return []
    return composeEntryCards(input, await readEntryCardRows(input))
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
    return composeEntity(
      {
        entity,
        translation,
        place,
        relationRows,
        targetRows,
        targetTranslations,
        coreEntries,
        coreIdentities,
      },
      language
    )
  }

  const readDetailedEntryStatementByStatement = async (
    input: EntryInput
  ): Promise<ActiveStrongLexiconValue<StrongLexiconEntry>> => {
    const core = await requiredCore(input.language, input.level)
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
        rows => rows.sort((left, right) => number(left, 'sortOrder') - number(right, 'sortOrder'))
      ),
      records(core.id, 'RelationKinds'),
      records(core.id, 'MorphologyCodes'),
      getState('resources'),
      getState('entities'),
    ])
    const targetIds = relationRows.map(row => number(row, 'toStepEntryId')).filter(Boolean)
    const directTargetEntries = targetIds.length
      ? await records(core.id, 'StepEntries', query => query.where('entry_id', 'in', targetIds))
      : []
    const unresolvedClassicTargets = unresolvedClassicTargetsOf(relationRows)
    const fallbackTargetEntries = unresolvedClassicTargets.length
      ? (
          await records(core.id, 'StepEntries', query =>
            query.where(
              sql<boolean>`(${sql.join(
                unresolvedClassicTargets.map(
                  target =>
                    sql<boolean>`payload->>'language' = ${target.language} AND (payload->>'baseCode')::integer = ${target.baseCode}`
                ),
                sql` OR `
              )})`
            )
          )
        ).filter(isClassicTargetOf(unresolvedClassicTargets))
      : []
    const fallbackTargetIdentities = fallbackTargetEntries.length
      ? await records(core.id, 'StepEntryIdentities', query =>
          query.where(
            'entry_id',
            'in',
            fallbackTargetEntries.map(row => number(row, 'id'))
          )
        )
      : []
    const targetEntries = [...directTargetEntries, ...fallbackTargetEntries].filter(
      (row, index, rows) =>
        rows.findIndex(candidate => number(candidate, 'id') === number(row, 'id')) === index
    )
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
    const morphologyRow = findLexicalBriefMorphology(morphologyRows, entry)
    const morphologyTranslation = morphologyRow
      ? await translationFor(
          core.id,
          'MorphologyCodeTranslations',
          number(morphologyRow, 'id'),
          input.language
        )
      : undefined
    const resourcePublication =
      input.content !== 'definitions' && resourcesState.status === 'available'
        ? await activePublication('resources')
        : undefined
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
    if (input.content !== 'definitions' && entitiesState.status === 'available') {
      const entityPublication = await activePublication('entities')
      let entityCandidates = entityPublication
        ? await records(entityPublication.id, 'Entities', query =>
            query.where(
              sql<boolean>`(payload->>'uStrong' = ${text(entry, 'uStrong')} OR payload->>'uStrong' = ${text(entry, 'eStrong')})`
            )
          )
        : []
      if (entityPublication && entityCandidates.length === 0) {
        entityCandidates = (
          await records(entityPublication.id, 'Entities', query =>
            query.where(
              sql<boolean>`(payload->>'uStrong') ~ ${`^${entityStrongPrefix(entry)}0*${number(entry, 'baseCode')}(?:[^0-9]|$)`}`
            )
          )
        ).filter(isEntityNamedLikeEntry(entry))
      }
      const entityRow = preferredEntityOf(entry, entityCandidates)
      if (entityPublication && entityRow) {
        entity = await hydrateEntity(core, entityPublication, entityRow, input.language)
      }
    }
    return composeEntry(input, {
      core,
      entry,
      identity,
      translation,
      relationRows,
      relationKinds,
      morphologyRow,
      morphologyTranslation,
      directTargetEntries,
      fallbackTargetEntries,
      fallbackTargetIdentities,
      relationTranslations,
      resourceRows,
      resourceTranslations,
      entity,
      resourcesState,
      entitiesState,
    })
  }

  // Every row a detailed entry is made of, gathered in one round trip and in the snapshot
  // of one statement: the three publications cannot be read at different moments.
  //
  // The statement only fetches. It applies the filters of the statement-by-statement read
  // and keeps its row order; where a choice depends on text normalisation it returns the
  // candidates, and TypeScript chooses with the rules both reads share.
  //
  // Rows are matched through the typed columns the importer projects from each payload
  // (`entry_id`, `e_strong`, `u_strong`, `entity_id`…). They hold the values the earlier
  // statements read from the payload, and they are the indexed ones. Publication and row
  // identifiers reach each lookup as scalar or array parameters, so that it is an index
  // scan whatever the planner estimates for the rows gathered before it.
  const readDetailedEntryInOneStatement = async (
    input: EntryInput
  ): Promise<ActiveStrongLexiconValue<StrongLexiconEntry>> => {
    const { language } = input
    const normalized = normalizeCode(input.reference)
    const withAddons = input.content !== 'definitions'

    const exactIdentity =
      input.kind === 'ustrong' ? sql<boolean>`false` : sql<boolean>`i.step_code = ${normalized}`
    // A disambiguated code written in another case selects its entry when it names only one.
    const caseInsensitiveIdentity =
      input.kind === 'dstrong'
        ? sql`
          SELECT candidates.step_entry_id, candidates.step_code
            FROM (
              SELECT matching.step_entry_id, matching.step_code, count(*) OVER () AS matches
                FROM (
                  SELECT i.step_entry_id, i.step_code
                    FROM strong_lexicon_entry_identities i
                   WHERE i.publication_id = (SELECT id FROM core)
                     AND NOT EXISTS (SELECT 1 FROM exact_identity)
                     AND lower(i.step_code) = ${normalized.toLowerCase()}
                   ORDER BY i.step_entry_id, md5(i.step_entry_id::text || i.step_code)
                   LIMIT 2
                ) matching
            ) candidates
           WHERE candidates.matches = 1`
        : sql`SELECT step_entry_id, step_code FROM exact_identity WHERE false`
    // The entry of a reference no identity names: the first one, by identifier, that
    // carries it as one of its codes. Read only then: the scan is skipped otherwise.
    const firstEntryWhere = (condition: RawBuilder<boolean>) => sql`
          SELECT e.entry_id, e.language, e.e_strong, e.u_strong, e.payload
            FROM strong_lexicon_entries e
           WHERE e.publication_id = (SELECT id FROM core)
             AND NOT EXISTS (SELECT 1 FROM identity_entry)
             AND ${condition}
           ORDER BY e.entry_id
           LIMIT 1`
    const base = Number(normalized.replace(/^[HG]/u, '').replace(/^0+/u, ''))
    const entryWithoutIdentity =
      input.kind === 'dstrong'
        ? firstEntryWhere(sql<boolean>`e.d_strong LIKE ${`${normalized}%`}`)
        : input.kind === 'estrong'
          ? firstEntryWhere(sql<boolean>`e.e_strong = ${normalized}`)
          : input.kind === 'ustrong'
            ? firstEntryWhere(sql<boolean>`e.u_strong = ${normalized}`)
            : // A classical number, which an entry carries in four ways. Each is looked up
              // apart, on the index that serves it, rather than tested on every row.
              firstEntryWhere(sql<boolean>`e.entry_id = (
                 SELECT min(carrying.entry_id)
                   FROM (
                     SELECT entry_id FROM strong_lexicon_entries
                      WHERE publication_id = (SELECT id FROM core) AND e_strong = ${normalized}
                     UNION ALL
                     SELECT entry_id FROM strong_lexicon_entries
                      WHERE publication_id = (SELECT id FROM core) AND d_strong = ${normalized}
                     UNION ALL
                     SELECT entry_id FROM strong_lexicon_entries
                      WHERE publication_id = (SELECT id FROM core) AND u_strong = ${normalized}
                     UNION ALL
                     SELECT entry_id FROM strong_lexicon_entries
                      WHERE publication_id = (SELECT id FROM core)
                        AND language = ${normalized.startsWith('G') ? 'greek' : 'hebrew'}
                        AND (payload->>'baseCode')::integer = ${Number.isFinite(base) ? base : -1}
                   ) carrying
               )`)

    const addonRows = withAddons
      ? sql`,
        resources_publication AS MATERIALIZED (
          SELECT id FROM publications WHERE resource_identity = 'strong-lexicon:resources'
        ),
        resources AS MATERIALIZED (
          SELECT r.resource_id, r.payload
            FROM strong_lexicon_resources r
           WHERE r.publication_id = (SELECT id FROM resources_publication)
             AND r.step_entry_id = (SELECT entry_id FROM entry)
        ),
        entities_publication AS MATERIALIZED (
          SELECT id FROM publications WHERE resource_identity = 'strong-lexicon:entities'
        ),
        entities_by_code AS MATERIALIZED (
          SELECT n.entity_id, n.u_strong, n.payload
            FROM strong_lexicon_entities n
           WHERE n.publication_id = (SELECT id FROM entities_publication)
             AND n.u_strong = ANY (
                   ARRAY(SELECT u_strong FROM entry UNION ALL SELECT e_strong FROM entry)
                 )
        ),
        -- Without an entity under a code of the entry, those under its classical number;
        -- TypeScript keeps the ones named like the entry. LIKE discards most rows before
        -- the regular expression, which costs ten times more, is evaluated.
        entities_by_number AS MATERIALIZED (
          SELECT n.entity_id, n.u_strong, n.payload
            FROM strong_lexicon_entities n
           WHERE n.publication_id = (SELECT id FROM entities_publication)
             AND NOT EXISTS (SELECT 1 FROM entities_by_code)
             AND n.u_strong LIKE (SELECT entity_number_like FROM entry)
             AND n.u_strong ~ (SELECT entity_number_pattern FROM entry)
        ),
        entity_candidates AS MATERIALIZED (
          SELECT entity_id, u_strong FROM entities_by_code
          UNION ALL
          SELECT entity_id, u_strong FROM entities_by_number
        ),
        entity_relations AS MATERIALIZED (
          SELECT r.from_entity_id, r.relation_id, r.to_entity_id, r.payload
            FROM strong_lexicon_entity_relations r
           WHERE r.publication_id = (SELECT id FROM entities_publication)
             AND r.from_entity_id = ANY (ARRAY(SELECT entity_id FROM entity_candidates))
        ),
        entity_targets AS MATERIALIZED (
          SELECT n.entity_id, n.u_strong, n.payload
            FROM strong_lexicon_entities n
           WHERE n.publication_id = (SELECT id FROM entities_publication)
             AND (
                   n.entity_id = ANY (
                     ARRAY(SELECT to_entity_id FROM entity_relations WHERE to_entity_id > 0)
                   )
                   OR n.unique_name = ANY (
                     ARRAY(
                       SELECT named.unique_name
                         FROM (
                           SELECT substring(
                                    coalesce(payload->>'toUniqueName', '') from '[^|]*$'
                                  ) AS unique_name
                             FROM entity_relations
                         ) named
                        WHERE named.unique_name <> ''
                     )
                   )
                 )
        ),
        -- The core entries filed under the unified code of a candidate or of a target.
        entity_core_entries AS MATERIALIZED (
          SELECT e.entry_id, e.payload
            FROM strong_lexicon_entries e
           WHERE e.publication_id = (SELECT id FROM core)
             AND e.u_strong = ANY (
                   ARRAY(
                     SELECT u_strong FROM entity_candidates WHERE u_strong <> ''
                     UNION
                     SELECT u_strong FROM entity_targets WHERE u_strong <> ''
                   )
                 )
        )`
      : sql``
    const addonColumns = withAddons
      ? sql`
        (SELECT coalesce(jsonb_agg(payload ORDER BY md5(resource_id::text)), '[]'::jsonb)
           FROM resources) AS resources,
        (SELECT coalesce(jsonb_agg(t.payload), '[]'::jsonb)
           FROM strong_lexicon_resource_translations t
          WHERE t.publication_id = (SELECT id FROM resources_publication)
            AND t.resource_id = ANY (ARRAY(SELECT resource_id FROM resources))
            AND t.language = ${language}) AS resource_translations,
        (SELECT coalesce(jsonb_agg(payload ORDER BY entity_id), '[]'::jsonb)
           FROM entities_by_code) AS entities_by_code,
        (SELECT coalesce(jsonb_agg(payload ORDER BY entity_id), '[]'::jsonb)
           FROM entities_by_number) AS entities_by_number,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('entityId', t.entity_id, 'payload', t.payload)
                    ORDER BY t.entity_id, md5(t.translation_id::text)
                  ),
                  '[]'::jsonb
                )
           FROM strong_lexicon_entity_translations t
          WHERE t.publication_id = (SELECT id FROM entities_publication)
            AND t.entity_id = ANY (
                  ARRAY(
                    SELECT entity_id FROM entity_candidates
                    UNION
                    SELECT entity_id FROM entity_targets
                  )
                )
            AND t.language = ${language}) AS entity_translations,
        (SELECT coalesce(
                  jsonb_agg(jsonb_build_object('entityId', l.entity_id, 'payload', l.payload)),
                  '[]'::jsonb
                )
           FROM strong_lexicon_entity_places l
          WHERE l.publication_id = (SELECT id FROM entities_publication)
            AND l.entity_id = ANY (ARRAY(SELECT entity_id FROM entity_candidates))
        ) AS entity_places,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('entityId', from_entity_id, 'payload', payload)
                    ORDER BY from_entity_id, md5(relation_id::text)
                  ),
                  '[]'::jsonb
                )
           FROM entity_relations) AS entity_relations,
        (SELECT coalesce(jsonb_agg(payload ORDER BY entity_id), '[]'::jsonb)
           FROM entity_targets) AS entity_targets,
        (SELECT coalesce(jsonb_agg(payload ORDER BY entry_id), '[]'::jsonb)
           FROM entity_core_entries) AS entity_core_entries,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('stepEntryId', i.step_entry_id, 'stepCode', i.step_code)
                    ORDER BY i.step_entry_id
                  ),
                  '[]'::jsonb
                )
           FROM strong_lexicon_entry_identities i
          WHERE i.publication_id = (SELECT id FROM core)
            AND i.step_entry_id = ANY (ARRAY(SELECT entry_id FROM entity_core_entries))
        ) AS entity_core_identities`
      : sql`
        '[]'::jsonb AS resources,
        '[]'::jsonb AS resource_translations,
        '[]'::jsonb AS entities_by_code,
        '[]'::jsonb AS entities_by_number,
        '[]'::jsonb AS entity_translations,
        '[]'::jsonb AS entity_places,
        '[]'::jsonb AS entity_relations,
        '[]'::jsonb AS entity_targets,
        '[]'::jsonb AS entity_core_entries,
        '[]'::jsonb AS entity_core_identities`

    type OfEntity = { entityId: number; payload: Payload }
    type DetailedEntryRows = {
      publications: {
        identity: string
        id: number
        revision: string
        metadata: Record<string, unknown>
      }[]
      entry: Payload | null
      identity: Payload | null
      translation: Payload | null
      relations: Payload[]
      relation_kinds: Payload[]
      morphology_codes: Payload[]
      morphology_translations: { morphologyCodeId: number; payload: Payload }[]
      direct_targets: Payload[]
      classic_targets: Payload[]
      classic_target_identities: Payload[]
      target_translations: Payload[]
      resources: Payload[]
      resource_translations: Payload[]
      entities_by_code: Payload[]
      entities_by_number: Payload[]
      entity_translations: OfEntity[]
      entity_places: OfEntity[]
      entity_relations: OfEntity[]
      entity_targets: Payload[]
      entity_core_entries: Payload[]
      entity_core_identities: Payload[]
    }
    const gathered = await sql<DetailedEntryRows>`
      WITH publications AS MATERIALIZED (
        SELECT resource_identity, id, revision, metadata
          FROM resource_publications
         WHERE resource_identity IN (
                 'strong-lexicon:core', 'strong-lexicon:resources', 'strong-lexicon:entities'
               )
           AND status = 'active'
      ),
      core AS MATERIALIZED (
        SELECT id FROM publications WHERE resource_identity = 'strong-lexicon:core'
      ),
      exact_identity AS MATERIALIZED (
        SELECT i.step_entry_id, i.step_code
          FROM strong_lexicon_entry_identities i
         WHERE i.publication_id = (SELECT id FROM core)
           AND ${exactIdentity}
      ),
      requested_identity AS MATERIALIZED (
        SELECT step_entry_id, step_code FROM exact_identity
        UNION ALL
        (${caseInsensitiveIdentity})
      ),
      identity_entry AS MATERIALIZED (
        SELECT e.entry_id, e.language, e.e_strong, e.u_strong, e.payload
          FROM strong_lexicon_entries e
         WHERE e.publication_id = (SELECT id FROM core)
           AND e.entry_id = (SELECT step_entry_id FROM requested_identity)
      ),
      entry_without_identity AS MATERIALIZED (${entryWithoutIdentity}
      ),
      -- The fields other rows are matched on are read from the payload once, here.
      entry AS MATERIALIZED (
        SELECT found.entry_id,
               found.payload,
               found.u_strong,
               found.e_strong,
               coalesce(found.payload->>'morph', '') AS morph,
               found.prefix || '0*' || found.base_code || '(?:[^0-9]|$)' AS entity_number_pattern,
               CASE WHEN found.base_code ~ '^[0-9]+$'
                    THEN substring(found.prefix from 2) || '%' || found.base_code || '%'
                    ELSE '%'
               END AS entity_number_like
          FROM (
            SELECT matching.*,
                   '^' || CASE WHEN matching.language = 'greek' THEN 'G' ELSE 'H' END AS prefix,
                   coalesce(matching.payload->>'baseCode', '0') AS base_code
              FROM (
                SELECT * FROM identity_entry
                UNION ALL
                SELECT * FROM entry_without_identity
              ) matching
          ) found
      ),
      relations AS MATERIALIZED (
        SELECT r.relation_id, r.to_entry_id, r.payload
          FROM strong_lexicon_relations r
         WHERE r.publication_id = (SELECT id FROM core)
           AND r.from_entry_id = (SELECT entry_id FROM entry)
      ),
      direct_targets AS MATERIALIZED (
        SELECT e.entry_id, e.payload
          FROM strong_lexicon_entries e
         WHERE e.publication_id = (SELECT id FROM core)
           AND e.entry_id = ANY (
                 ARRAY(SELECT to_entry_id FROM relations WHERE to_entry_id <> 0)
               )
      ),
      -- Relations naming a classical number instead of an entry. Punctuation is dropped so
      -- that every code TypeScript accepts is kept; TypeScript rejects the others.
      classic_codes AS MATERIALIZED (
        SELECT DISTINCT
               CASE WHEN code.parts[1] IN ('H', 'h') THEN 'hebrew' ELSE 'greek' END AS language,
               code.parts[2]::integer AS base_code
          FROM relations r
         CROSS JOIN LATERAL (
                 SELECT regexp_match(
                          regexp_replace(
                            coalesce(r.payload->>'toStepCode', ''), '[^0-9A-Za-z]', '', 'g'
                          ),
                          '^([HGhg])?0*([0-9]{1,9})$'
                        ) AS parts
               ) code
         WHERE coalesce(r.to_entry_id, 0) = 0
           AND code.parts IS NOT NULL
      ),
      classic_targets AS MATERIALIZED (
        SELECT e.entry_id, e.payload
          FROM strong_lexicon_entries e
         WHERE e.publication_id = (SELECT id FROM core)
           AND EXISTS (SELECT 1 FROM classic_codes)
           AND EXISTS (
                 SELECT 1
                   FROM classic_codes c
                  WHERE e.language = c.language
                    AND (e.payload->>'baseCode')::integer = c.base_code
               )
      ),
      morphology_codes AS MATERIALIZED (
        SELECT m.morphology_code_id, m.payload
          FROM strong_lexicon_morphology_codes m
         WHERE m.publication_id = (SELECT id FROM core)
           AND m.scope = 'lexical_brief'
           AND (
                 m.code = (SELECT morph FROM entry)
                 OR m.normalized_code = (SELECT morph FROM entry)
               )
      )${addonRows}
      SELECT
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'identity', resource_identity,
                      'id', id,
                      'revision', revision,
                      'metadata', metadata
                    )
                  ),
                  '[]'::jsonb
                )
           FROM publications) AS publications,
        (SELECT payload FROM entry) AS entry,
        (SELECT jsonb_build_object('stepEntryId', i.step_entry_id, 'stepCode', i.step_code)
           FROM strong_lexicon_entry_identities i
          WHERE i.publication_id = (SELECT id FROM core)
            AND i.step_entry_id = (SELECT entry_id FROM entry)) AS identity,
        (SELECT t.payload
           FROM strong_lexicon_translations t
          WHERE t.publication_id = (SELECT id FROM core)
            AND t.step_entry_id = (SELECT entry_id FROM entry)
            AND t.language = ${language}) AS translation,
        (SELECT coalesce(jsonb_agg(payload ORDER BY md5(relation_id::text)), '[]'::jsonb)
           FROM relations) AS relations,
        (SELECT coalesce(jsonb_agg(k.payload ORDER BY k.relation_kind_id), '[]'::jsonb)
           FROM strong_lexicon_relation_kinds k
          WHERE k.publication_id = (SELECT id FROM core)
            AND EXISTS (SELECT 1 FROM entry)) AS relation_kinds,
        (SELECT coalesce(jsonb_agg(payload ORDER BY morphology_code_id), '[]'::jsonb)
           FROM morphology_codes) AS morphology_codes,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'morphologyCodeId', t.morphology_code_id, 'payload', t.payload
                    )
                  ),
                  '[]'::jsonb
                )
           FROM strong_lexicon_morphology_code_translations t
          WHERE t.publication_id = (SELECT id FROM core)
            AND t.morphology_code_id = ANY (
                  ARRAY(SELECT morphology_code_id FROM morphology_codes)
                )
            AND t.language = ${language}) AS morphology_translations,
        (SELECT coalesce(jsonb_agg(payload ORDER BY entry_id), '[]'::jsonb)
           FROM direct_targets) AS direct_targets,
        (SELECT coalesce(jsonb_agg(payload ORDER BY entry_id), '[]'::jsonb)
           FROM classic_targets) AS classic_targets,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('stepEntryId', i.step_entry_id, 'stepCode', i.step_code)
                    ORDER BY i.step_entry_id
                  ),
                  '[]'::jsonb
                )
           FROM strong_lexicon_entry_identities i
          WHERE i.publication_id = (SELECT id FROM core)
            AND i.step_entry_id = ANY (ARRAY(SELECT entry_id FROM classic_targets))
        ) AS classic_target_identities,
        (SELECT coalesce(jsonb_agg(t.payload ORDER BY t.step_entry_id), '[]'::jsonb)
           FROM strong_lexicon_translations t
          WHERE t.publication_id = (SELECT id FROM core)
            AND t.step_entry_id = ANY (
                  ARRAY(
                    SELECT entry_id FROM direct_targets
                    UNION
                    SELECT entry_id FROM classic_targets
                  )
                )
            AND t.language = ${language}) AS target_translations,
        ${addonColumns}
    `.execute(database)
    const rows = gathered.rows[0]

    const publication = (moduleId: StrongLexiconModuleId): Publication | undefined =>
      rows?.publications.find(candidate => candidate.identity === `strong-lexicon:${moduleId}`)
    const core = publication('core')
    if (!core) throw new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'core' })
    if (!rows?.entry || !rows.identity) {
      throw new StrongLexiconEntryNotFound({ reference: input.reference })
    }
    const { entry } = rows
    const resourcesState = moduleStateFrom('resources', publication('resources'), core.revision)
    const entitiesState = moduleStateFrom('entities', publication('entities'), core.revision)

    const relationRows = rows.relations.sort(
      (left, right) => number(left, 'sortOrder') - number(right, 'sortOrder')
    )
    const morphologyRow = findLexicalBriefMorphology(rows.morphology_codes, entry)
    const morphologyTranslation = morphologyRow
      ? rows.morphology_translations.find(
          translated => translated.morphologyCodeId === number(morphologyRow, 'id')
        )?.payload
      : undefined
    const resourceRows =
      resourcesState.status === 'available'
        ? rows.resources.sort((left, right) => number(left, 'id') - number(right, 'id'))
        : []

    let entity: StrongLexiconEntity | undefined
    if (withAddons && entitiesState.status === 'available') {
      const entityRow = entityOfEntry(entry, rows.entities_by_code, rows.entities_by_number)
      if (entityRow) {
        const entityId = number(entityRow, 'id')
        const ofEntity = (candidates: OfEntity[]) =>
          candidates
            .filter(candidate => candidate.entityId === entityId)
            .map(candidate => candidate.payload)
        entity = composeEntity(
          {
            entity: entityRow,
            translation: ofEntity(rows.entity_translations)[0],
            place: ofEntity(rows.entity_places)[0],
            relationRows: ofEntity(rows.entity_relations),
            targetRows: rows.entity_targets,
            targetTranslations: rows.entity_translations.map(translated => translated.payload),
            coreEntries: rows.entity_core_entries,
            coreIdentities: rows.entity_core_identities,
          },
          language
        )
      }
    }

    return composeEntry(input, {
      core,
      entry,
      identity: rows.identity,
      translation: rows.translation ?? undefined,
      relationRows,
      relationKinds: rows.relation_kinds,
      morphologyRow,
      morphologyTranslation,
      directTargetEntries: rows.direct_targets,
      fallbackTargetEntries: rows.classic_targets.filter(
        isClassicTargetOf(unresolvedClassicTargetsOf(relationRows))
      ),
      fallbackTargetIdentities: rows.classic_target_identities,
      relationTranslations: rows.target_translations,
      resourceRows,
      resourceTranslations: resourcesState.status === 'available' ? rows.resource_translations : [],
      entity,
      resourcesState,
      entitiesState,
    })
  }

  const readDetailedEntry =
    options.detailedEntryRead === 'statement-by-statement'
      ? readDetailedEntryStatementByStatement
      : readDetailedEntryInOneStatement

  // The detailed entry a sense is, as its own route reads it: by the code of the sense.
  const readNumberSenseDetail = async (
    stepCode: string,
    language: StrongLexiconLanguage
  ): Promise<NumberSenseDetail> => {
    try {
      return numberSenseDetailOf((await readDetailedEntry({ reference: stepCode, language })).value)
    } catch (cause) {
      // A sense the detailed lexicon does not hold has nothing more to tell.
      if (mapRepositoryCause(cause) instanceof StrongLexiconEntryNotFound) return {}
      throw cause
    }
  }

  // The senses of a number as a page of the public site read them: the cards of every code
  // a sense can carry, then the detailed entry of each sense, one after the other. It is the
  // reference the single statement is tested against.
  const readNumberSensesReadByRead = async (input: NumberSensesInput): Promise<NumberSenses> => {
    const classicCode = normalizeCode(input.number)
    const simple = await requiredCore(input.language, 'simple')
    const core = await requiredCore(input.language)
    const entities = await getState('entities')
    const cards = numberSenseCardsOf(
      classicCode,
      await findEntryCardsBatch(numberSenseCardsInput(classicCode, input.language))
    )
    const senses: { card: StrongLexiconEntryCard; detail: NumberSenseDetail }[] = []
    for (const card of cards) {
      senses.push({ card, detail: await readNumberSenseDetail(card.stepCode, input.language) })
    }
    return composeNumberSenses(
      classicCode,
      { simple: simple.revision, core: core.revision, entities },
      senses
    )
  }

  // The senses of a number in one round trip: the rows of their cards, read from the simple
  // lexicon by the statement of entry cards, then what the detailed lexicon and its entities
  // tell each sense apart by.
  //
  // The statement only fetches. The cards are chosen and composed as for a batch; the
  // detailed entry of a sense is the one its code names, and its entity is chosen by the
  // rule of a detailed entry, among candidates returned with the values they were matched on.
  //
  // A detailed entry is found here by the identity written like the code of the sense, which
  // is how every published sense is named. A code that is not in the spelling a reference is
  // normalised to, or that the detailed lexicon does not name, is read by the statement of a
  // detailed entry, which knows the other ways an entry carries a code.
  const readNumberSensesInOneStatement = async (
    input: NumberSensesInput
  ): Promise<NumberSenses> => {
    const { language } = input
    const classicCode = normalizeCode(input.number)
    const cardsInput = numberSenseCardsInput(classicCode, language)
    const cardRows = entryCardRowsStatement(cardsInput)

    type DetailedEntryRow = {
      entryId: number
      eStrong: string
      uStrong: string
      numberPattern: string
      payload: Payload
    }
    type NumberSenseRows = EntryCardRowsGathered & {
      detailed_publications: {
        identity: string
        id: number
        revision: string
        metadata: Record<string, unknown>
      }[]
      detailed_identities: EntryIdentityRow[]
      detailed_entries: DetailedEntryRow[]
      detailed_translations: { stepEntryId: number; payload: Payload }[]
      entities_by_code: { uStrong: string; payload: Payload }[]
      entities_by_number: { numberPattern: string; payload: Payload }[]
      entity_translations: { entityId: number; payload: Payload }[]
    }
    const gathered = await sql<NumberSenseRows>`
      WITH ${cardRows.expressions},
      detailed_publications AS MATERIALIZED (
        SELECT resource_identity, id, revision, metadata
          FROM resource_publications
         WHERE resource_identity IN ('strong-lexicon:core', 'strong-lexicon:entities')
           AND status = 'active'
      ),
      detailed_core AS MATERIALIZED (
        SELECT id FROM detailed_publications WHERE resource_identity = 'strong-lexicon:core'
      ),
      entities_publication AS MATERIALIZED (
        SELECT id FROM detailed_publications WHERE resource_identity = 'strong-lexicon:entities'
      ),
      -- The detailed identities written like an identity of a candidate entry: a sense is
      -- named by one of these codes.
      detailed_identities AS MATERIALIZED (
        SELECT d.step_entry_id, d.step_code
          FROM strong_lexicon_entry_identities d
         WHERE d.publication_id = (SELECT id FROM detailed_core)
           AND d.step_code = ANY (
                 ARRAY(
                   SELECT i.step_code
                     FROM strong_lexicon_entry_identities i
                    WHERE i.publication_id = (SELECT id FROM core)
                      AND i.step_entry_id = ANY (ARRAY(SELECT entry_id FROM candidates))
                 )
               )
      ),
      -- The fields entities are matched on are read once, here, as for a detailed entry.
      detailed_entries AS MATERIALIZED (
        SELECT found.entry_id,
               found.payload,
               found.u_strong,
               found.e_strong,
               found.prefix || '0*' || found.base_code || '(?:[^0-9]|$)' AS entity_number_pattern,
               CASE WHEN found.base_code ~ '^[0-9]+$'
                    THEN substring(found.prefix from 2) || '%' || found.base_code || '%'
                    ELSE '%'
               END AS entity_number_like
          FROM (
            SELECT e.entry_id,
                   e.payload,
                   e.u_strong,
                   e.e_strong,
                   '^' || CASE WHEN e.language = 'greek' THEN 'G' ELSE 'H' END AS prefix,
                   coalesce(e.payload->>'baseCode', '0') AS base_code
              FROM strong_lexicon_entries e
             WHERE e.publication_id = (SELECT id FROM detailed_core)
               AND e.entry_id = ANY (ARRAY(SELECT step_entry_id FROM detailed_identities))
          ) found
      ),
      entities_by_code AS MATERIALIZED (
        SELECT n.entity_id, n.u_strong, n.payload
          FROM strong_lexicon_entities n
         WHERE n.publication_id = (SELECT id FROM entities_publication)
           AND n.u_strong = ANY (
                 ARRAY(
                   SELECT u_strong FROM detailed_entries
                   UNION ALL
                   SELECT e_strong FROM detailed_entries
                 )
               )
      ),
      -- The numbers of the entries without an entity under one of their codes: the senses
      -- of a number share theirs, so the entities are scanned once.
      numbers_without_entity AS MATERIALIZED (
        SELECT DISTINCT e.entity_number_pattern, e.entity_number_like
          FROM detailed_entries e
         WHERE NOT EXISTS (
                 SELECT 1 FROM entities_by_code n WHERE n.u_strong IN (e.u_strong, e.e_strong)
               )
      ),
      entities_by_number AS MATERIALIZED (
        SELECT w.entity_number_pattern, n.entity_id, n.payload
          FROM numbers_without_entity w
          JOIN strong_lexicon_entities n
            ON n.publication_id = (SELECT id FROM entities_publication)
           AND n.u_strong LIKE w.entity_number_like
           AND n.u_strong ~ w.entity_number_pattern
      )
      SELECT ${cardRows.columns},
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'identity', resource_identity,
                      'id', id,
                      'revision', revision,
                      'metadata', metadata
                    )
                  ),
                  '[]'::jsonb
                )
           FROM detailed_publications) AS detailed_publications,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('stepEntryId', step_entry_id, 'stepCode', step_code)
                  ),
                  '[]'::jsonb
                )
           FROM detailed_identities) AS detailed_identities,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'entryId', entry_id,
                      'eStrong', e_strong,
                      'uStrong', u_strong,
                      'numberPattern', entity_number_pattern,
                      'payload', payload
                    )
                  ),
                  '[]'::jsonb
                )
           FROM detailed_entries) AS detailed_entries,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('stepEntryId', t.step_entry_id, 'payload', t.payload)
                  ),
                  '[]'::jsonb
                )
           FROM strong_lexicon_translations t
          WHERE t.publication_id = (SELECT id FROM detailed_core)
            AND t.step_entry_id = ANY (ARRAY(SELECT entry_id FROM detailed_entries))
            AND t.language = ${language}) AS detailed_translations,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('uStrong', u_strong, 'payload', payload)
                    ORDER BY entity_id
                  ),
                  '[]'::jsonb
                )
           FROM entities_by_code) AS entities_by_code,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('numberPattern', entity_number_pattern, 'payload', payload)
                    ORDER BY entity_id
                  ),
                  '[]'::jsonb
                )
           FROM entities_by_number) AS entities_by_number,
        (SELECT coalesce(
                  jsonb_agg(
                    jsonb_build_object('entityId', t.entity_id, 'payload', t.payload)
                    ORDER BY t.entity_id, md5(t.translation_id::text)
                  ),
                  '[]'::jsonb
                )
           FROM strong_lexicon_entity_translations t
          WHERE t.publication_id = (SELECT id FROM entities_publication)
            AND t.entity_id = ANY (
                  ARRAY(
                    SELECT entity_id FROM entities_by_code
                    UNION
                    SELECT entity_id FROM entities_by_number
                  )
                )
            AND t.language = ${language}) AS entity_translations
    `.execute(database)
    const rows = gathered.rows[0]
    if (!rows) throw new ActiveStrongLexiconPublicationUnavailable({ moduleId: cardRows.moduleId })

    const simple = entryCardRowsOf(cardsInput, rows)
    const publication = (moduleId: StrongLexiconModuleId): Publication | undefined =>
      rows.detailed_publications.find(
        candidate => candidate.identity === `strong-lexicon:${moduleId}`
      )
    const core = publication('core')
    if (!core) throw new ActiveStrongLexiconPublicationUnavailable({ moduleId: 'core' })
    const entitiesState = moduleStateFrom('entities', publication('entities'), core.revision)

    const detailOf = (stepCode: string): NumberSenseDetail | undefined => {
      // A detailed entry is asked for by the normalised spelling of a code.
      if (normalizeCode(stepCode) !== stepCode) return undefined
      const identity = rows.detailed_identities.find(row => row.stepCode === stepCode)
      const found = rows.detailed_entries.find(row => row.entryId === identity?.stepEntryId)
      if (!found) return undefined
      const entry = found.payload
      const definition = definitionOf(
        entry,
        rows.detailed_translations.find(row => row.stepEntryId === found.entryId)?.payload,
        language
      )
      const entity =
        entitiesState.status === 'available'
          ? entityOfEntry(
              entry,
              rows.entities_by_code
                .filter(row => [found.uStrong, found.eStrong].includes(row.uStrong))
                .map(row => row.payload),
              rows.entities_by_number
                .filter(row => row.numberPattern === found.numberPattern)
                .map(row => row.payload)
            )
          : undefined
      return {
        ...(definition ? { detailedDefinitionHtml: definition } : {}),
        ...(entity
          ? {
              entityBrief: entityBriefOf(
                entity,
                rows.entity_translations.find(row => row.entityId === number(entity, 'id'))
                  ?.payload,
                language
              ),
            }
          : {}),
      }
    }

    const senses: { card: StrongLexiconEntryCard; detail: NumberSenseDetail }[] = []
    for (const card of numberSenseCardsOf(classicCode, composeEntryCards(cardsInput, simple))) {
      senses.push({
        card,
        detail: detailOf(card.stepCode) ?? (await readNumberSenseDetail(card.stepCode, language)),
      })
    }
    return composeNumberSenses(
      classicCode,
      { simple: simple.core.revision, core: core.revision, entities: entitiesState },
      senses
    )
  }

  const readNumberSenses =
    options.numberSensesRead === 'read-by-read'
      ? readNumberSensesReadByRead
      : readNumberSensesInOneStatement

  return {
    findEntryCards: input =>
      tryDatabasePromise('strong-lexicon.entries-batch', () => findEntryCardsBatch(input)).pipe(
        Effect.mapError(mapRepositoryCause)
      ),
    findNumberSenses: input =>
      tryDatabasePromise('strong-lexicon.number-senses', () => readNumberSenses(input)).pipe(
        Effect.mapError(mapRepositoryCause)
      ),
    getModuleState: moduleId =>
      tryDatabasePromise('strong-lexicon.module-state', () => getState(moduleId)).pipe(
        Effect.mapError(cause => new StrongLexiconRepositoryFailure({ cause }))
      ),

    findEntry: input =>
      tryDatabasePromise('strong-lexicon.entry', async () => {
        if (input.level === 'simple') {
          const [card] = await findEntryCardsBatch({
            ...input,
            identities: [{ reference: input.reference, kind: input.kind ?? 'strong' }],
          })
          if (!card) throw new StrongLexiconEntryNotFound({ reference: input.reference })
          return {
            revision: card.revision,
            value: {
              ...card.value,
              relations: [],
              resources: [],
              lsjAbsent: true,
              modules: {
                resources: { status: 'missing' as const, moduleId: 'resources' as const },
                entities: { status: 'missing' as const, moduleId: 'entities' as const },
              },
            },
          }
        }
        return readDetailedEntry(input)
      }).pipe(Effect.mapError(mapRepositoryCause)),

    listEntries: input =>
      tryDatabasePromise('strong-lexicon.entries', async () => {
        const core = await requiredCore(input.language, input.level)
        const search = input.search?.trim()
        const prefix = input.prefix?.trim()
        const cursor = decodeStrongLexiconPageCursor(input.cursor)
        // Entries sharing a unified identity are listed under one of them unless all are asked for.
        const filters = [
          input.identities === 'all' ? sql<boolean>`true` : sql<boolean>`representative_rank = 1`,
        ]
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
        const core = await requiredCore(input.language, input.level)
        type RandomRow = { payload: Payload; step_code: string; translation: Payload | null }
        const randomResult = await sql<RandomRow>`
          WITH bounds AS (
            SELECT min(entry_id) AS minimum, max(entry_id) AS maximum
              FROM strong_lexicon_entries
             WHERE publication_id=${core.id} AND language=${input.lexicalLanguage}
               AND payload->>'gloss' <> ''
               AND (${input.level !== 'simple'} OR payload->>'meaning' <> '')
          )
          SELECT e.payload, i.step_code, tr.payload AS translation
            FROM bounds
            JOIN LATERAL (
              SELECT * FROM strong_lexicon_entries
               WHERE publication_id=${core.id} AND language=${input.lexicalLanguage}
                 AND payload->>'gloss' <> ''
               AND (${input.level !== 'simple'} OR payload->>'meaning' <> '')
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
        const core = await requiredCore(input.language, input.level)
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
        const core = await requiredCore(input.language)
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
        const core = await requiredCore(input.language)
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
