import { createHash } from 'node:crypto'

import { Data, Effect } from 'effect'
import { sql, type Kysely } from 'kysely'
import initSqlJs from 'sql.js'

import { tryDatabasePromise, type DatabaseFailure } from '../database/databaseEffect'
import type { ResourceDatabase } from '../database/types'
import {
  isBiblePublicationBundleManifest,
  isDictionaryPublicationBundleManifest,
  isDictionaryDirectoryPublicationBundleManifest,
  isCommentaryPublicationBundleManifest,
  isCrossReferencePublicationBundleManifest,
  isTimelinePublicationBundleManifest,
  isInterlinearBiblePublicationBundleManifest,
  isNavePublicationBundleManifest,
  isStrongLexiconPublicationBundleManifest,
  commentaryVerseContent,
  validatePublicationBundle,
  type CanonicalStrongLexiconModulePublication,
  type CanonicalDictionaryPublication,
  type CanonicalCommentaryPublication,
  type CanonicalCrossReferencePublication,
  type CanonicalTimelinePublication,
} from '../publication/publicationBundle'
import { getPublicationIdentityProjection } from '../publication/publicationIdentity'

export class PublicationImportFailure extends Data.TaggedError('PublicationImportFailure')<{
  readonly code: 'VALIDATION_FAILED' | 'REVISION_COLLISION'
  readonly message: string
  readonly cause?: unknown
}> {}

type PublicationImportResultBase = {
  status: 'activated' | 'staged' | 'unchanged'
  resourceIdentity: string
  revision: string
}

type PublicationImportResult =
  | (PublicationImportResultBase & { verseCount: number })
  | (PublicationImportResultBase & { itemCount: number })

export type PublicationImportOptions = {
  beforeActivation?: (signal: AbortSignal) => Promise<void>
  activateForLocalDevelopment?: boolean
}

const assertNotInterrupted = (signal: AbortSignal) => {
  if (signal.aborted) throw signal.reason ?? new Error('PUBLICATION_IMPORT_INTERRUPTED')
}

const toImportFailure = (cause: unknown) =>
  new PublicationImportFailure({
    code: 'VALIDATION_FAILED',
    message: cause instanceof Error ? cause.message : 'PUBLICATION_BUNDLE_VALIDATION_FAILED',
    cause,
  })

const normalizeJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, normalizeJson(nestedValue)])
    )
  }
  return value
}

const jsonEquals = (left: unknown, right: unknown) =>
  JSON.stringify(normalizeJson(left)) === JSON.stringify(normalizeJson(right))

type StrongRow = Record<string, string | number | null>

const rowNumber = (row: StrongRow, key: string): number | null =>
  typeof row[key] === 'number' && Number.isInteger(row[key]) ? row[key] : null
const rowString = (row: StrongRow, key: string): string =>
  typeof row[key] === 'string' ? row[key] : ''

const insertChunks = async <Table extends keyof ResourceDatabase>(
  transaction: Kysely<ResourceDatabase>,
  table: Table,
  values: Array<unknown>
) => {
  for (let offset = 0; offset < values.length; offset += 1_000) {
    await transaction
      .insertInto(table)
      .values(values.slice(offset, offset + 1_000) as never)
      .execute()
  }
}

type DictionaryDirectoryVersePresence = {
  verse_key: string
  work: string
  language: string
  resource_id: string
  title: string
  abbreviation: string
  entry_id: number
  word: string
  normalized_word: string
  correspondence_id: string | null
  evidence_kind: 'verse-name' | 'verse-phrase'
}

export const readDictionaryDirectoryVersePresences = async (
  offlineContent: Uint8Array
): Promise<DictionaryDirectoryVersePresence[]> => {
  const SQL = await initSqlJs()
  const database = new SQL.Database(offlineContent)
  try {
    const result = database.exec(`
      SELECT anchor.verse_key, work.work, work.language, work.resource_id, work.title,
             work.abbreviation, entry.entry_id, entry.word, entry.normalized_word,
             correspondence.correspondence_id, evidence.evidence_kind
      FROM dictionary_passage_anchors anchor
      JOIN dictionary_works work ON work.work_key = anchor.work_key
      JOIN dictionary_entries entry
        ON entry.work_key = anchor.work_key AND entry.entry_id = anchor.entry_id
      JOIN dictionary_anchor_evidence evidence
        ON evidence.evidence_key = anchor.evidence_key
      LEFT JOIN dictionary_correspondence_members member
        ON member.work_key = entry.work_key AND member.entry_id = entry.entry_id
      LEFT JOIN dictionary_correspondences correspondence
        ON correspondence.correspondence_key = member.correspondence_key
      WHERE evidence.evidence_kind IN ('verse-name', 'verse-phrase')
      ORDER BY anchor.verse_key, work.work_key, anchor.ordinal, entry.entry_id
    `)[0]
    if (!result) return []
    return result.values.map(values => {
      const row = Object.fromEntries(result.columns.map((column, index) => [column, values[index]]))
      const evidenceKind = row.evidence_kind
      if (evidenceKind !== 'verse-name' && evidenceKind !== 'verse-phrase') {
        throw new Error('DICTIONARY_DIRECTORY_EVIDENCE_KIND_INVALID')
      }
      const requiredStrings = [
        'verse_key',
        'work',
        'language',
        'resource_id',
        'title',
        'abbreviation',
        'word',
        'normalized_word',
      ] as const
      if (
        requiredStrings.some(key => typeof row[key] !== 'string' || row[key].length === 0) ||
        typeof row.entry_id !== 'number' ||
        !Number.isInteger(row.entry_id) ||
        (row.correspondence_id !== null && typeof row.correspondence_id !== 'string')
      ) {
        throw new Error('DICTIONARY_DIRECTORY_PRESENCE_INVALID')
      }
      return {
        verse_key: row.verse_key as string,
        work: row.work as string,
        language: row.language as string,
        resource_id: row.resource_id as string,
        title: row.title as string,
        abbreviation: row.abbreviation as string,
        entry_id: row.entry_id,
        word: row.word as string,
        normalized_word: row.normalized_word as string,
        correspondence_id: row.correspondence_id as string | null,
        evidence_kind: evidenceKind,
      }
    })
  } finally {
    database.close()
  }
}

