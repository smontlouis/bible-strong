import firestore from '@react-native-firebase/firestore'
import * as Sentry from '@sentry/react-native'
import { firebaseDb } from './firebase'
import { autoBackupManager } from './AutoBackupManager'
import {
  SUBCOLLECTION_NAMES,
  SubcollectionName,
  writeAllToSubcollection,
} from './firestoreSubcollections'
import { RootState } from '~redux/modules/reducer'

/**
 * Vérifie si un utilisateur a déjà été migré vers les sous-collections
 */
export async function isUserMigrated(userId: string): Promise<boolean> {
  try {
    const userDoc = await firebaseDb.collection('users').doc(userId).get()
    const userData = userDoc.data()
    return userData?._migrated === true
  } catch (error) {
    console.error('[Migration] Failed to check migration status:', error)
    return false
  }
}

/**
 * Marque un utilisateur comme migré
 */
async function markAsMigrated(userId: string): Promise<void> {
  await firebaseDb.collection('users').doc(userId).update({
    _migrated: true,
  })
}

/**
 * Supprime les données embedded du document principal après migration
 */
async function removeEmbeddedData(userId: string): Promise<void> {
  const updates: { [key: string]: any } = {}

  for (const collection of SUBCOLLECTION_NAMES) {
    updates[`bible.${collection}`] = firestore.FieldValue.delete()
  }

  await firebaseDb.collection('users').doc(userId).update(updates)
  console.log('[Migration] Embedded data removed from user document')
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
    console.log(`[Migration] ${message} (${Math.round(progress * 100)}%)`)
    onProgress?.(message, progress)
  }

  try {
    // 1. Vérifier si déjà migré
    reportProgress('Vérification du statut de migration...', 0)
    const alreadyMigrated = await isUserMigrated(userId)
    if (alreadyMigrated) {
      console.log('[Migration] User already migrated, skipping')
      return { success: true }
    }

    // 2. Créer un backup avant migration
    reportProgress('Création du backup de sécurité...', 0.05)
    const backupCreated = await autoBackupManager.createBackupNow(state, 'pre_migration')
    if (!backupCreated) {
      console.warn('[Migration] Backup creation failed, but continuing with migration')
      // On continue quand même car le backup peut échouer pour diverses raisons non critiques
    }

    // 3. Lire les données embedded du document user
    reportProgress('Lecture des données existantes...', 0.1)
    const userDoc = await firebaseDb.collection('users').doc(userId).get()
    const userData = userDoc.data()

    if (!userData?.bible) {
      console.log('[Migration] No bible data found, marking as migrated')
      await markAsMigrated(userId)
      return { success: true }
    }

    const bible = userData.bible

    // 4. Migrer chaque collection
    const collectionsToMigrate = SUBCOLLECTION_NAMES.filter(
      (name) => bible[name] && Object.keys(bible[name]).length > 0
    )

    if (collectionsToMigrate.length === 0) {
      console.log('[Migration] No data to migrate, marking as migrated')
      await markAsMigrated(userId)
      return { success: true }
    }

    console.log(`[Migration] Migrating ${collectionsToMigrate.length} collections:`, collectionsToMigrate)

    for (let i = 0; i < collectionsToMigrate.length; i++) {
      const collection = collectionsToMigrate[i]
      const data = bible[collection]
      const itemCount = Object.keys(data).length

      const baseProgress = 0.1 + (0.7 * i) / collectionsToMigrate.length
      reportProgress(
        `Migration de ${collection} (${itemCount} éléments)...`,
        baseProgress
      )

      await writeAllToSubcollection(userId, collection, data)

      const endProgress = 0.1 + (0.7 * (i + 1)) / collectionsToMigrate.length
      reportProgress(`${collection} migré avec succès`, endProgress)
    }

    // 5. Marquer comme migré
    reportProgress('Finalisation de la migration...', 0.85)
    await markAsMigrated(userId)

    // 6. Supprimer les données embedded
    reportProgress('Nettoyage des anciennes données...', 0.9)
    await removeEmbeddedData(userId)

    reportProgress('Migration terminée avec succès!', 1)
    console.log('[Migration] Migration completed successfully')

    return { success: true }
  } catch (error: any) {
    console.error('[Migration] Migration failed:', error)
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
 * Cette fonction ne crée PAS de backup car elle est appelée lors d'une restauration
 *
 * @param userId - L'ID Firebase de l'utilisateur
 * @param data - Les données à migrer (format embedded)
 */
export async function migrateImportedDataToSubcollections(
  userId: string,
  data: {
    highlights?: { [id: string]: any }
    notes?: { [id: string]: any }
    tags?: { [id: string]: any }
    strongsHebreu?: { [id: string]: any }
    strongsGrec?: { [id: string]: any }
    words?: { [id: string]: any }
    naves?: { [id: string]: any }
  }
): Promise<void> {
  console.log('[Migration] Migrating imported data to subcollections')

  try {
    // Migrer chaque collection qui a des données
    for (const collection of SUBCOLLECTION_NAMES) {
      const collectionData = data[collection]
      if (collectionData && Object.keys(collectionData).length > 0) {
        console.log(
          `[Migration] Writing ${Object.keys(collectionData).length} items to ${collection}`
        )
        await writeAllToSubcollection(userId, collection, collectionData)
      }
    }

    // S'assurer que l'utilisateur est marqué comme migré
    await markAsMigrated(userId)

    console.log('[Migration] Imported data migration completed')
  } catch (error) {
    console.error('[Migration] Failed to migrate imported data:', error)
    Sentry.captureException(error, {
      tags: { feature: 'migration', action: 'migrate_imported_data' },
      extra: { userId },
    })
    throw error
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
