import { atom } from 'jotai/vanilla'
import { SubcollectionName } from '~helpers/firestoreSubcollections'

export interface MigrationProgress {
  isActive: boolean
  isResuming: boolean
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
  currentCollection: null,
  collectionsCompleted: 0,
  totalCollections: 7,
  overallProgress: 0,
  message: '',
  error: null,
  hasPartialFailure: false,
  failedCollections: [],
}

export const migrationProgressAtom = atom<MigrationProgress>(
  initialMigrationProgress
)

export const resetMigrationProgressAtom = atom(null, (get, set) => {
  set(migrationProgressAtom, initialMigrationProgress)
})
