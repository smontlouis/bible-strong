import { updateDoc } from '../firebase'
import {
  clearSubcollection,
  writeAllToSubcollection,
  getInvalidSubcollectionDocumentIds,
  SUBCOLLECTION_NAMES,
} from '../firestoreSubcollections'
import { migrateImportedDataToSubcollections } from '../firestoreMigration'

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}))

jest.mock('../firebase', () => ({
  firebaseDb: {},
  doc: jest.fn(() => ({ path: 'user-doc' })),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteField: jest.fn(() => ({ __delete: true })),
}))

jest.mock('../AutoBackupManager', () => ({
  autoBackupManager: {
    createBackupNow: jest.fn(),
  },
}))

jest.mock('../migrationState', () => ({
  createInitialMigrationState: jest.fn(),
  setMigrationState: jest.fn(),
  updateCollectionStatus: jest.fn(),
  clearMigrationState: jest.fn(),
  getCollectionsToMigrate: jest.fn(() => []),
}))

jest.mock(
  'src/state/migration',
  () => ({
    setMigrationProgressFromOutsideReact: jest.fn(),
    resetMigrationProgressFromOutsideReact: jest.fn(),
  }),
  { virtual: true }
)

jest.mock('../firestoreSubcollections', () => {
  const collectionNames = [
    'notes',
    'links',
    'relations',
    'relationIndex',
    'relationPairs',
    'wordAnnotations',
  ]

  return {
    SUBCOLLECTION_NAMES: collectionNames,
    clearSubcollection: jest.fn(async () => undefined),
    writeAllToSubcollection: jest.fn(async () => undefined),
    getInvalidSubcollectionDocumentIds: jest.fn((docIds: string[]) =>
      docIds
        .filter(docId => !docId || docId === '.' || docId === '..')
        .map(docId => ({ docId: docId || '(empty)', reason: 'empty' }))
    ),
  }
})

jest.mock('~assets/bible_versions/books-desc', () => [{ Numero: 1, Nom: 'Genèse', Chapitres: 50 }])

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
}))

describe('firestoreMigration import', () => {
  let logSpy: jest.SpyInstance
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('validates all imported IDs before clearing existing subcollections', async () => {
    await expect(
      migrateImportedDataToSubcollections('user-1', {
        notes: {
          '': { title: 'Invalid note' },
        },
      })
    ).rejects.toThrow('Invalid document IDs')

    expect(getInvalidSubcollectionDocumentIds).toHaveBeenCalled()
    expect(clearSubcollection).not.toHaveBeenCalled()
    expect(writeAllToSubcollection).not.toHaveBeenCalled()
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it('replaces every subcollection and writes backfilled relations from legacy notes', async () => {
    await migrateImportedDataToSubcollections('user-1', {
      notes: {
        '1-1-1': { title: 'Imported note', description: 'Body', date: 1 },
      },
    })

    expect(clearSubcollection).toHaveBeenCalledTimes(SUBCOLLECTION_NAMES.length)
    expect(clearSubcollection).toHaveBeenCalledWith('user-1', 'links', expect.any(Function))

    const writtenCollections = (writeAllToSubcollection as jest.Mock).mock.calls.map(
      call => call[1]
    )
    expect(writtenCollections).toEqual(
      expect.arrayContaining(['notes', 'relations', 'relationIndex', 'relationPairs'])
    )
    expect(writtenCollections).not.toContain('links')

    const relationsWrite = (writeAllToSubcollection as jest.Mock).mock.calls.find(
      call => call[1] === 'relations'
    )
    expect(Object.values(relationsWrite?.[2] || {})).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'system',
          type: 'annotates',
          endpointKeys: ['note:1-1-1', 'verse:1-1-1'],
        }),
      ])
    )
    expect(updateDoc).toHaveBeenCalledWith({ path: 'user-doc' }, { _migrated: true })
  })
})
