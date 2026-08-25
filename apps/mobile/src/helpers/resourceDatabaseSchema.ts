import type { DatabaseId } from './databaseTypes'

export const resourceDatabaseRequiredTables: Partial<Record<DatabaseId, readonly string[]>> = {
  DICTIONNAIRE: ['dictionnaire'],
  NAVE: ['topics', 'verses'],
  TRESOR: ['commentaires'],
  MHY: ['commentaires'],
}