const importStrongLexiconDomainProjection = async (
  transaction: Kysely<ResourceDatabase>,
  publicationId: number,
  canonical: CanonicalStrongLexiconModulePublication,
  signal: AbortSignal
) => {
  const rows = canonical.tables
  if (canonical.moduleId === 'core') {
    const nameMeanings = new Map(
      (rows.LexiconNameMeanings ?? []).map(row => [
        `${rowNumber(row, 'stepEntryId')}:${rowString(row, 'language')}`,
        rowString(row, 'valueHtml'),
      ])
    )
    await insertChunks(
      transaction,
      'strong_lexicon_entries',
      (rows.StepEntries ?? []).map(row => ({
        publication_id: publicationId,
        entry_id: rowNumber(row, 'id')!,
        language: rowString(row, 'language'),
        e_strong: rowString(row, 'eStrong'),
        d_strong: rowString(row, 'dStrong'),
        u_strong: rowString(row, 'uStrong'),
        payload: {
          ...row,
          ...(nameMeanings.get(`${rowNumber(row, 'id')}:en`)
            ? { nameMeaningEnHtml: nameMeanings.get(`${rowNumber(row, 'id')}:en`)! }
            : {}),
          ...(nameMeanings.get(`${rowNumber(row, 'id')}:fr`)
            ? { nameMeaningFrHtml: nameMeanings.get(`${rowNumber(row, 'id')}:fr`)! }
            : {}),
        },
      }))
    )
    await insertChunks(
      transaction,
      'strong_lexicon_entry_identities',
      (rows.StepEntryIdentities ?? []).map(row => ({
        publication_id: publicationId,
        step_entry_id: rowNumber(row, 'stepEntryId')!,
        step_code: rowString(row, 'stepCode'),
      }))
    )
    await insertChunks(
      transaction,
      'strong_lexicon_translations',
      (rows.LexiconTranslations ?? []).map(row => ({
        publication_id: publicationId,
        step_entry_id: rowNumber(row, 'stepEntryId')!,
        language: rowString(row, 'language'),
        payload: row,
      }))
    )
    await insertChunks(
      transaction,
      'strong_lexicon_relation_kinds',
      (rows.RelationKinds ?? []).map(row => ({
        publication_id: publicationId,
        relation_kind_id: rowNumber(row, 'id')!,
        kind: rowString(row, 'kind'),
        label_en: rowString(row, 'labelEn'),
        label_fr: rowString(row, 'labelFr'),
        payload: row,
      }))
    )
    await insertChunks(
      transaction,
      'strong_lexicon_relations',
      (rows.LexiconRelations ?? []).map(row => ({
        publication_id: publicationId,
        relation_id: rowNumber(row, 'id')!,
        from_entry_id: rowNumber(row, 'fromStepEntryId')!,
        to_entry_id: rowNumber(row, 'toStepEntryId'),
        relation_kind_id: rowNumber(row, 'relationKindId'),
        payload: row,
      }))
    )
    await insertChunks(
      transaction,
      'strong_lexicon_morphology_codes',
      (rows.MorphologyCodes ?? []).map(row => ({
        publication_id: publicationId,
        morphology_code_id: rowNumber(row, 'id')!,
        code: rowString(row, 'code'),
        normalized_code: rowString(row, 'normalizedCode'),
        language: rowString(row, 'language'),
        scope: rowString(row, 'scope'),
        payload: row,
      }))
    )
    await insertChunks(
      transaction,
      'strong_lexicon_morphology_code_translations',
      (rows.MorphologyCodeTranslations ?? []).map(row => ({
        publication_id: publicationId,
        morphology_code_id: rowNumber(row, 'morphologyCodeId')!,
        language: rowString(row, 'language'),
        payload: row,
      }))
    )
  }
  if (canonical.moduleId === 'resources') {
    await insertChunks(
      transaction,
      'strong_lexicon_resources',
      (rows.LexiconResources ?? []).map(row => ({
        publication_id: publicationId,
        resource_id: rowNumber(row, 'id')!,
        step_entry_id: rowNumber(row, 'stepEntryId')!,
        source: rowString(row, 'source'),
        kind: rowString(row, 'kind'),
        payload: row,
      }))
    )
    await insertChunks(
      transaction,
      'strong_lexicon_resource_translations',
      (rows.LexiconResourceTranslations ?? []).map(row => ({
        publication_id: publicationId,
        resource_id: rowNumber(row, 'resourceId')!,
        language: rowString(row, 'language'),
        payload: row,
      }))
    )
  }
  if (canonical.moduleId === 'entities') {
    await insertChunks(
      transaction,
      'strong_lexicon_entities',
      (rows.Entities ?? []).map(row => ({
        publication_id: publicationId,
        entity_id: rowNumber(row, 'id')!,
        unique_name: rowString(row, 'uniqueName'),
        u_strong: rowString(row, 'uStrong'),
        payload: row,
      }))
    )
    await insertChunks(
      transaction,
      'strong_lexicon_entity_translations',
      (rows.EntityTranslations ?? []).map(row => ({
        publication_id: publicationId,
        translation_id: rowNumber(row, 'id')!,
        entity_id: rowNumber(row, 'entityId')!,
        language: rowString(row, 'language'),
        payload: row,
      }))
    )
    await insertChunks(
      transaction,
      'strong_lexicon_entity_refs',
      (rows.EntityRefs ?? []).map(row => ({
        publication_id: publicationId,
        entity_id: rowNumber(row, 'entityId')!,
        book: rowString(row, 'book'),
        chapter: rowNumber(row, 'chapter')!,
        verse: rowNumber(row, 'verse')!,
        suffix: rowString(row, 'suffix'),
        payload: row,
      }))
    )
    await insertChunks(
      transaction,
      'strong_lexicon_entity_relations',
      (rows.EntityRelations ?? []).map((row, index) => ({
        publication_id: publicationId,
        relation_id: index + 1,
        from_entity_id: rowNumber(row, 'fromEntityId')!,
        to_entity_id: rowNumber(row, 'toEntityId'),
        relation: rowString(row, 'relation'),
        payload: row,
      }))
    )
    await insertChunks(
      transaction,
      'strong_lexicon_entity_places',
      (rows.EntityPlaces ?? []).map(row => ({
        publication_id: publicationId,
        entity_id: rowNumber(row, 'entityId')!,
        payload: row,
      }))
    )
  }
  assertNotInterrupted(signal)
}

