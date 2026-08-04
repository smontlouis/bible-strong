import type { SubcollectionName } from '~helpers/firestoreSubcollectionNames'
import { storage } from '~helpers/storage'

const JOURNAL_VERSION = 1
const journalKey = (userId: string): string => `account_migration_mutations:${userId}`

interface AccountMigrationMutationJournal {
  version: typeof JOURNAL_VERSION
  preferredDocumentIds: Partial<Record<SubcollectionName, string[]>>
  deletedDocumentIds: Partial<Record<SubcollectionName, string[]>>
}

const emptyJournal = (): AccountMigrationMutationJournal => ({
  version: JOURNAL_VERSION,
  preferredDocumentIds: {},
  deletedDocumentIds: {},
})

export const readAccountMigrationMutationJournal = (
  userId: string
): AccountMigrationMutationJournal => {
  const serialized = storage.getString(journalKey(userId))
  if (!serialized) return emptyJournal()

  try {
    const parsed = JSON.parse(serialized) as Partial<AccountMigrationMutationJournal>
    if (parsed.version !== JOURNAL_VERSION || !parsed.deletedDocumentIds) {
      return emptyJournal()
    }
    return {
      version: JOURNAL_VERSION,
      preferredDocumentIds: parsed.preferredDocumentIds ?? {},
      deletedDocumentIds: parsed.deletedDocumentIds,
    }
  } catch {
    return emptyJournal()
  }
}

export const recordAccountMigrationPreferredDocuments = (
  userId: string,
  collection: SubcollectionName,
  documentIds: readonly string[]
): void => {
  if (documentIds.length === 0) return
  const journal = readAccountMigrationMutationJournal(userId)
  const preferredIds = new Set(documentIds)
  journal.deletedDocumentIds[collection] = (journal.deletedDocumentIds[collection] ?? []).filter(
    documentId => !preferredIds.has(documentId)
  )
  journal.preferredDocumentIds[collection] = [
    ...new Set([...(journal.preferredDocumentIds[collection] ?? []), ...documentIds]),
  ]
  storage.set(journalKey(userId), JSON.stringify(journal))
}

export const recordAccountMigrationDeletedDocuments = (
  userId: string,
  collection: SubcollectionName,
  documentIds: readonly string[]
): void => {
  if (documentIds.length === 0) return
  const journal = readAccountMigrationMutationJournal(userId)
  const deletedIds = new Set(documentIds)
  journal.preferredDocumentIds[collection] = (
    journal.preferredDocumentIds[collection] ?? []
  ).filter(documentId => !deletedIds.has(documentId))
  journal.deletedDocumentIds[collection] = [
    ...new Set([...(journal.deletedDocumentIds[collection] ?? []), ...documentIds]),
  ]
  storage.set(journalKey(userId), JSON.stringify(journal))
}

export const clearAccountMigrationMutationJournal = (userId: string): void => {
  storage.remove(journalKey(userId))
}
