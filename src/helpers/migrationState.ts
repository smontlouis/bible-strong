import { storage } from './storage'
import { SubcollectionName, SUBCOLLECTION_NAMES } from './firestoreSubcollections'

const MIGRATION_STATE_KEY = 'firestore_migration_state'

export type MigrationCollectionStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface MigrationCollectionState {
  status: MigrationCollectionStatus
  itemCount: number
  error?: string
}

export interface MigrationState {
  userId: string
  startedAt: number
  lastUpdated: number
  collections: Record<SubcollectionName, MigrationCollectionState>
}

/**
 * Get the current migration state from MMKV storage
 */
export const getMigrationState = (): MigrationState | null => {
  try {
    const json = storage.getString(MIGRATION_STATE_KEY)
    return json ? JSON.parse(json) : null
  } catch (error) {
    console.error('[MigrationState] Failed to get migration state:', error)
    return null
  }
}

/**
 * Save the migration state to MMKV storage
 */
export const setMigrationState = (state: MigrationState): void => {
  try {
    storage.set(MIGRATION_STATE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('[MigrationState] Failed to set migration state:', error)
  }
}

/**
 * Clear the migration state from MMKV storage
 */
export const clearMigrationState = (): void => {
  try {
    storage.remove(MIGRATION_STATE_KEY)
  } catch (error) {
    console.error('[MigrationState] Failed to clear migration state:', error)
  }
}

/**
 * Create an initial migration state for a user
 */
export const createInitialMigrationState = (userId: string): MigrationState => {
  const collections = {} as Record<SubcollectionName, MigrationCollectionState>

  for (const name of SUBCOLLECTION_NAMES) {
    collections[name] = {
      status: 'pending',
      itemCount: 0,
    }
  }

  return {
    userId,
    startedAt: Date.now(),
    lastUpdated: Date.now(),
    collections,
  }
}

/**
 * Update the status of a specific collection in the migration state
 */
export const updateCollectionStatus = (
  collection: SubcollectionName,
  status: MigrationCollectionStatus,
  itemCount?: number,
  error?: string
): void => {
  const state = getMigrationState()
  if (!state) {
    console.warn('[MigrationState] No migration state found to update')
    return
  }

  state.collections[collection] = {
    status,
    itemCount: itemCount ?? state.collections[collection].itemCount,
    error,
  }
  state.lastUpdated = Date.now()

  setMigrationState(state)
}

/**
 * Check if a migration is in progress (has pending or in_progress collections)
 */
export const hasPendingMigration = (state: MigrationState | null): boolean => {
  if (!state) return false

  return Object.values(state.collections).some(
    c => c.status === 'pending' || c.status === 'in_progress'
  )
}

/**
 * Get the list of collections that need to be migrated (pending or failed)
 */
export const getCollectionsToMigrate = (state: MigrationState | null): SubcollectionName[] => {
  if (!state) return [...SUBCOLLECTION_NAMES]

  return SUBCOLLECTION_NAMES.filter(
    name =>
      state.collections[name].status === 'pending' ||
      state.collections[name].status === 'in_progress' ||
      state.collections[name].status === 'failed'
  )
}

/**
 * Get the list of collections that failed
 */
export const getFailedCollections = (state: MigrationState | null): SubcollectionName[] => {
  if (!state) return []

  return SUBCOLLECTION_NAMES.filter(name => state.collections[name].status === 'failed')
}

/**
 * Calculate overall migration progress (0-1)
 */
export const calculateOverallProgress = (state: MigrationState | null): number => {
  if (!state) return 0

  const completed = Object.values(state.collections).filter(c => c.status === 'completed').length

  return completed / SUBCOLLECTION_NAMES.length
}