const assertStrongLexiconCrossModuleReferences = async (
  transaction: Kysely<ResourceDatabase>,
  canonical: CanonicalStrongLexiconModulePublication,
  corePublicationId: number
) => {
  const coreEntries = await transaction
    .selectFrom('strong_lexicon_entries')
    .select(['entry_id', 'e_strong', 'd_strong', 'u_strong'])
    .where('publication_id', '=', corePublicationId)
    .execute()
  if (coreEntries.length === 0) {
    throw new PublicationImportFailure({
      code: 'VALIDATION_FAILED',
      message: 'STRONG_LEXICON_CORE_PROJECTION_MISSING',
    })
  }
  const coreEntryIds = new Set(coreEntries.map(row => row.entry_id))
  const coreCodes = new Set(
    coreEntries.flatMap(row =>
      [row.e_strong, row.d_strong, row.u_strong].map(value => value.trim().toUpperCase())
    )
  )
  const coreBaseCodes = new Set(
    [...coreCodes]
      .map(code => code.match(/^([HG]\d+)/u)?.[1])
      .filter((code): code is string => Boolean(code))
  )
  if (canonical.moduleId === 'resources') {
    for (const row of canonical.tables.LexiconResources ?? []) {
      const stepEntryId = rowNumber(row, 'stepEntryId')
      if (stepEntryId === null || !coreEntryIds.has(stepEntryId)) {
        throw new PublicationImportFailure({
          code: 'VALIDATION_FAILED',
          message: 'STRONG_LEXICON_RESOURCE_ENTRY_REFERENCE_INVALID',
        })
      }
    }
  }
  if (canonical.moduleId === 'entities') {
    for (const row of canonical.tables.Entities ?? []) {
      const uStrong = rowString(row, 'uStrong').trim().toUpperCase()
      const baseCode = uStrong.match(/^([HG]\d+)/u)?.[1]
      if (!uStrong || (!coreCodes.has(uStrong) && (!baseCode || !coreBaseCodes.has(baseCode)))) {
        throw new PublicationImportFailure({
          code: 'VALIDATION_FAILED',
          message: 'STRONG_LEXICON_ENTITY_CORE_IDENTITY_INVALID',
        })
      }
    }
  }
}

