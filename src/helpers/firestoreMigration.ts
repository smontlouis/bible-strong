import * as Sentry from '@sentry/react-native'
import { firebaseDb, doc, getDoc, updateDoc, deleteField } from './firebase'
import { autoBackupManager } from './AutoBackupManager'
import {
  SUBCOLLECTION_NAMES,
  SubcollectionName,
  writeAllToSubcollection,
  clearSubcollection,
  type ChunkProgressCallback,
} from './firestoreSubcollections'

// Batch chunk size (must match firestoreSubcollections.ts)
const BATCH_CHUNK_SIZE = 400
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

/**
 * Mapping des noms de collections vers des labels lisibles en français
 */
const COLLECTION_LABELS: Record<SubcollectionName, string> = {
  bookmarks: 'marque-pages',
  highlights: 'surlignages',
  notes: 'notes',
  links: 'liens',
  tags: 'tags',
  strongsHebreu: 'Strong hébreu',
  strongsGrec: 'Strong grec',
  words: 'mots',
  naves: 'thèmes Nave',
  tabGroups: 'onglets',
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
  } catch (error: any) {
    console.error('[FirestoreMigration] Failed to check migration status:', error)
    Sentry.captureException(error, {
      tags: {
        feature: 'firestore_migration',
        action: 'check_migration_status',
      },
      extra: {
        userId,
        errorMessage: error?.message,
      },
    })
    return false
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

    const bible = userData.bible
    const collectionsWithData: SubcollectionName[] = []

    for (const collection of SUBCOLLECTION_NAMES) {
      if (bible[collection] && Object.keys(bible[collection]).length > 0) {
        collectionsWithData.push(collection)
      }
    }

    return {
      hasEmbeddedData: collectionsWithData.length > 0,
      collectionsWithData,
    }
  } catch (error: any) {
    console.error('[FirestoreMigration] Failed to check for embedded data:', error)
    Sentry.captureException(error, {
      tags: {
        feature: 'firestore_migration',
        action: 'check_embedded_data',
      },
      extra: {
        userId,
        errorMessage: error?.message,
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
  } catch (error: any) {
    console.error('[FirestoreMigration] Failed to mark user as migrated:', error)
    Sentry.captureException(error, {
      tags: {
        feature: 'firestore_migration',
        action: 'mark_as_migrated',
      },
      extra: {
        userId,
        errorMessage: error?.message,
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
    const updates: { [key: string]: any } = {}

    for (const collectionName of SUBCOLLECTION_NAMES) {
      updates[`bible.${collectionName}`] = deleteField()
    }

    const userDocRef = doc(firebaseDb, 'users', userId)
    await updateDoc(userDocRef, updates)
    console.log('[FirestoreMigration] Embedded data removed from user document')
  } catch (error: any) {
    console.error('[FirestoreMigration] Failed to remove embedded data:', error)
    Sentry.captureException(error, {
      tags: {
        feature: 'firestore_migration',
        action: 'remove_embedded_data',
      },
      extra: {
        userId,
        errorMessage: error?.message,
      },
    })
    throw error // Re-throw to let caller handle it
  }
}

/**
 * Migre les données d'un utilisateur vers les sous-collections Firestore
 *
 * Cette fonction:
 * 1. Crée un backup avant migration (sécurité)
 * 2. Lit les données embedded du document user
 * 3. Écrit chaque collection dans sa sous-collection
 * 4. Marque l'utilisateur comme migré
 * 5. Supprime les données embedded du document principal
 *
 * @param userId - L'ID Firebase de l'utilisateur
 * @param state - L'état Redux actuel (pour le backup)
 * @param onProgress - Callback optionnel pour le suivi de progression
 */
export async function migrateUserDataToSubcollections(
  userId: string,
  state: RootState,
  onProgress?: (message: string, progress: number) => void
): Promise<{ success: boolean; error?: string }> {
  const reportProgress = (message: string, progress: number) => {
    console.log(`[FirestoreMigration] ${message} (${Math.round(progress * 100)}%)`)
    onProgress?.(message, progress)
  }

  try {
    // 1. Vérifier si déjà migré
    reportProgress('Vérification du statut de migration...', 0)
    const alreadyMigrated = await isUserMigrated(userId)
    if (alreadyMigrated) {
      console.log('[FirestoreMigration] User already migrated, skipping')
      return { success: true }
    }

    // 2. Créer un backup avant migration
    reportProgress('Création du backup de sécurité...', 0.05)
    const backupCreated = await autoBackupManager.createBackupNow(state, 'pre_migration')
    if (!backupCreated) {
      console.warn('[FirestoreMigration] Backup creation failed, but continuing with migration')
      // On continue quand même car le backup peut échouer pour diverses raisons non critiques
    }

    // 3. Lire les données embedded du document user
    reportProgress('Lecture des données existantes...', 0.1)
    const userDocRef = doc(firebaseDb, 'users', userId)
    const userDocSnap = await getDoc(userDocRef)
    const userData = userDocSnap.data()

    if (!userData?.bible) {
      console.log('[FirestoreMigration] No bible data found, marking as migrated')
      await markAsMigrated(userId)
      return { success: true }
    }

    const bible = userData.bible

    // 4. Migrer chaque collection
    const collectionsToMigrate = SUBCOLLECTION_NAMES.filter(
      name => bible[name] && Object.keys(bible[name]).length > 0
    )

    if (collectionsToMigrate.length === 0) {
      console.log('[FirestoreMigration] No data to migrate, marking as migrated')
      await markAsMigrated(userId)
      return { success: true }
    }

    console.log(
      `[FirestoreMigration] Migrating ${collectionsToMigrate.length} collections:`,
      collectionsToMigrate
    )

    for (let i = 0; i < collectionsToMigrate.length; i++) {
      const collection = collectionsToMigrate[i]
      const data = bible[collection]
      const itemCount = Object.keys(data).length

      const baseProgress = 0.1 + (0.7 * i) / collectionsToMigrate.length
      const label = getCollectionLabel(collection)
      reportProgress(`Migration des ${label} (${itemCount} éléments)...`, baseProgress)

      await writeAllToSubcollection(userId, collection, data)

      const endProgress = 0.1 + (0.7 * (i + 1)) / collectionsToMigrate.length
      reportProgress(`${label} migrés avec succès`, endProgress)
    }

    // 5. Marquer comme migré
    reportProgress('Finalisation de la migration...', 0.85)
    await markAsMigrated(userId)

    // 6. Supprimer les données embedded
    reportProgress('Nettoyage des anciennes données...', 0.9)
    await removeEmbeddedData(userId)

    reportProgress('Migration terminée avec succès!', 1)
    console.log('[FirestoreMigration] Migration completed successfully')

    return { success: true }
  } catch (error: any) {
    console.error('[FirestoreMigration] Migration failed:', error)
    Sentry.captureException(error, {
      tags: { feature: 'migration', action: 'migrate_to_subcollections' },
      extra: { userId },
    })
    return {
      success: false,
      error: error.message || 'Unknown error during migration',
    }
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
  data: {
    bookmarks?: { [id: string]: any }
    highlights?: { [id: string]: any }
    notes?: { [id: string]: any }
    tags?: { [id: string]: any }
    strongsHebreu?: { [id: string]: any }
    strongsGrec?: { [id: string]: any }
    words?: { [id: string]: any }
    naves?: { [id: string]: any }
    links?: { [id: string]: any }
  }
): Promise<void> {
  console.log('[FirestoreMigration] ========================================')
  console.log('[FirestoreMigration] Starting imported data migration')
  console.log('[FirestoreMigration] User ID:', userId)

  // Log data counts for debugging
  console.log('[FirestoreMigration] Data counts to import:')
  for (const collection of SUBCOLLECTION_NAMES) {
    const count = data[collection] ? Object.keys(data[collection]).length : 0
    console.log(`[FirestoreMigration]   - ${collection}: ${count} items`)
  }

  // Determine which collections have data to migrate
  const collectionsToMigrate = SUBCOLLECTION_NAMES.filter(
    name => data[name] && Object.keys(data[name]).length > 0
  )

  if (collectionsToMigrate.length === 0) {
    console.log('[FirestoreMigration] WARNING: No data to migrate - all collections empty!')
    await markAsMigrated(userId)
    return
  }

  console.log('[FirestoreMigration] Collections to migrate:', collectionsToMigrate.join(', '))

  // Show migration modal and set isMigrating flag to prevent listener race conditions
  setMigrationProgressFromOutsideReact({
    isActive: true,
    isResuming: false,
    isMigrating: true,
    currentCollection: null,
    collectionsCompleted: 0,
    totalCollections: collectionsToMigrate.length,
    overallProgress: 0,
    message: 'Démarrage de la restauration...',
    error: null,
    hasPartialFailure: false,
    failedCollections: [],
  })

  try {
    const totalCollections = collectionsToMigrate.length

    // Process each collection: clear existing data, then write new data
    for (let i = 0; i < totalCollections; i++) {
      const collection = collectionsToMigrate[i]
      const collectionData = data[collection]!
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
    }

    // Mark user as migrated
    console.log('[FirestoreMigration] Marking user as migrated...')
    await markAsMigrated(userId)

    // Show success and allow listener updates again
    setMigrationProgressFromOutsideReact({
      collectionsCompleted: collectionsToMigrate.length,
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
export function countItemsToMigrate(bible: any): number {
  let count = 0
  for (const collection of SUBCOLLECTION_NAMES) {
    if (bible[collection]) {
      count += Object.keys(bible[collection]).length
    }
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
    console.log(`[FirestoreMigration] ${progress.message} (${Math.round(progress.overallProgress * 100)}%)`)
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

    const bible = userData.bible

    // 5. Déterminer les collections à migrer
    const collectionsToMigrate = getCollectionsToMigrate(migrationState).filter(
      name => bible[name] && Object.keys(bible[name]).length > 0
    )

    // Ajouter les collections vides comme complétées
    const emptyCollections = SUBCOLLECTION_NAMES.filter(
      name => !bible[name] || Object.keys(bible[name]).length === 0
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
      const data = bible[collection]
      const itemCount = Object.keys(data).length
      const chunkCount = Math.ceil(itemCount / BATCH_CHUNK_SIZE)
      collectionChunks.push({ collection, itemCount, chunkCount })
      totalChunks += chunkCount
    }

    console.log(`[FirestoreMigration] Total chunks to process: ${totalChunks}`)

    let completedChunks = 0

    // 7. Migrer chaque collection individuellement
    for (const { collection, itemCount, chunkCount } of collectionChunks) {
      const data = bible[collection]
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
      } catch (error: any) {
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
            errorMessage: error.message,
          },
        })

        // Marquer comme échoué et continuer
        updateCollectionStatus(collection, 'failed', itemCount, error.message)
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
  } catch (error: any) {
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
      error: error.message || 'Erreur inattendue lors de la migration',
    }
  }
}
