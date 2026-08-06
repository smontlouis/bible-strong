import * as Sentry from '@sentry/react-native'
import { batchWriteSubcollection } from '../firestoreSubcollections'
import { writeBatch } from '../firebase'

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}))

jest.mock('../TokenManager', () => ({
  tokenManager: {
    tryRefreshOrWait: jest.fn(),
  },
}))

jest.mock('../firebase', () => ({
  firebaseDb: {},
  collection: jest.fn(() => ({ path: 'collection' })),
  doc: jest.fn(() => ({ path: 'doc' })),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  deleteDoc: jest.fn(),
  onSnapshot: jest.fn(),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(),
  })),
}))

describe('firestoreSubcollections', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('keeps optional source-version metadata in synced user entities', async () => {
    await batchWriteSubcollection('user-1', 'highlights', {
      set: {
        '67-1-1': { color: 'yellow', date: 1, version: 'VUL', ignored: undefined },
      },
      delete: [],
    })

    const batch = (writeBatch as jest.Mock).mock.results[0].value
    expect(batch.set).toHaveBeenCalledWith(
      expect.anything(),
      { color: 'yellow', date: 1, version: 'VUL' },
      { merge: true }
    )
    expect(batch.commit).toHaveBeenCalled()
  })

  it('can replace canonical migration documents without retaining legacy fields', async () => {
    await batchWriteSubcollection('user-1', 'relations', {
      set: { relation: { id: 'relation', type: 'linked' } },
      delete: [],
      merge: false,
    })

    const batch = (writeBatch as jest.Mock).mock.results[0].value
    expect(batch.set).toHaveBeenCalledWith(expect.anything(), {
      id: 'relation',
      type: 'linked',
    })
  })

  it('rejects invalid document IDs instead of silently skipping them', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(
      batchWriteSubcollection('user-1', 'notes', {
        set: {
          '': { title: 'Invalid' },
          valid: { title: 'Valid' },
        },
        delete: [],
      })
    ).rejects.toThrow('invalid document ID')

    expect(writeBatch).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          feature: 'subcollections',
          action: 'validate_ids',
          collection: 'notes',
        }),
      })
    )

    warnSpy.mockRestore()
  })

  it('keeps adoption diagnostics aggregate-only', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(
      batchWriteSubcollection(
        'sensitive-user-id',
        'notes',
        {
          set: { ['sensitive-document-id'.repeat(100)]: { title: 'Invalid' } },
          delete: [],
        },
        undefined,
        { diagnostics: 'aggregate-only' }
      )
    ).rejects.toThrow('invalid document ID')

    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('sensitive-document-id')
    expect(JSON.stringify((Sentry.captureException as jest.Mock).mock.calls)).not.toContain(
      'sensitive-user-id'
    )

    warnSpy.mockRestore()
  })

  it('does not report raw batch errors in aggregate-only mode', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    ;(writeBatch as jest.Mock).mockReturnValueOnce({
      set: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockRejectedValue(new Error('path/users/sensitive-user-id/private-doc')),
    })

    await expect(
      batchWriteSubcollection(
        'sensitive-user-id',
        'notes',
        { set: { private: { title: 'Private' } }, delete: [] },
        undefined,
        { diagnostics: 'aggregate-only' }
      )
    ).rejects.toThrow('sensitive-user-id')

    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('sensitive-user-id')
    expect(JSON.stringify((Sentry.captureException as jest.Mock).mock.calls)).not.toContain(
      'sensitive-user-id'
    )

    errorSpy.mockRestore()
  })
})
