import type { DatabaseId } from './databaseTypes'

export const resourceDatabaseRequiredTables: Partial<Record<DatabaseId, readonly string[]>> = {
  DICTIONNAIRE: ['dictionnaire'],
  NAVE: ['topics', 'verses'],
  TRESOR: ['commentaires'],
  MHY: ['commentaires'],
}

// Match the reader: a normalized schema takes precedence over legacy tables.
export const getCommentaryRequiredTables = (tableNames: ReadonlySet<string>): readonly string[] =>
  tableNames.has('commentary_documents')
    ? ['commentary_documents', 'commentary_verse_documents']
    : ['commentaires']
