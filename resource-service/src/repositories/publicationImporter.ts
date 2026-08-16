import { createHash } from 'node:crypto'

import { Data, Effect } from 'effect'
import type { Kysely } from 'kysely'

import { tryDatabasePromise, type DatabaseFailure } from '../database/databaseEffect'
import type { ResourceDatabase } from '../database/types'
import {
  isBiblePublicationBundleManifest,
  validatePublicationBundle,
} from '../publication/publicationBundle'

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
      const { canonical, manifest } = validated
      const resourceIdentity = isBiblePublicationBundleManifest(manifest)
        ? `bible-text:${manifest.identity.versionId}`
        : `nave:${manifest.identity.language}`
      const publicationStatus = manifest.deliveryCapabilities.onlineAccess ? 'active' : 'staged'
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
      }
      const metadata = isBiblePublicationBundleManifest(manifest)
        ? {
            canon: manifest.canon,
            versification: manifest.versification,
            coverage: manifest.coverage,
            delivery_capabilities: manifest.deliveryCapabilities,
            counts: manifest.counts,
            canonical_schema_version: manifest.canonical.schemaVersion,
            offline_entry: manifest.offlineArtifact.entry,
          }
        : {
            resource_id: manifest.identity.resourceId,
            alphabetical_browse: manifest.alphabeticalBrowse,
            delivery_capabilities: manifest.deliveryCapabilities,
            counts: manifest.counts,
            canonical_schema_version: manifest.canonical.schemaVersion,
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
          : {
              status,
              resourceIdentity,
              revision: manifest.revision,
              itemCount: manifest.counts.topics,
            }

      return tryDatabasePromise(
        'publication.import',
        signal =>
          database.transaction().execute(async transaction => {
            assertNotInterrupted(signal)
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
              .where('revision', '=', manifest.revision)
              .executeTakeFirst()

            if (existing) {
              const { manifest_sha256: storedManifestSha256, ...storedMetadata } = existing.metadata
              if (
                existing.canonical_sha256 !== manifest.canonical.sha256 ||
                existing.offline_artifact_sha256 !== manifest.offlineArtifact.sha256 ||
                (storedManifestSha256 !== undefined && storedManifestSha256 !== manifestSha256) ||
                !jsonEquals(storedMetadata, metadata) ||
                !jsonEquals(existing.rights, rights) ||
                existing.provenance.source !== provenance.source ||
                existing.provenance.attribution !== provenance.attribution
              ) {
                throw new PublicationImportFailure({
                  code: 'REVISION_COLLISION',
                  message: 'PUBLICATION_REVISION_COLLISION',
                })
              }
              if (storedManifestSha256 === undefined) {
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
                revision: manifest.revision,
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
            } else {
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
        { timeout: '2 minutes' }
      ).pipe(
        Effect.mapError(failure =>
          failure.cause instanceof PublicationImportFailure ? failure.cause : failure
        )
      )
    })
  )
