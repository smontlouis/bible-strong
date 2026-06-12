import * as Sentry from '@sentry/react-native'
import { firebaseDb, doc, getDoc, updateDoc, deleteField } from './firebase'
import { autoBackupManager } from './AutoBackupManager'
import {
  SUBCOLLECTION_NAMES,
  SubcollectionName,
  fetchSubcollection,
  writeAllToSubcollection,
  clearSubcollection,
  getInvalidSubcollectionDocumentIds,
  type ChunkProgressCallback,
  type SubcollectionData,
} from './firestoreSubcollections'
import { RootState } from '~redux/modules/reducer'
import type { MigrationState } from './migrationState'
import {
  createInitialMigrationState,
  setMigrationState,
  updateCollectionStatus,
  clearMigrationState,
  getCollectionsToMigrate,
} from './migrationState'
import {
  setMigrationProgressFromOutsideReact,
  resetMigrationProgressFromOutsideReact,
} from 'src/state/migration'
import {
  mergeRelationsWithSystemBackfill,
  normalizeRelation,
  dedupeRelationsByDuplicateKey,
  rebuildRelationIndexes,
  rebuildRelationPairs,
  type LegacyRelation,
  type RelationsObj,
} from '~features/studyRelations/domain'

// Batch chunk size (must match firestoreSubcollections.ts)
const BATCH_CHUNK_SIZE = 400
const RELATIONS_CLEANUP_VERSION = 1
type EmbeddedBibleData = Partial<Record<SubcollectionName, SubcollectionData>>
type ImportedBibleData = Partial<Record<SubcollectionName, Record<string, unknown>>>

const getErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? fallback)
  }
  return fallback
}

const normalizeRelationsData = (bible: EmbeddedBibleData | ImportedBibleData): RelationsObj => {
  const existingRelations = (bible.relations ?? {}) as Record<string, LegacyRelation>

  const normalizedRelations = Object.values(existingRelations).reduce((relations, relation) => {
    try {
      const normalized = normalizeRelation(relation)
      relations[normalized.id] = normalized
    } catch (error) {
      console.warn('[FirestoreMigration] Skipping invalid relation during normalization', {
        relationId: relation?.id,
        error,
      })
    }
    return relations
  }, {} as RelationsObj)

  return dedupeRelationsByDuplicateKey(
    mergeRelationsWithSystemBackfill({
      relations: normalizedRelations,
      notes: bible.notes as RootState['user']['bible']['notes'] | undefined,
      links: bible.links as RootState['user']['bible']['links'] | undefined,
      wordAnnotations: bible.wordAnnotations as
        | RootState['user']['bible']['wordAnnotations']
        | undefined,
    })
  )
}

const getCollectionDataForMigration = (
  bible: EmbeddedBibleData | ImportedBibleData,
  collection: SubcollectionName
): SubcollectionData => {
  if (collection === 'relations') return normalizeRelationsData(bible)
  if (collection === 'relationIndex') return rebuildRelationIndexes(normalizeRelationsData(bible))
  if (collection === 'relationPairs') return rebuildRelationPairs(normalizeRelationsData(bible))
  return (bible[collection] ?? {}) as SubcollectionData
}

/**
 * Mapping des noms de collections vers des labels lisibles en français
 */
const COLLECTION_LABELS: Record<SubcollectionName, string> = {
  bookmarks: 'marque-pages',
  highlights: 'surlignages',
  notes: 'notes',
  links: 'liens',
  relations: 'relations',
  relationIndex: 'index des relations',
  relationPairs: 'paires de relations',
  tags: 'tags',
  strongsHebreu: 'Strong hébreu',
  strongsGrec: 'Strong grec',
  words: 'mots',
  naves: 'thèmes Nave',
  tabGroups: 'onglets',
  wordAnnotations: 'annotations de mots',
}

/**
 * Retourne le label lisible pour une collection
 */
export const getCollectionLabel = (collection: SubcollectionName): string => {
  return COLLECTION_LABELS[collection] || collection
}

/**
 * Progress update sent to the UI during migration
 */
