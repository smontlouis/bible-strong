import { useRef } from 'react'
import { useSetAtom } from 'jotai'
import * as Sentry from '@sentry/react-native'
import { migrationProgressAtom, MigrationProgress } from 'src/state/migration'
import { RootState } from '~redux/modules/reducer'
import {
  getMigrationState,
  clearMigrationState,
  hasPendingMigration,
  getFailedCollections,
} from './migrationState'
import {
  checkForEmbeddedData,
  resumableMigrateUserData,
  MigrationProgressUpdate,
} from './firestoreMigration'
import { SubcollectionName } from './firestoreSubcollections'

/**
 * Hook to orchestrate the Firestore migration process
 * Handles checking for existing migration state, resuming, and updating UI
 */
export const useFirestoreMigration = () => {
  const setProgress = useSetAtom(migrationProgressAtom)
  const isMigratingRef = useRef(false)

  const resetProgress = () => {
    setProgress({
      isActive: false,
      isResuming: false,
      currentCollection: null,
      collectionsCompleted: 0,
      totalCollections: 7,
      overallProgress: 0,
      message: '',
      error: null,
      hasPartialFailure: false,
      failedCollections: [],
    })
  }

  /**
   * Check if a migration needs to be performed or resumed
   * Uses checkForEmbeddedData to support incremental migration
   * (old app on another device may still sync to embedded bible.*)
   */
  const checkMigrationNeeded = async (userId: string): Promise<boolean> => {
    // Check if there's embedded data to migrate
    // This is more accurate than checking _migrated flag alone
    const { hasEmbeddedData } = await checkForEmbeddedData(userId)
    if (!hasEmbeddedData) {
      // No embedded data - clear any stale local migration state
      clearMigrationState()
      return false
    }

    return true
  }

  /**
   * Start or resume the migration process
   */
  const startMigration = async (userId: string, state: RootState): Promise<boolean> => {
    // Prevent concurrent migrations
    if (isMigratingRef.current) {
      console.log('[FirestoreMigration] Migration already in progress')
      return false
    }

    isMigratingRef.current = true

    try {
      // Check existing migration state
      const existingState = getMigrationState()
      const isResuming =
        existingState !== null &&
        existingState.userId === userId &&
        hasPendingMigration(existingState)

      if (isResuming) {
        console.log('[FirestoreMigration] Resuming existing migration')
      }

      // Initialize progress UI
      setProgress({
        isActive: true,
        isResuming,
        currentCollection: null,
        collectionsCompleted: 0,
        totalCollections: 7,
        overallProgress: 0,
        message: isResuming ? 'Reprise de la migration...' : 'Démarrage de la migration...',
        error: null,
        hasPartialFailure: false,
        failedCollections: [],
      })

      // Run the migration
      const result = await resumableMigrateUserData(
        userId,
        state,
        existingState,
        (update: MigrationProgressUpdate) => {
          setProgress((prev: MigrationProgress) => ({
            ...prev,
            currentCollection: update.currentCollection,
            collectionsCompleted: update.collectionsCompleted,
            totalCollections: update.totalCollections,
            overallProgress: update.overallProgress,
            message: update.message,
          }))
        }
      )

      if (result.success) {
        // Migration completed successfully
        setProgress((prev: MigrationProgress) => ({
          ...prev,
          isActive: false,
          overallProgress: 1,
          message: 'Migration terminée avec succès!',
        }))

        // Small delay before hiding the modal
        await new Promise(resolve => setTimeout(resolve, 1500))
        resetProgress()

        return true
      } else {
        // Migration failed or partially failed
        const failedCollections = result.failedCollections as SubcollectionName[]

        setProgress((prev: MigrationProgress) => ({
          ...prev,
          error: result.error || 'Une erreur est survenue',
          hasPartialFailure: result.partialFailure,
          failedCollections,
          message: result.partialFailure ? 'Migration partiellement échouée' : 'Migration échouée',
        }))

        return false
      }
    } catch (error: any) {
      console.error('[useFirestoreMigration] Unexpected error:', error)

      Sentry.captureException(error, {
        tags: {
          feature: 'firestore_migration',
          action: 'start_migration',
        },
        extra: {
          userId,
          errorMessage: error.message,
        },
      })

      setProgress((prev: MigrationProgress) => ({
        ...prev,
        error: error.message || 'Une erreur inattendue est survenue',
        hasPartialFailure: false,
        failedCollections: [],
        message: 'Erreur inattendue',
      }))

      return false
    } finally {
      isMigratingRef.current = false
    }
  }

  /**
   * Retry migration (for failed collections)
   */
  const retryMigration = async (userId: string, state: RootState): Promise<boolean> => {
    // Reset error state and retry
    setProgress((prev: MigrationProgress) => ({
      ...prev,
      error: null,
      hasPartialFailure: false,
      failedCollections: [],
    }))

    return startMigration(userId, state)
  }

  /**
   * Dismiss the migration modal (only available after error)
   * Note: This doesn't clear migration state - user will be prompted again next time
   */
  const dismissMigration = () => {
    resetProgress()
  }

  return {
    checkMigrationNeeded,
    startMigration,
    retryMigration,
    dismissMigration,
    resetProgress,
  }
}
