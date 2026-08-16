import { Data, Effect } from 'effect'
import type { Kysely } from 'kysely'

import { tryDatabasePromise, type DatabaseFailure } from '../database/databaseEffect'
import type { ResourceDatabase } from '../database/types'
import { validatePublicationBundle } from '../publication/publicationBundle'

export class PublicationImportFailure extends Data.TaggedError('PublicationImportFailure')<{
  readonly code: 'VALIDATION_FAILED' | 'REVISION_COLLISION'
  readonly message: string
  readonly cause?: unknown
}> {}

type PublicationImportResult = {
  status: 'activated' | 'staged' | 'unchanged'
  resourceIdentity: string
  revision: string
  verseCount: number
}

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
      const resourceIdentity = `bible-text:${manifest.identity.versionId}`
      const publicationStatus = manifest.deliveryCapabilities.onlineAccess ? 'active' : 'staged'

      return tryDatabasePromise(
        'publication.import',
        signal =>
          database.transaction().execute(async transaction => {
            assertNotInterrupted(signal)
            const existing = await transaction
              .selectFrom('resource_publications')
              .select(['id', 'status', 'canonical_sha256', 'offline_artifact_sha256'])
              .where('resource_identity', '=', resourceIdentity)
              .where('revision', '=', manifest.revision)
              .executeTakeFirst()

            if (existing) {
              if (
                existing.canonical_sha256 !== manifest.canonical.sha256 ||
                existing.offline_artifact_sha256 !== manifest.offlineArtifact.sha256
              ) {
                throw new PublicationImportFailure({
                  code: 'REVISION_COLLISION',
                  message: 'PUBLICATION_REVISION_COLLISION',
                })
              }
              if (existing.status === publicationStatus) {
                return {
                  status: 'unchanged' as const,
                  resourceIdentity,
                  revision: manifest.revision,
                  verseCount: manifest.counts.verses,
                }
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
                resource_kind: 'bible-text',
                revision: manifest.revision,
                language: manifest.identity.language,
                canonical_sha256: manifest.canonical.sha256,
                offline_artifact_sha256: manifest.offlineArtifact.sha256,
                provenance: {
                  source: manifest.provenance.sourceVersion,
                  attribution: manifest.rights.attribution,
                  imported_at: new Date().toISOString(),
                },
                rights: {
                  holder: manifest.rights.holder,
                  terms_reference: manifest.rights.termsReference,
                  online: manifest.rights.online,
                  offline: manifest.rights.offline,
                },
                metadata: {
                  canon: manifest.canon,
                  versification: manifest.versification,
                  coverage: manifest.coverage,
                  delivery_capabilities: manifest.deliveryCapabilities,
                  counts: manifest.counts,
                  canonical_schema_version: manifest.canonical.schemaVersion,
                  offline_entry: manifest.offlineArtifact.entry,
                },
              })
              .returning('id')
              .executeTakeFirstOrThrow()

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

            return {
              status: publicationStatus === 'active' ? ('activated' as const) : ('staged' as const),
              resourceIdentity,
              revision: manifest.revision,
              verseCount: rows.length,
            }
          }),
        { timeout: '2 minutes' }
      ).pipe(
        Effect.mapError(failure =>
          failure.cause instanceof PublicationImportFailure ? failure.cause : failure
        )
      )
    })
  )