export interface MigrationProgressUpdate {
  currentCollection: SubcollectionName | null
  collectionsCompleted: number
  totalCollections: number
  overallProgress: number
  message: string
}

/**
 * Result of a resumable migration
 */
export interface MigrationResult {
  success: boolean
  partialFailure: boolean
  failedCollections: SubcollectionName[]
  error?: string
}

/**
 * Vérifie si un utilisateur a déjà été migré vers les sous-collections
 */
export async function isUserMigrated(userId: string): Promise<boolean> {
  try {
    const userDocRef = doc(firebaseDb, 'users', userId)
    const userDocSnap = await getDoc(userDocRef)
    const userData = userDocSnap.data()
    return userData?._migrated === true
  } catch (error) {
    console.error('[FirestoreMigration] Failed to check migration status:', error)
    Sentry.captureException(error, {
      tags: {
        feature: 'firestore_migration',
        action: 'check_migration_status',
      },
      extra: {
        userId,
        errorMessage: getErrorMessage(error),
      },
    })
    return false
  }
}

export async function isUserRelationsMigrated(userId: string): Promise<boolean> {
  try {
    const userDocRef = doc(firebaseDb, 'users', userId)
    const userDocSnap = await getDoc(userDocRef)
    const userData = userDocSnap.data()
    return userData?._relationsMigrated === true
  } catch (error) {
    console.error('[FirestoreMigration] Failed to check relations migration status:', error)
    Sentry.captureException(error, {
      tags: {
        feature: 'firestore_migration',
        action: 'check_relations_migration_status',
      },
      extra: {
        userId,
        errorMessage: getErrorMessage(error),
      },
    })
    return false
  }
}

async function isRelationsCleanupCurrent(userId: string): Promise<boolean> {
  try {
    const userDocRef = doc(firebaseDb, 'users', userId)
    const userDocSnap = await getDoc(userDocRef)
    const userData = userDocSnap.data()
    return Number(userData?._relationsCleanupVersion || 0) >= RELATIONS_CLEANUP_VERSION
  } catch (error) {
    console.error('[FirestoreMigration] Failed to check relations cleanup status:', error)
    Sentry.captureException(error, {
      tags: {
        feature: 'firestore_migration',
        action: 'check_relations_cleanup_status',
      },
      extra: {
        userId,
        errorMessage: getErrorMessage(error),
      },
    })
    return false
  }
}

async function markRelationsAsMigrated(userId: string): Promise<void> {
  const userDocRef = doc(firebaseDb, 'users', userId)
  await updateDoc(userDocRef, {
    _relationsMigrated: true,
    _relationsCleanupVersion: RELATIONS_CLEANUP_VERSION,
  })
}

async function markRelationsCleanupComplete(userId: string): Promise<void> {
  const userDocRef = doc(firebaseDb, 'users', userId)
  await updateDoc(userDocRef, {
    _relationsCleanupVersion: RELATIONS_CLEANUP_VERSION,
  })
}

const hasDuplicateRelationKeys = (relations: RelationsObj): boolean => {
  const duplicateKeys = new Set<string>()
  for (const relation of Object.values(relations)) {
    const duplicateKey = normalizeRelation(relation).duplicateKey
    if (duplicateKeys.has(duplicateKey)) return true
    duplicateKeys.add(duplicateKey)
  }
  return false
}

const haveSameKeys = (
  left: Record<string, unknown> = {},
  right: Record<string, unknown> = {}
): boolean => {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false

  return leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key))
}

