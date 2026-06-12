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
})