export const importPublicationBundle = (
  bundlePath: string,
  database: Kysely<ResourceDatabase>,
  options: PublicationImportOptions = {}
): Effect.Effect<PublicationImportResult, PublicationImportFailure | DatabaseFailure> =>
  Effect.tryPromise({
    try: () => validatePublicationBundle(bundlePath),
    catch: toImportFailure,
  }).pipe(
    Effect.flatMap(validated => {
      const { canonical, manifest, offlineContent } = validated
      const { resourceIdentity } = getPublicationIdentityProjection(manifest)
      const publicationStatus =
        manifest.deliveryCapabilities.onlineAccess ||
        (options.activateForLocalDevelopment &&
          manifest.deliveryCapabilities.localDevelopmentAccess === true)
          ? 'active'
          : 'staged'
      const publicationRevision = manifest.publicationRevision ?? manifest.revision
      const manifestSha256 = createHash('sha256').update(JSON.stringify(manifest)).digest('hex')
      const provenance = {
        source: manifest.provenance.sourceVersion,
        attribution: manifest.rights.attribution,
      }
      const rights = {
        holder: manifest.rights.holder,
        terms_reference: manifest.rights.termsReference,
        online: manifest.rights.online,
        offline: manifest.rights.offline,
        ...(manifest.rights.reviewedAt ? { reviewed_at: manifest.rights.reviewedAt } : {}),
      }
      const metadata = isBiblePublicationBundleManifest(manifest)
        ? {
            canon: manifest.canon,
            versification: manifest.versification,
            coverage: manifest.coverage,
            delivery_capabilities: manifest.deliveryCapabilities,
            counts: manifest.counts,
            canonical_schema_version: manifest.canonical.schemaVersion,
            resource_revision: manifest.revision,
            text_revision: manifest.revision,
            text_sha256:
              canonical.format === 'bible-strong-canonical-bible'
                ? canonical.textSha256
                : undefined,
            offline_entry: manifest.offlineArtifact.entry,
          }
        : isNavePublicationBundleManifest(manifest)
          ? {
              resource_id: manifest.identity.resourceId,
              alphabetical_browse: manifest.alphabeticalBrowse,
              delivery_capabilities: manifest.deliveryCapabilities,
              counts: manifest.counts,
              canonical_schema_version: manifest.canonical.schemaVersion,
              offline_entry: manifest.offlineArtifact.entry,
            }
          : isDictionaryPublicationBundleManifest(manifest)
            ? {
                resource_id: manifest.identity.resourceId,
                work: manifest.identity.work,
                language: manifest.identity.language,
                title: manifest.editorial.title,
                abbreviation: manifest.editorial.abbreviation,
                authors: manifest.editorial.authors,
                description: manifest.editorial.description,
                edition: manifest.editorial.edition,
                source: manifest.editorial.source,
                alphabetical_browse: manifest.alphabeticalBrowse,
                delivery_capabilities: manifest.deliveryCapabilities,
                counts: manifest.counts,
                canonical_schema_version: manifest.canonical.schemaVersion,
                resource_revision: manifest.revision,
                offline_entry: manifest.offlineArtifact.entry,
              }
            : isDictionaryDirectoryPublicationBundleManifest(manifest)
              ? {
                  resource_id: manifest.identity.resourceId,
                  language: manifest.identity.language,
                  delivery_capabilities: manifest.deliveryCapabilities,
                  counts: manifest.counts,
                  canonical_schema_version: manifest.canonical.schemaVersion,
                  resource_revision: manifest.revision,
                  offline_entry: manifest.offlineArtifact.entry,
                }
              : isCommentaryPublicationBundleManifest(manifest)
                ? {
                    resource_id: manifest.identity.resourceId,
                    language: manifest.identity.language,
                    delivery_capabilities: manifest.deliveryCapabilities,
                    counts: manifest.counts,
                    canonical_schema_version: manifest.canonical.schemaVersion,
                    resource_revision: manifest.revision,
                    offline_entry: manifest.offlineArtifact.entry,
                  }
                : isCrossReferencePublicationBundleManifest(manifest)
                  ? {
                      resource_id: manifest.identity.resourceId,
                      language: manifest.identity.language,
                      delivery_capabilities: manifest.deliveryCapabilities,
                      counts: manifest.counts,
                      canonical_schema_version: manifest.canonical.schemaVersion,
                      resource_revision: manifest.revision,
                      offline_entry: manifest.offlineArtifact.entry,
                    }
                  : isTimelinePublicationBundleManifest(manifest)
                    ? {
                        resource_id: manifest.identity.resourceId,
                        language: manifest.identity.language,
                        delivery_capabilities: manifest.deliveryCapabilities,
                        counts: manifest.counts,
                        canonical_schema_version: manifest.canonical.schemaVersion,
                        resource_revision: manifest.revision,
                        offline_entry: manifest.offlineArtifact.entry,
                      }
                    : isInterlinearBiblePublicationBundleManifest(manifest)
                      ? {
                          version_id: manifest.identity.versionId,
                          dataset_id: manifest.identity.datasetId,
                          language: manifest.identity.language,
                          delivery_capabilities: manifest.deliveryCapabilities,
                          dependencies: manifest.dependencies,
                          counts: manifest.counts,
                          canonical_schema_version: manifest.canonical.schemaVersion,
                          resource_revision: manifest.revision,
                          text_revision: manifest.dependencies.bible.revision,
                          text_sha256: manifest.dependencies.bible.textSha256,
                          offline_entry: manifest.offlineArtifact.entry,
                        }
                      : isStrongLexiconPublicationBundleManifest(manifest)
                        ? {
                            module_id: manifest.identity.moduleId,
                            delivery_capabilities: manifest.deliveryCapabilities,
                            dependencies: manifest.dependencies,
                            counts: manifest.counts,
                            canonical_schema_version: manifest.canonical.schemaVersion,
                            resource_revision: manifest.revision,
                            offline_entry: manifest.offlineArtifact.entry,
                          }
                        : {
                            version_id: manifest.identity.versionId,
                            dataset_id: manifest.identity.datasetId,
                            delivery_capabilities: manifest.deliveryCapabilities,
                            dependencies: manifest.dependencies,
                            counts: manifest.counts,
                            canonical_schema_version: manifest.canonical.schemaVersion,
                            resource_revision: manifest.revision,
                            text_revision: manifest.dependencies.bible.revision,
                            text_sha256: manifest.dependencies.bible.textSha256,
                            strong_revision:
                              canonical.format === 'bible-strong-canonical-strong-index'
                                ? canonical.strongRevision
                                : undefined,
                            offline_entry: manifest.offlineArtifact.entry,
                          }
      const publicationMetadata = { ...metadata, manifest_sha256: manifestSha256 }
      const makeResult = (status: PublicationImportResult['status']): PublicationImportResult =>
        isBiblePublicationBundleManifest(manifest)
          ? {
              status,
              resourceIdentity,
              revision: manifest.revision,
              verseCount: manifest.counts.verses,
            }
          : isNavePublicationBundleManifest(manifest)
            ? {
                status,
                resourceIdentity,
                revision: manifest.revision,
                itemCount: manifest.counts.topics,
              }
            : isDictionaryPublicationBundleManifest(manifest)
              ? {
                  status,
                  resourceIdentity,
                  revision: manifest.revision,
                  itemCount: manifest.counts.entries,
                }
              : isDictionaryDirectoryPublicationBundleManifest(manifest)
                ? {
                    status,
                    resourceIdentity,
                    revision: manifest.revision,
                    itemCount: manifest.counts.entries,
                  }
                : isCommentaryPublicationBundleManifest(manifest)
                  ? {
                      status,
                      resourceIdentity,
                      revision: manifest.revision,
                      itemCount: manifest.counts.verses,
                    }
                  : isCrossReferencePublicationBundleManifest(manifest)
                    ? {
                        status,
                        resourceIdentity,
                        revision: manifest.revision,
                        itemCount: manifest.counts.references,
                      }
                    : isTimelinePublicationBundleManifest(manifest)
                      ? {
                          status,
                          resourceIdentity,
                          revision: manifest.revision,
                          itemCount: manifest.counts.events,
                        }
                      : isInterlinearBiblePublicationBundleManifest(manifest)
                        ? {
                            status,
                            resourceIdentity,
                            revision: manifest.revision,
                            itemCount: manifest.counts.segments,
                          }
                        : isStrongLexiconPublicationBundleManifest(manifest)
                          ? {
                              status,
                              resourceIdentity,
                              revision: manifest.revision,
                              itemCount: Object.values(manifest.counts).reduce(
                                (total, count) => total + count,
                                0
                              ),
                            }
                          : {
                              status,
                              resourceIdentity,
                              revision: manifest.revision,
                              itemCount: manifest.counts.occurrences,
                            }

      return tryDatabasePromise(
        'publication.import',
        signal =>
          database.transaction().execute(async transaction => {
            assertNotInterrupted(signal)
            let activeStrongCoreId: number | undefined
            if (
              isStrongLexiconPublicationBundleManifest(manifest) &&
              manifest.identity.moduleId !== 'core'
            ) {
              const dependency = manifest.dependencies[0]
              const activeCore = await transaction
                .selectFrom('resource_publications')
                .select(['id', 'revision'])
                .where('resource_identity', '=', 'strong-lexicon:core')
                .where('status', '=', 'active')
                .executeTakeFirst()
              if (!dependency || activeCore?.revision !== dependency.revision) {
                throw new PublicationImportFailure({
                  code: 'VALIDATION_FAILED',
                  message: 'STRONG_LEXICON_CORE_DEPENDENCY_UNAVAILABLE',
                })
              }
              activeStrongCoreId = activeCore?.id
              if (
                activeStrongCoreId !== undefined &&
                canonical.format === 'bible-strong-canonical-strong-lexicon-module'
              ) {
                await assertStrongLexiconCrossModuleReferences(
                  transaction,
                  canonical,
                  activeStrongCoreId
                )
              }
            }
            const existing = await transaction
              .selectFrom('resource_publications')
              .select([
                'id',
                'status',
                'canonical_sha256',
                'offline_artifact_sha256',
                'provenance',
                'rights',
                'metadata',
              ])
              .where('resource_identity', '=', resourceIdentity)
              .where('revision', '=', publicationRevision)
              .executeTakeFirst()

            if (existing) {
              const { manifest_sha256: storedManifestSha256, ...storedMetadata } = existing.metadata
              const expectedStoredMetadata = { ...metadata } as Record<string, unknown>
              const canBackfillTextSha256 =
                storedMetadata.text_sha256 === undefined &&
                expectedStoredMetadata.text_sha256 !== undefined
              if (canBackfillTextSha256) delete expectedStoredMetadata.text_sha256
              if (
                existing.canonical_sha256 !== manifest.canonical.sha256 ||
                existing.offline_artifact_sha256 !== manifest.offlineArtifact.sha256 ||
                (storedManifestSha256 !== undefined && storedManifestSha256 !== manifestSha256) ||
                !jsonEquals(storedMetadata, expectedStoredMetadata) ||
                !jsonEquals(existing.rights, rights) ||
                existing.provenance.source !== provenance.source ||
                existing.provenance.attribution !== provenance.attribution
              ) {
                throw new PublicationImportFailure({
                  code: 'REVISION_COLLISION',
                  message: 'PUBLICATION_REVISION_COLLISION',
                })
              }
              if (storedManifestSha256 === undefined || canBackfillTextSha256) {
                await transaction
                  .updateTable('resource_publications')
                  .set({ metadata: publicationMetadata })
                  .where('id', '=', existing.id)
                  .execute()
              }
              if (existing.status === publicationStatus) {
                return makeResult('unchanged')
              }
              await transaction
                .deleteFrom('resource_publications')
                .where('id', '=', existing.id)
                .execute()
            }

            const publication = await transaction
              .insertInto('resource_publications')
              .values({
                resource_identity: resourceIdentity,
                resource_kind: manifest.identity.kind,
                revision: publicationRevision,
                language: manifest.identity.language,
                canonical_sha256: manifest.canonical.sha256,
                offline_artifact_sha256: manifest.offlineArtifact.sha256,
                provenance: {
                  ...provenance,
                  generator: manifest.provenance.generator,
                  source_version: manifest.provenance.sourceVersion,
                  source_sha256: manifest.provenance.sourceSha256,
                  generated_at: manifest.provenance.generatedAt,
                  imported_at: new Date().toISOString(),
                },
                rights,
                metadata: publicationMetadata,
              })
              .returning('id')
              .executeTakeFirstOrThrow()

            if (canonical.format === 'bible-strong-canonical-bible') {
              const rows = Object.entries(canonical.verses).flatMap(([book, chapters]) =>
                Object.entries(chapters).flatMap(([chapter, verses]) =>
                  Object.entries(verses).map(([verse, value]) => ({
                    publication_id: publication.id,
                    book: Number(book),
                    chapter: Number(chapter),
                    verse: Number(verse),
                    text: value.text,
                    presentation: {
                      startTags: value.startTags,
                      layout: value.layout,
                      notes: value.notes,
                      headings: value.headings,
                    },
                  }))
                )
              )

              for (let offset = 0; offset < rows.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('bible_verses')
                  .values(rows.slice(offset, offset + 1_000))
                  .execute()
              }
            } else if (canonical.format === 'bible-strong-canonical-nave') {
              for (let offset = 0; offset < canonical.topics.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('nave_topics')
                  .values(
                    canonical.topics.slice(offset, offset + 1_000).map(topic => ({
                      publication_id: publication.id,
                      normalized_name: topic.normalizedName,
                      name: topic.name,
                      initial: topic.initial,
                      description: topic.description,
                    }))
                  )
                  .execute()
              }
              const links = canonical.verseAnchors.flatMap(anchor =>
                anchor.topicNormalizedNames.map(normalizedName => ({
                  publication_id: publication.id,
                  verse_key: anchor.verseKey,
                  normalized_name: normalizedName,
                }))
              )
              for (let offset = 0; offset < links.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('nave_verse_links')
                  .values(links.slice(offset, offset + 1_000))
                  .execute()
              }
            } else if (canonical.format === 'bible-strong-canonical-dictionary') {
              const dictionaryCanonical = canonical as CanonicalDictionaryPublication
              await insertChunks(
                transaction,
                'dictionary_entries',
                dictionaryCanonical.entries.map(entry => ({
                  publication_id: publication.id,
                  entry_id: entry.id,
                  word: entry.word,
                  normalized_word: entry.normalizedWord,
                  definition: entry.definition,
                  correspondence_id: entry.correspondenceId ?? null,
                  payload: {
                    id: entry.id,
                    word: entry.word,
                    sanitized_word: entry.normalizedWord,
                    definition: entry.definition,
                  },
                }))
              )
              const entryById = new Map(dictionaryCanonical.entries.map(entry => [entry.id, entry]))
              const links = dictionaryCanonical.passageAnchors
                ? dictionaryCanonical.passageAnchors.flatMap(anchor =>
                    anchor.entries.map((reference, ordinal) => {
                      const entry = entryById.get(reference.entryId)
                      if (!entry) throw new Error('DICTIONARY_PASSAGE_ENTRY_MISSING')
                      return {
                        publication_id: publication.id,
                        verse_key: anchor.verseKey,
                        ordinal,
                        word: entry.word,
                        normalized_word: entry.normalizedWord,
                        entry_id: entry.id,
                        evidence_kind: reference.evidenceKind,
                      }
                    })
                  )
                : dictionaryCanonical.verseAnchors.flatMap(anchor =>
                    anchor.words.map((word, ordinal) => ({
                      publication_id: publication.id,
                      verse_key: anchor.verseKey,
                      ordinal,
                      word,
                      normalized_word: word.trim().toLocaleLowerCase(),
                      entry_id: null,
                      evidence_kind: null,
                    }))
                  )
              await insertChunks(transaction, 'dictionary_verse_links', links)
            } else if (canonical.format === 'bible-strong-canonical-dictionary-directory') {
              const presences = await readDictionaryDirectoryVersePresences(offlineContent)
              await insertChunks(
                transaction,
                'dictionary_directory_verse_presences',
                presences.map(presence => ({
                  publication_id: publication.id,
                  ...presence,
                }))
              )
            } else if (canonical.format === 'bible-strong-canonical-commentary') {
              const commentaryCanonical = canonical as CanonicalCommentaryPublication
              const commentaryDocuments =
                commentaryCanonical.schemaVersion === 2
                  ? new Map(
                      commentaryCanonical.documents.map(document => [document.id, document.content])
                    )
                  : undefined
              await insertChunks(
                transaction,
                'commentary_verses',
                commentaryCanonical.verses.map(verse => ({
                  publication_id: publication.id,
                  verse_key: verse.verseKey,
                  content: commentaryVerseContent(commentaryCanonical, verse, commentaryDocuments),
                }))
              )
            } else if (canonical.format === 'bible-strong-canonical-cross-references') {
              const crossReferenceCanonical = canonical as CanonicalCrossReferencePublication
              await insertChunks(
                transaction,
                'cross_reference_links',
                crossReferenceCanonical.verseAnchors.flatMap(anchor =>
                  anchor.references.map((reference, ordinal) => ({
                    publication_id: publication.id,
                    verse_key: anchor.verseKey,
                    ordinal,
                    reference,
                  }))
                )
              )
            } else if (canonical.format === 'bible-strong-canonical-timeline') {
              const timelineCanonical = canonical as CanonicalTimelinePublication
              await insertChunks(
                transaction,
                'timeline_events',
                timelineCanonical.events.map((event, ordinal) => ({
                  publication_id: publication.id,
                  event_id: event.id,
                  ordinal,
                  slug: event.slug,
                  title: event.title,
                  description: event.description,
                  article: event.article,
                  period: event.period,
                  dates: event.dates,
                  related: sql`${JSON.stringify(event.related)}::jsonb`,
                  images: sql`${JSON.stringify(event.images)}::jsonb`,
                  videos: sql`${JSON.stringify(event.videos)}::jsonb`,
                  scriptures: sql`${JSON.stringify(event.scriptures)}::jsonb`,
                }))
              )
            } else if (canonical.format === 'bible-strong-canonical-strong-index') {
              for (let offset = 0; offset < canonical.verses.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('strong_bible_verses')
                  .values(
                    canonical.verses.slice(offset, offset + 1_000).map(verse => ({
                      publication_id: publication.id,
                      book: verse.book,
                      chapter: verse.chapter,
                      verse: verse.verse,
                    }))
                  )
                  .execute()
              }
              for (let offset = 0; offset < canonical.lexemes.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('strong_bible_lexemes')
                  .values(
                    canonical.lexemes.slice(offset, offset + 1_000).map(lexeme => ({
                      publication_id: publication.id,
                      lexeme_id: lexeme.id,
                      lemma: lexeme.lemma,
                      part_of_speech: lexeme.partOfSpeech,
                    }))
                  )
                  .execute()
              }
              for (let offset = 0; offset < canonical.identities.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('strong_bible_identities')
                  .values(
                    canonical.identities.slice(offset, offset + 1_000).map(identity => ({
                      publication_id: publication.id,
                      identity_id: identity.id,
                      kind: identity.kind,
                      code: identity.code,
                    }))
                  )
                  .execute()
              }
              for (let offset = 0; offset < canonical.spans.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('strong_bible_spans')
                  .values(
                    canonical.spans.slice(offset, offset + 1_000).map(span => ({
                      publication_id: publication.id,
                      book: span.book,
                      chapter: span.chapter,
                      verse: span.verse,
                      ordinal: span.ordinal,
                      start_offset: span.startOffset,
                      length: span.length,
                      is_aligned: span.isAligned,
                      lexeme_id: span.lexemeId ?? null,
                      step_token_ids: sql<number[]>`${JSON.stringify(
                        span.stepTokenIds ?? []
                      )}::jsonb`,
                    }))
                  )
                  .execute()
              }
              for (let offset = 0; offset < canonical.spanIdentities.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('strong_bible_span_identities')
                  .values(
                    canonical.spanIdentities.slice(offset, offset + 1_000).map(spanIdentity => ({
                      publication_id: publication.id,
                      book: spanIdentity.book,
                      chapter: spanIdentity.chapter,
                      verse: spanIdentity.verse,
                      ordinal: spanIdentity.ordinal,
                      identity_order: spanIdentity.identityOrder,
                      identity_id: spanIdentity.identityId,
                    }))
                  )
                  .execute()
              }
            } else if (canonical.format === 'bible-strong-canonical-interlinear-index') {
              for (let offset = 0; offset < canonical.verses.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('interlinear_bible_verses')
                  .values(
                    canonical.verses.slice(offset, offset + 1_000).map(verse => ({
                      publication_id: publication.id,
                      verse_id: verse.id,
                      book: verse.book,
                      chapter: verse.chapter,
                      verse: verse.verse,
                    }))
                  )
                  .execute()
              }
              for (let offset = 0; offset < canonical.tokens.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('interlinear_bible_tokens')
                  .values(
                    canonical.tokens.slice(offset, offset + 1_000).map(token => ({
                      publication_id: publication.id,
                      token_id: token.id,
                      verse_id: token.verseId,
                      ordinal: token.ordinal,
                      start_offset: token.startOffset,
                      length: token.length,
                    }))
                  )
                  .execute()
              }
              for (let offset = 0; offset < canonical.segments.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('interlinear_bible_segments')
                  .values(
                    canonical.segments.slice(offset, offset + 1_000).map(segment => ({
                      publication_id: publication.id,
                      segment_id: segment.id,
                      token_id: segment.tokenId,
                      ordinal: segment.ordinal,
                      start_offset: segment.startOffset,
                      length: segment.length,
                      transliteration: segment.transliteration,
                      lemma: segment.lemma,
                      morphology: segment.morphology,
                      gloss: segment.gloss,
                    }))
                  )
                  .execute()
              }
              for (let offset = 0; offset < canonical.segmentIdentities.length; offset += 1_000) {
                assertNotInterrupted(signal)
                await transaction
                  .insertInto('interlinear_bible_segment_identities')
                  .values(
                    canonical.segmentIdentities.slice(offset, offset + 1_000).map(identity => ({
                      publication_id: publication.id,
                      segment_id: identity.segmentId,
                      identity_order: identity.identityOrder,
                      kind: identity.kind,
                      code: identity.code,
                    }))
                  )
                  .execute()
              }
            } else if (canonical.format === 'bible-strong-canonical-strong-lexicon-module') {
              for (const [tableName, tableRows] of Object.entries(canonical.tables)) {
                const rows = tableRows.map((payload, index) => {
                  const entryIdValue =
                    payload.stepEntryId ??
                    payload.fromStepEntryId ??
                    payload.resourceId ??
                    payload.morphologyCodeId ??
                    payload.entityId ??
                    payload.fromEntityId ??
                    (tableName === 'StepEntries' ||
                    tableName === 'RelationKinds' ||
                    tableName === 'MorphologyCodes' ||
                    tableName === 'Entities'
                      ? payload.id
                      : null)
                  const codeValue =
                    payload.stepCode ?? payload.eStrong ?? payload.uStrong ?? payload.code ?? null
                  const uniqueNameValue = payload.uniqueName ?? payload.toUniqueName ?? null
                  return {
                    publication_id: publication.id,
                    table_name: tableName,
                    record_key: `${index}:${createHash('sha256')
                      .update(JSON.stringify(normalizeJson(payload)))
                      .digest('hex')}`,
                    entry_id:
                      typeof entryIdValue === 'number' && Number.isInteger(entryIdValue)
                        ? entryIdValue
                        : null,
                    language: typeof payload.language === 'string' ? payload.language : null,
                    code: typeof codeValue === 'string' ? codeValue : null,
                    unique_name: typeof uniqueNameValue === 'string' ? uniqueNameValue : null,
                    payload,
                  }
                })
                for (let offset = 0; offset < rows.length; offset += 1_000) {
                  assertNotInterrupted(signal)
                  await transaction
                    .insertInto('strong_lexicon_records')
                    .values(rows.slice(offset, offset + 1_000))
                    .execute()
                }
              }
            }

            if (
              isStrongLexiconPublicationBundleManifest(manifest) &&
              canonical.format === 'bible-strong-canonical-strong-lexicon-module'
            ) {
              await importStrongLexiconDomainProjection(
                transaction,
                publication.id,
                canonical,
                signal
              )
            }

            if (publicationStatus === 'active' && options.beforeActivation) {
              await options.beforeActivation(signal)
            }
            assertNotInterrupted(signal)

            await transaction
              .deleteFrom('resource_publications')
              .where('resource_identity', '=', resourceIdentity)
              .where('id', '!=', publication.id)
              .execute()
            assertNotInterrupted(signal)
            if (publicationStatus === 'active') {
              await transaction
                .updateTable('resource_publications')
                .set({ status: 'active', activated_at: new Date() })
                .where('id', '=', publication.id)
                .executeTakeFirstOrThrow()
            }

            return makeResult(publicationStatus === 'active' ? 'activated' : 'staged')
          }),
        { timeout: '10 minutes' }
      ).pipe(
        Effect.mapError(failure =>
          failure.cause instanceof PublicationImportFailure ? failure.cause : failure
        )
      )
    })
  )