async function cleanupDuplicateRelations(userId: string): Promise<void> {
  const [relations, relationIndex, relationPairs, notes, links, wordAnnotations] =
    await Promise.all([
      fetchSubcollection(userId, 'relations'),
      fetchSubcollection(userId, 'relationIndex'),
      fetchSubcollection(userId, 'relationPairs'),
      fetchSubcollection(userId, 'notes'),
      fetchSubcollection(userId, 'links'),
      fetchSubcollection(userId, 'wordAnnotations'),
    ])
  const normalizedRelations = normalizeRelationsData({
    relations: relations as Record<string, LegacyRelation>,
    notes,
    links,
    wordAnnotations,
  })
  const rebuiltRelationIndex = rebuildRelationIndexes(normalizedRelations)
  const rebuiltRelationPairs = rebuildRelationPairs(normalizedRelations)

  if (
    !hasDuplicateRelationKeys(relations as RelationsObj) &&
    haveSameKeys(relations, normalizedRelations) &&
    haveSameKeys(relationIndex, rebuiltRelationIndex) &&
    haveSameKeys(relationPairs, rebuiltRelationPairs)
  ) {
    return
  }

  await clearSubcollection(userId, 'relations')
  await clearSubcollection(userId, 'relationIndex')
  await clearSubcollection(userId, 'relationPairs')
  await writeAllToSubcollection(userId, 'relations', normalizedRelations)
  await writeAllToSubcollection(userId, 'relationIndex', rebuiltRelationIndex)
  await writeAllToSubcollection(userId, 'relationPairs', rebuiltRelationPairs)
}

export async function migrateUserRelationsArchitecture(
  userId: string,
  state: RootState,
  onProgress?: (message: string, progress: number) => void
): Promise<{ success: boolean; error?: string }> {
  const reportProgress = (message: string, progress: number) => {
    console.log(`[RelationsMigration] ${message} (${Math.round(progress * 100)}%)`)
    onProgress?.(message, progress)
  }

  try {
    reportProgress('Vérification des relations...', 0)
    const alreadyMigrated = await isUserRelationsMigrated(userId)
    if (alreadyMigrated) {
      const cleanupCurrent = await isRelationsCleanupCurrent(userId)
      if (!cleanupCurrent) {
        await cleanupDuplicateRelations(userId)
        await markRelationsCleanupComplete(userId)
      }
      return { success: true }
    }

    reportProgress('Création du backup de sécurité...', 0.1)
    await autoBackupManager.createBackupNow(state, 'pre_migration')

    reportProgress('Lecture des notes et liens...', 0.3)
    const [notes, links, wordAnnotations, existingRelations] = await Promise.all([
      fetchSubcollection(userId, 'notes'),
      fetchSubcollection(userId, 'links'),
      fetchSubcollection(userId, 'wordAnnotations'),
      fetchSubcollection(userId, 'relations'),
    ])

    const relations = normalizeRelationsData({
      notes,
      links,
      wordAnnotations,
      relations: existingRelations,
    })
    const relationIndex = rebuildRelationIndexes(relations)
    const relationPairs = rebuildRelationPairs(relations)

    reportProgress('Écriture des relations...', 0.6)
    await clearSubcollection(userId, 'relations')
    await clearSubcollection(userId, 'relationIndex')
    await clearSubcollection(userId, 'relationPairs')
    await writeAllToSubcollection(userId, 'relations', relations)
    await writeAllToSubcollection(userId, 'relationIndex', relationIndex)
    await writeAllToSubcollection(userId, 'relationPairs', relationPairs)

    reportProgress('Finalisation des relations...', 0.9)
    await markRelationsAsMigrated(userId)

    reportProgress('Migration des relations terminée!', 1)
    return { success: true }
  } catch (error) {
    console.error('[RelationsMigration] Migration failed:', error)
    Sentry.captureException(error, {
      tags: { feature: 'firestore_migration', action: 'relations_architecture_migration' },
      extra: { userId, errorMessage: getErrorMessage(error) },
    })
    return {
      success: false,
      error: getErrorMessage(error, 'Unknown error during relations migration'),
    }
  }
}

/**
 * Vérifie si l'utilisateur a des données embedded dans bible.* qui doivent être migrées
 * Ceci est important pour la migration incrémentale: même si _migrated est true,
 * une ancienne application sur un autre appareil peut avoir continué à synchroniser
 * des données vers le document principal (bible.highlights, bible.notes, etc.)
 */
