import { atom, getDefaultStore } from 'jotai/vanilla'
import { SubcollectionName } from '~helpers/firestoreSubcollections'

export interface MigrationProgress {
  isActive: boolean
  isResuming: boolean
  isMigrating: boolean // Flag to indicate migration in progress (prevents listener race conditions)
  currentCollection: SubcollectionName | null
  collectionsCompleted: number
  totalCollections: number
  overallProgress: number // 0-1
  message: string
  error: string | null
  hasPartialFailure: boolean
  failedCollections: SubcollectionName[]
}

const initialMigrationProgress: MigrationProgress = {
  isActive: false,
  isResuming: false,
  isMigrating: false,
  currentCollection: null,
  collectionsCompleted: 0,
  totalCollections: 7,
  overallProgress: 0,
  message: '',
  error: null,
  hasPartialFailure: false,
  failedCollections: [],
}

export const migrationProgressAtom = atom<MigrationProgress>(initialMigrationProgress)

export const resetMigrationProgressAtom = atom(null, (get, set) => {
  set(migrationProgressAtom, initialMigrationProgress)
})

/**
 * Update migration progress from non-React code (e.g., Redux middleware)
 * Uses Jotai's default store to access the atom
 */
export function setMigrationProgressFromOutsideReact(progress: Partial<MigrationProgress>) {
  const store = getDefaultStore()
  const current = store.get(migrationProgressAtom)
  store.set(migrationProgressAtom, { ...current, ...progress })
}

/**
 * Reset migration progress from non-React code
 */
export function resetMigrationProgressFromOutsideReact() {
  const store = getDefaultStore()
  store.set(migrationProgressAtom, initialMigrationProgress)
}

/**
 * Check if migration is currently in progress
 * Used by listeners to avoid race conditions during migration
 */
export function isMigrationInProgress(): boolean {
  const store = getDefaultStore()
  return store.get(migrationProgressAtom).isMigrating
}
