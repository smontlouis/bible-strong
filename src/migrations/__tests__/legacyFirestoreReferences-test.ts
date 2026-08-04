import {
  createLegacyFirestoreReferencesAdapter,
  type LegacyFirestoreReferencesPersistence,
} from '../legacyFirestoreReferences'

describe('legacy Firestore Bible references', () => {
  const createPersistence = () => {
    let settings: unknown = {
      defaultBibleVersion: 'KJVS',
      customLabel: 'I still call this KJVS in my own text',
    }
    const collections: Record<string, Record<string, unknown>> = {
      notes: {
        note1: { version: 'INT_EN', content: 'LSGS is mentioned in this note' },
      },
      bookmarks: {
        bookmark1: { version: 'LSG' },
      },
    }
    const persistence: LegacyFirestoreReferencesPersistence = {
      readUserSettings: jest.fn(async () => settings),
      writeUserSettings: jest.fn(async (_userId, value) => {
        settings = value
      }),
      readSubcollection: jest.fn(async (_userId, collection) => collections[collection] ?? {}),
      writeSubcollection: jest.fn(async (_userId, collection, documents) => {
        collections[collection] = { ...collections[collection], ...documents }
      }),
    }
    return { persistence, getSettings: () => settings, collections }
  }

  it('detects only technical targets without retaining account content in the plan', async () => {
    const { persistence } = createPersistence()
    const adapter = createLegacyFirestoreReferencesAdapter(persistence, ['notes', 'bookmarks'])

    await expect(adapter.inspectTargets('user-1')).resolves.toEqual([
      'user-settings',
      'subcollection:notes',
    ])
  })

  it('canonicalizes version fields while preserving user-authored text and current documents', async () => {
    const { persistence, getSettings, collections } = createPersistence()
    const adapter = createLegacyFirestoreReferencesAdapter(persistence, ['notes', 'bookmarks'])

    await adapter.migrateTarget('user-1', 'user-settings', jest.fn())
    await adapter.migrateTarget('user-1', 'subcollection:notes', jest.fn())

    expect(getSettings()).toEqual({
      defaultBibleVersion: 'KJV',
      customLabel: 'I still call this KJVS in my own text',
    })
    expect(collections.notes.note1).toEqual({
      version: 'BHG',
      content: 'LSGS is mentioned in this note',
    })
    expect(persistence.writeSubcollection).toHaveBeenCalledWith('user-1', 'notes', {
      note1: {
        version: 'BHG',
        content: 'LSGS is mentioned in this note',
      },
    })
  })

  it('is idempotent and does not rewrite already canonical Firestore values', async () => {
    const { persistence } = createPersistence()
    const adapter = createLegacyFirestoreReferencesAdapter(persistence, ['notes', 'bookmarks'])

    await adapter.migrateTarget('user-1', 'subcollection:bookmarks', jest.fn())

    expect(persistence.writeSubcollection).not.toHaveBeenCalled()
  })

  it('preserves non-plain Firestore values while rewriting adjacent technical references', async () => {
    class TimestampValue {
      constructor(readonly seconds: number) {}
    }
    const timestamp = new TimestampValue(123)
    let settings: unknown = { defaultBibleVersion: 'LSGS', updatedAt: timestamp }
    const persistence: LegacyFirestoreReferencesPersistence = {
      readUserSettings: async () => settings,
      writeUserSettings: async (_userId, value) => {
        settings = value
      },
      readSubcollection: async () => ({}),
      writeSubcollection: async () => undefined,
    }
    const adapter = createLegacyFirestoreReferencesAdapter(persistence, [])

    await adapter.migrateTarget('user-1', 'user-settings', jest.fn())

    expect(settings).toEqual({ defaultBibleVersion: 'LSG', updatedAt: timestamp })
    expect((settings as { updatedAt: TimestampValue }).updatedAt).toBe(timestamp)
  })
})