export async function checkForEmbeddedData(userId: string): Promise<{
  hasEmbeddedData: boolean
  collectionsWithData: SubcollectionName[]
}> {
  try {
    const userDocRef = doc(firebaseDb, 'users', userId)
    const userDocSnap = await getDoc(userDocRef)
    const userData = userDocSnap.data()

    if (!userData?.bible) {
      return { hasEmbeddedData: false, collectionsWithData: [] }
    }

    const bible = userData.bible as EmbeddedBibleData
    const collectionsWithData: SubcollectionName[] = []

    for (const collection of SUBCOLLECTION_NAMES) {
      if (Object.keys(getCollectionDataForMigration(bible, collection)).length > 0) {
        collectionsWithData.push(collection)
      }
    }

    return {
      hasEmbeddedData: collectionsWithData.length > 0,
      collectionsWithData,
    }
  } catch (error) {
    console.error('[FirestoreMigration] Failed to check for embedded data:', error)
    Sentry.captureException(error, {
      tags: {
        feature: 'firestore_migration',
        action: 'check_embedded_data',
      },
      extra: {
        userId,
        errorMessage: getErrorMessage(error),
      },
    })
    return { hasEmbeddedData: false, collectionsWithData: [] }
  }
}

/**
 * Marque un utilisateur comme migré
 */
async function markAsMigrated(userId: string): Promise<void> {
  try {
    const userDocRef = doc(firebaseDb, 'users', userId)
    await updateDoc(userDocRef, {
      _migrated: true,
    })
  } catch (error) {
    console.error('[FirestoreMigration] Failed to mark user as migrated:', error)
    Sentry.captureException(error, {
      tags: {
        feature: 'firestore_migration',
        action: 'mark_as_migrated',
      },
      extra: {
        userId,
        errorMessage: getErrorMessage(error),
      },
    })
    throw error // Re-throw to let caller handle it
  }
}

/**
 * Supprime les données embedded du document principal après migration
 */
async function removeEmbeddedData(userId: string): Promise<void> {
  try {
    const updates: Record<string, unknown> = {}

    for (const collectionName of SUBCOLLECTION_NAMES) {
      updates[`bible.${collectionName}`] = deleteField()
    }

    const userDocRef = doc(firebaseDb, 'users', userId)
    await updateDoc(userDocRef, updates)
    console.log('[FirestoreMigration] Embedded data removed from user document')
  } catch (error) {
    console.error('[FirestoreMigration] Failed to remove embedded data:', error)
    Sentry.captureException(error, {
      tags: {
        feature: 'firestore_migration',
        action: 'remove_embedded_data',
      },
      extra: {
        userId,
        errorMessage: getErrorMessage(error),
      },
    })
    throw error // Re-throw to let caller handle it
  }
}

/**
 * Migre des données importées vers les sous-collections
 * Utilisé lors de la restauration de backups ou import de fichiers
 *
 * Cette fonction:
 * 1. EFFACE les sous-collections existantes
 * 2. Écrit les nouvelles données du backup
 * 3. Affiche le modal de migration pour montrer la progression
 *
 * @param userId - L'ID Firebase de l'utilisateur
 * @param data - Les données à migrer (format embedded)
 */
