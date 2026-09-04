import { migrateLegacyPersistedValue } from '../migrations/legacyPersistedReferences'

export const canonicalizeImportedDataForFirestore = <T>(payload: T): T =>
  migrateLegacyPersistedValue(payload) as T
