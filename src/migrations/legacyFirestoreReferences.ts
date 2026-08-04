import type { SubcollectionName } from '~helpers/firestoreSubcollections'

import { MigrationExecutionError } from './appMigrationOrchestrator'
import type { FirestoreLegacyReferenceTarget } from './accountMigrationRegistry'
import { migrateLegacyPersistedValue } from './legacyPersistedReferences'

export interface LegacyFirestoreReferencesPersistence {
  readUserSettings(userId: string): Promise<unknown>
  writeUserSettings(userId: string, settings: unknown): Promise<void>
  readSubcollection(userId: string, collection: SubcollectionName): Promise<Record<string, unknown>>
  writeSubcollection(
    userId: string,
    collection: SubcollectionName,
    documents: Record<string, unknown>
  ): Promise<void>
}

const serialize = (value: unknown): string => JSON.stringify(value)

const migrateIfNeeded = (value: unknown): { changed: boolean; value: unknown } => {
  const migrated = migrateLegacyPersistedValue(value)
  return {
    changed: serialize(migrated) !== serialize(value),
    value: migrated,
  }
}

const migrateDocuments = (
  documents: Record<string, unknown>
): { changed: boolean; documents: Record<string, unknown> } => {
  let changed = false
  const migratedDocuments: Record<string, unknown> = {}

  for (const [documentId, document] of Object.entries(documents)) {
    const migrated = migrateIfNeeded(document)
    if (migrated.changed) {
      changed = true
      migratedDocuments[documentId] = migrated.value
    }
  }

  return { changed, documents: migratedDocuments }
}

const toSubcollectionName = (
  target: FirestoreLegacyReferenceTarget,
  collections: readonly SubcollectionName[]
): SubcollectionName => {
  const collection = target.startsWith('subcollection:')
    ? target.slice('subcollection:'.length)
    : ''
  if (!collections.includes(collection as SubcollectionName)) {
    throw new MigrationExecutionError('FIRESTORE_LEGACY_REFERENCE_TARGET_INVALID')
  }
  return collection as SubcollectionName
}

export const createLegacyFirestoreReferencesAdapter = (
  persistence: LegacyFirestoreReferencesPersistence,
  collections: readonly SubcollectionName[]
) => ({
  async inspectTargets(userId: string): Promise<FirestoreLegacyReferenceTarget[]> {
    const [settings, ...subcollections] = await Promise.all([
      persistence.readUserSettings(userId),
      ...collections.map(collection => persistence.readSubcollection(userId, collection)),
    ])
    const targets: FirestoreLegacyReferenceTarget[] = []
    if (migrateIfNeeded(settings).changed) targets.push('user-settings')

    collections.forEach((collection, index) => {
      const documents = subcollections[index]
      if (migrateDocuments(documents).changed) {
        targets.push(`subcollection:${collection}` as FirestoreLegacyReferenceTarget)
      }
    })

    return targets
  },

  async migrateTarget(
    userId: string,
    target: FirestoreLegacyReferenceTarget,
    reportProgress: (progress: number) => void
  ): Promise<void> {
    reportProgress(0)
    if (target === 'user-settings') {
      const settings = await persistence.readUserSettings(userId)
      const migrated = migrateIfNeeded(settings)
      if (migrated.changed) await persistence.writeUserSettings(userId, migrated.value)
      reportProgress(1)
      return
    }

    const collection = toSubcollectionName(target, collections)
    const documents = await persistence.readSubcollection(userId, collection)
    const migrated = migrateDocuments(documents)
    if (migrated.changed) {
      await persistence.writeSubcollection(userId, collection, migrated.documents)
    }
    reportProgress(1)
  },
})