export async function migrateImportedDataToSubcollections(
  userId: string,
  data: ImportedBibleData
): Promise<void> {
  console.log('[FirestoreMigration] ========================================')
  console.log('[FirestoreMigration] Starting imported data migration')
  console.log('[FirestoreMigration] User ID:', userId)

  // Log data counts for debugging
  console.log('[FirestoreMigration] Data counts to import:')
  for (const collection of SUBCOLLECTION_NAMES) {
    const count = Object.keys(getCollectionDataForMigration(data, collection)).length
    console.log(`[FirestoreMigration]   - ${collection}: ${count} items`)
  }

  // Determine which collections have data to migrate
  const collectionDataByName = SUBCOLLECTION_NAMES.reduce(
    (result, collection) => {
      result[collection] = getCollectionDataForMigration(data, collection)
      return result
    },
    {} as Record<SubcollectionName, SubcollectionData>
  )
  const collectionsToWrite = SUBCOLLECTION_NAMES.filter(
    name => Object.keys(collectionDataByName[name]).length > 0
  )
  const invalidDocumentIds = SUBCOLLECTION_NAMES.flatMap(collection => {
    const invalidIds = getInvalidSubcollectionDocumentIds(
      Object.keys(collectionDataByName[collection])
    )
    return invalidIds.map(invalid => ({ collection, ...invalid }))
  })

  if (invalidDocumentIds.length > 0) {
    console.warn(
      '[FirestoreMigration] Imported data contains invalid document IDs:',
      invalidDocumentIds
    )
    throw new Error(
      `Invalid document IDs in imported data: ${invalidDocumentIds
        .map(item => `${item.collection}/${item.docId}`)
        .join(', ')}`
    )
  }

  if (collectionsToWrite.length === 0) {
    console.log(
      '[FirestoreMigration] WARNING: No subcollection data to write - clearing existing data'
    )
  }

  console.log('[FirestoreMigration] Collections to write:', collectionsToWrite.join(', '))

  // Show migration modal and set isMigrating flag to prevent listener race conditions
  setMigrationProgressFromOutsideReact({
    isActive: true,
    isResuming: false,
    isMigrating: true,
    currentCollection: null,
    collectionsCompleted: 0,
    totalCollections: SUBCOLLECTION_NAMES.length,
    overallProgress: 0,
    message: 'Démarrage de la restauration...',
    error: null,
    hasPartialFailure: false,
    failedCollections: [],
  })

  try {
    const totalCollections = SUBCOLLECTION_NAMES.length

    // Process each collection: clear existing data, then write imported data if present.
    for (let i = 0; i < totalCollections; i++) {
      const collection = SUBCOLLECTION_NAMES[i]
      const collectionData = collectionDataByName[collection]
      const itemCount = Object.keys(collectionData).length

      // Base progress for this collection (0 to 1 range for each collection)
      const collectionProgress = 1 / totalCollections
      const baseProgress = i * collectionProgress

      // STEP 1: Clear existing subcollection (first half of collection progress)
      setMigrationProgressFromOutsideReact({
        currentCollection: collection,
        collectionsCompleted: i,
        overallProgress: baseProgress,
        message: `Remplacement de ${collection}...`,
      })

      console.log(`[FirestoreMigration] STEP 1: Clearing existing ${collection} subcollection...`)
      await clearSubcollection(userId, collection, (chunkIndex, totalChunks) => {
        // Progress during clear: baseProgress + (chunk progress * half of collection progress)
        const clearProgress = baseProgress + (chunkIndex / totalChunks) * (collectionProgress / 2)
        setMigrationProgressFromOutsideReact({
          overallProgress: clearProgress,
          message: `Remplacement de ${collection}...`,
        })
      })
      console.log(`[FirestoreMigration] ${collection} cleared successfully`)

      // STEP 2: Write new data (second half of collection progress)
      const writeBaseProgress = baseProgress + collectionProgress / 2

      if (itemCount > 0) {
        setMigrationProgressFromOutsideReact({
          currentCollection: collection,
          collectionsCompleted: i,
          overallProgress: writeBaseProgress,
          message: `Remplacement de ${collection} (${itemCount} éléments)...`,
        })

        console.log(`[FirestoreMigration] STEP 2: Writing ${itemCount} items to ${collection}...`)
        await writeAllToSubcollection(
          userId,
          collection,
          collectionData,
          (chunkIndex, totalChunks) => {
            // Progress during write: writeBaseProgress + (chunk progress * half of collection progress)
            const writeProgress =
              writeBaseProgress + (chunkIndex / totalChunks) * (collectionProgress / 2)
            setMigrationProgressFromOutsideReact({
              overallProgress: writeProgress,
              message: `Remplacement de ${collection} (${itemCount} éléments)...`,
            })
          }
        )
        console.log(`[FirestoreMigration] ${collection} written successfully`)
      } else {
        setMigrationProgressFromOutsideReact({
          currentCollection: collection,
          collectionsCompleted: i,
          overallProgress: writeBaseProgress + collectionProgress / 2,
          message: `${collection} remplacé`,
        })
        console.log(`[FirestoreMigration] STEP 2: No data to write to ${collection}`)
      }
    }

    // Mark user as migrated
    console.log('[FirestoreMigration] Marking user as migrated...')
    await markAsMigrated(userId)

    // Show success and allow listener updates again
    setMigrationProgressFromOutsideReact({
      collectionsCompleted: SUBCOLLECTION_NAMES.length,
      overallProgress: 1,
      message: 'Restauration terminée avec succès!',
      isMigrating: false,
    })

    console.log('[FirestoreMigration] ========================================')
    console.log('[FirestoreMigration] Imported data migration COMPLETED SUCCESSFULLY')
    console.log('[FirestoreMigration] ========================================')

    // Small delay before hiding modal
    await new Promise(resolve => setTimeout(resolve, 1500))
  } catch (error) {
    console.error('[FirestoreMigration] ========================================')
    console.error('[FirestoreMigration] FAILED to migrate imported data:', error)
    console.error('[FirestoreMigration] ========================================')
    Sentry.captureException(error, {
      tags: { feature: 'migration', action: 'migrate_imported_data' },
      extra: { userId },
    })
    throw error
  } finally {
    // Always hide the modal when done
    resetMigrationProgressFromOutsideReact()
  }
}

