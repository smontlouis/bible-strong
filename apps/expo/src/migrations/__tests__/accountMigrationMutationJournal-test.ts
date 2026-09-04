import {
  clearAccountMigrationMutationJournal,
  readAccountMigrationMutationJournal,
  recordAccountMigrationDeletedDocuments,
  recordAccountMigrationPreferredDocuments,
} from '../accountMigrationMutationJournal'

const mockValues = new Map<string, string>()

jest.mock('~helpers/storage', () => ({
  storage: {
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockValues.set(key, value),
    remove: (key: string) => mockValues.delete(key),
  },
}))

describe('account migration mutation journal', () => {
  beforeEach(() => mockValues.clear())

  it('persists only deduplicated technical deletion identities per UID', () => {
    recordAccountMigrationDeletedDocuments('user-a', 'notes', ['note-1', 'note-1'])
    recordAccountMigrationDeletedDocuments('user-a', 'notes', ['note-2'])
    recordAccountMigrationPreferredDocuments('user-a', 'notes', ['note-3', 'note-3'])
    recordAccountMigrationDeletedDocuments('user-a', 'notes', ['recreated-note'])
    recordAccountMigrationPreferredDocuments('user-a', 'notes', ['recreated-note'])

    expect(readAccountMigrationMutationJournal('user-a')).toEqual({
      version: 1,
      preferredDocumentIds: { notes: ['note-3', 'recreated-note'] },
      deletedDocumentIds: { notes: ['note-1', 'note-2'] },
    })
    expect(readAccountMigrationMutationJournal('user-b')).toEqual({
      version: 1,
      preferredDocumentIds: {},
      deletedDocumentIds: {},
    })
  })

  it('clears tombstones after a successful account migration', () => {
    recordAccountMigrationDeletedDocuments('user-a', 'tabGroups', ['group-1'])
    clearAccountMigrationMutationJournal('user-a')

    expect(readAccountMigrationMutationJournal('user-a').deletedDocumentIds).toEqual({})
  })
})