/**
 * Compte le nombre total d'éléments à migrer pour estimation
 */
export function countItemsToMigrate(bible: EmbeddedBibleData): number {
  let count = 0
  for (const collection of SUBCOLLECTION_NAMES) {
    count += Object.keys(getCollectionDataForMigration(bible, collection)).length
  }
  return count
}

/**
 * Migre les données utilisateur vers les sous-collections Firestore avec support de reprise
 *
 * Cette fonction:
 * 1. Vérifie l'état de migration existant (pour reprise)
 * 2. Crée un backup avant migration (sécurité)
 * 3. Migre chaque collection individuellement avec gestion d'erreur
 * 4. Persiste l'état après chaque collection pour permettre la reprise
 * 5. Continue même si certaines collections échouent (migration partielle)
 *
 * @param userId - L'ID Firebase de l'utilisateur
 * @param state - L'état Redux actuel (pour le backup)
 * @param existingMigrationState - L'état de migration existant (pour reprise)
 * @param onProgress - Callback pour le suivi de progression
 */
export async function resumableMigrateUserData(
  userId: string,
  state: RootState,
  existingMigrationState: MigrationState | null,
  onProgress: (progress: MigrationProgressUpdate) => void
): Promise<MigrationResult> {
  const failedCollections: SubcollectionName[] = []
  let completedCollections: SubcollectionName[] = []

  const reportProgress = (update: Partial<MigrationProgressUpdate>) => {
    const progress: MigrationProgressUpdate = {
      currentCollection: update.currentCollection ?? null,
      collectionsCompleted: update.collectionsCompleted ?? completedCollections.length,
      totalCollections: SUBCOLLECTION_NAMES.length,
      overallProgress:
        update.overallProgress ?? completedCollections.length / SUBCOLLECTION_NAMES.length,
      message: update.message ?? '',
    }
    console.log(
      `[FirestoreMigration] ${progress.message} (${Math.round(progress.overallProgress * 100)}%)`
    )
    onProgress(progress)
  }

  try {
    // 1. Vérifier si des données embedded existent (IMPORTANT pour migration incrémentale)
    // Même si _migrated est true, une ancienne app peut avoir continué à synchroniser
    reportProgress({ message: 'Vérification des données...', overallProgress: 0 })
    const { hasEmbeddedData, collectionsWithData } = await checkForEmbeddedData(userId)

    if (!hasEmbeddedData) {
      // Pas de données embedded - s'assurer que _migrated est défini
      console.log('[FirestoreMigration] No embedded data found')
      const alreadyMigrated = await isUserMigrated(userId)
      if (!alreadyMigrated) {
        console.log('[FirestoreMigration] Marking user as migrated (no data to migrate)')
        await markAsMigrated(userId)
      }
      clearMigrationState()
      return { success: true, partialFailure: false, failedCollections: [] }
    }

    // Des données embedded existent - procéder à la migration
    console.log(`[FirestoreMigration] Found embedded data in: ${collectionsWithData.join(', ')}`)

    // 2. Initialiser ou reprendre l'état de migration
    let migrationState: MigrationState
    if (existingMigrationState && existingMigrationState.userId === userId) {
      console.log('[FirestoreMigration] Resuming existing migration')
      migrationState = existingMigrationState
      // Récupérer les collections déjà complétées
      completedCollections = SUBCOLLECTION_NAMES.filter(
        name => migrationState.collections[name].status === 'completed'
      )
    } else {
      console.log('[FirestoreMigration] Starting new migration')
      migrationState = createInitialMigrationState(userId)
      setMigrationState(migrationState)
    }

    // 3. Créer un backup avant migration (seulement si nouvelle migration)
    if (!existingMigrationState) {
      reportProgress({ message: 'Création du backup de sécurité...', overallProgress: 0.05 })
      const backupCreated = await autoBackupManager.createBackupNow(state, 'pre_migration')
      if (!backupCreated) {
        console.warn('[FirestoreMigration] Backup creation failed, but continuing with migration')
      }
    }

    // 4. Lire les données embedded du document user
    reportProgress({ message: 'Lecture des données existantes...', overallProgress: 0.1 })
    const userDocRef = doc(firebaseDb, 'users', userId)
    const userDocSnap = await getDoc(userDocRef)
    const userData = userDocSnap.data()

    if (!userData?.bible) {
      console.log('[FirestoreMigration] No bible data found, marking as migrated')
      await markAsMigrated(userId)
      clearMigrationState()
      return { success: true, partialFailure: false, failedCollections: [] }
    }

    const bible = userData.bible as EmbeddedBibleData

    // 5. Déterminer les collections à migrer
    const collectionsToMigrate = getCollectionsToMigrate(migrationState).filter(
      name => Object.keys(getCollectionDataForMigration(bible, name)).length > 0
    )

    // Ajouter les collections vides comme complétées
    const emptyCollections = SUBCOLLECTION_NAMES.filter(
      name => Object.keys(getCollectionDataForMigration(bible, name)).length === 0
    )
    for (const emptyCollection of emptyCollections) {
      if (migrationState.collections[emptyCollection].status !== 'completed') {
        updateCollectionStatus(emptyCollection, 'completed', 0)
        completedCollections.push(emptyCollection)
      }
    }

    if (collectionsToMigrate.length === 0) {
      console.log('[FirestoreMigration] No data to migrate, marking as migrated')
      await markAsMigrated(userId)
      clearMigrationState()
      return { success: true, partialFailure: false, failedCollections: [] }
    }

    console.log(`[FirestoreMigration] Collections to migrate: ${collectionsToMigrate.join(', ')}`)

    // 6. Calculer le nombre total de chunks pour une progression précise
    const collectionChunks: {
      collection: SubcollectionName
      itemCount: number
      chunkCount: number
    }[] = []
    let totalChunks = 0

    for (const collection of collectionsToMigrate) {
      const data = getCollectionDataForMigration(bible, collection)
      const itemCount = Object.keys(data).length
      const chunkCount = Math.ceil(itemCount / BATCH_CHUNK_SIZE)
      collectionChunks.push({ collection, itemCount, chunkCount })
      totalChunks += chunkCount
    }

    console.log(`[FirestoreMigration] Total chunks to process: ${totalChunks}`)

    let completedChunks = 0

    // 7. Migrer chaque collection individuellement
    for (const { collection, itemCount, chunkCount } of collectionChunks) {
      const data = getCollectionDataForMigration(bible, collection)
      const label = getCollectionLabel(collection)

      // Calculer la progression basée sur les chunks
      const baseProgress = 0.1 + (0.75 * completedChunks) / totalChunks

      reportProgress({
        currentCollection: collection,
        message: `Migration des ${label} (${itemCount} éléments, ${chunkCount} chunk${chunkCount > 1 ? 's' : ''})...`,
        overallProgress: baseProgress,
      })

      // Marquer comme en cours
      updateCollectionStatus(collection, 'in_progress', itemCount)

      try {
        // Callback pour mettre à jour la progression à chaque chunk
        const onChunkProgress: ChunkProgressCallback = (chunkIndex, _totalChunks) => {
          const currentProgress = 0.1 + (0.75 * (completedChunks + chunkIndex)) / totalChunks
          reportProgress({
            currentCollection: collection,
            message: `Migration des ${label} (chunk ${chunkIndex}/${_totalChunks})...`,
            overallProgress: currentProgress,
          })
        }

        await writeAllToSubcollection(userId, collection, data, onChunkProgress)

        // Mettre à jour les chunks complétés
        completedChunks += chunkCount

        // Marquer comme complété
        updateCollectionStatus(collection, 'completed', itemCount)
        completedCollections.push(collection)

        const endProgress = 0.1 + (0.75 * completedChunks) / totalChunks
        reportProgress({
          currentCollection: collection,
          collectionsCompleted: completedCollections.length,
          message: `${label} migrés avec succès`,
          overallProgress: endProgress,
        })
      } catch (error) {
        const errorMessage = getErrorMessage(error)
        console.error(`[FirestoreMigration] Failed to migrate ${collection}:`, error)

        // Capturer l'erreur dans Sentry avec contexte détaillé
        Sentry.captureException(error, {
          tags: {
            feature: 'firestore_migration',
            collection,
            action: 'migrate_collection',
          },
          extra: {
            userId,
            collectionName: collection,
            itemCount,
            completedCollections: completedCollections.join(', '),
            failedCollections: failedCollections.join(', '),
            errorMessage,
          },
        })

        // Marquer comme échoué et continuer
        updateCollectionStatus(collection, 'failed', itemCount, errorMessage)
        failedCollections.push(collection)

        // Continuer avec la prochaine collection
      }
    }

    // 8. Vérifier si toutes les collections ont été migrées
    const allCompleted = failedCollections.length === 0
    const hasPartialFailure = failedCollections.length > 0 && completedCollections.length > 0

    if (allCompleted) {
      // 9. FIRST: Supprimer les données embedded (libérer de l'espace pour les documents proches de 1MB)
      reportProgress({ message: 'Nettoyage des anciennes données...', overallProgress: 0.88 })
      await removeEmbeddedData(userId)

      // 10. THEN: Marquer comme migré sur Firestore (maintenant il y a de la place)
      reportProgress({ message: 'Finalisation de la migration...', overallProgress: 0.95 })
      await markAsMigrated(userId)

      // 11. Nettoyer l'état de migration local
      clearMigrationState()

      reportProgress({ message: 'Migration terminée avec succès!', overallProgress: 1 })
      console.log('[FirestoreMigration] Migration completed successfully')

      return { success: true, partialFailure: false, failedCollections: [] }
    } else {
      // Migration partielle - ne pas marquer comme migré
      const errorMessage = `Migration partielle: ${failedCollections.length} collection(s) échouée(s)`
      console.error(`[FirestoreMigration] ${errorMessage}:`, failedCollections)

      // Capturer la migration partielle dans Sentry
      Sentry.captureMessage(errorMessage, {
        level: 'error',
        tags: {
          feature: 'firestore_migration',
          action: 'partial_failure',
        },
        extra: {
          userId,
          failedCollections: failedCollections.join(', '),
          completedCollections: completedCollections.join(', '),
        },
      })

      return {
        success: false,
        partialFailure: hasPartialFailure,
        failedCollections,
        error: errorMessage,
      }
    }
  } catch (error) {
    console.error('[FirestoreMigration] Migration failed with unexpected error:', error)

    Sentry.captureException(error, {
      tags: {
        feature: 'firestore_migration',
        action: 'unexpected_error',
      },
      extra: {
        userId,
        completedCollections: completedCollections.join(', '),
        failedCollections: failedCollections.join(', '),
      },
    })

    return {
      success: false,
      partialFailure: completedCollections.length > 0,
      failedCollections,
      error: getErrorMessage(error, 'Erreur inattendue lors de la migration'),
    }
  }
}
