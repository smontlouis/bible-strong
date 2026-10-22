import type { Action } from '@reduxjs/toolkit'
import { batchWriteSubcollection } from '~helpers/firestoreSubcollections'
import { firestoreSyncOutbox } from '~helpers/firestoreSyncOutbox'
import { setDoc } from '~helpers/firebase'
import {
  getPendingSubcollectionTargets,
  keepPendingWrites,
  withoutPendingWriteTargets,
} from '~helpers/pendingWritesOverlay'
import { setAccountMigrationWriteScope } from '~state/migration'
import { recordAccountMigrationPreferredDocuments } from '../../migrations/accountMigrationMutationJournal'
import firestoreMiddleware from '../firestoreMiddleware'
import userReducer, { receiveSubcollectionUpdates, type UserState } from '../modules/user'
import { addHighlightAction } from '../modules/user/highlights'
import { setSettingsAlignContent } from '../modules/user/settings'
import { deleteStudy, updateStudy } from '../modules/user/studies'

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Appearance: { getColorScheme: jest.fn(() => 'light') },
}))
jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('expo-file-system', () => ({}))
jest.mock('expo-sqlite', () => ({}))
jest.mock('~helpers/bibleVersions', () => ({ versions: {}, getIfVersionNeedsUpdate: jest.fn() }))
jest.mock('~helpers/databases', () => ({ databases: {}, getIfDatabaseNeedsUpdate: jest.fn() }))
jest.mock('~state/tabs', () => ({ tabGroupsAtom: {} }))
jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  getLanguage: jest.fn(() => 'fr'),
}))
jest.mock('~helpers/languageUtils', () => ({ getDefaultBibleVersion: jest.fn(() => 'LSG') }))
jest.mock('~themes/colors', () => ({ primary: '#000' }))
jest.mock('~themes/darkColors', () => ({ primary: '#111' }))
jest.mock('~themes/blackColors', () => ({ primary: '#222' }))
jest.mock('~themes/sepiaColors', () => ({ primary: '#333' }))
jest.mock('~themes/natureColors', () => ({ primary: '#444' }))
jest.mock('~themes/sunsetColors', () => ({ primary: '#555' }))
jest.mock('~themes/mauveColors', () => ({ primary: '#666' }))
jest.mock('~themes/nightColors', () => ({ primary: '#777' }))

const mockDeleteField = { _type: 'delete', isEqual: (other: unknown) => other === mockDeleteField }
jest.mock('~helpers/firebase', () => ({
  firebaseDb: {},
  doc: jest.fn((_db: unknown, ...path: string[]) => ({ path: path.join('/') })),
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  deleteField: () => mockDeleteField,
}))
jest.mock('~helpers/firestoreSubcollections', () => ({
  SUBCOLLECTION_NAMES: jest.requireActual('../../helpers/firestoreSubcollectionNames')
    .SUBCOLLECTION_NAMES,
  batchWriteSubcollection: jest.fn(async () => undefined),
}))
jest.mock('~helpers/firestoreMigration', () => ({
  migrateImportedDataToSubcollections: jest.fn(async () => undefined),
}))
let mockSignedInUserId: string | undefined
jest.mock('~helpers/firebaseAuthRuntime', () => ({
  getCurrentAuthUser: () => (mockSignedInUserId ? { uid: mockSignedInUserId } : null),
}))
const mockStorage = new Map<string, string>()
jest.mock('~helpers/storage', () => ({
  storage: {
    getString: (key: string) => mockStorage.get(key),
    set: (key: string, value: string) => mockStorage.set(key, value),
    remove: (key: string) => mockStorage.delete(key),
  },
}))
jest.mock('~helpers/TokenManager', () => ({
  tokenManager: { tryRefresh: jest.fn(async () => false) },
}))
jest.mock('~helpers/toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
jest.mock('~helpers/agentObservability', () => ({
  appLogger: { captureError: jest.fn(), info: jest.fn(), warn: jest.fn() },
}))
jest.mock('~helpers/AutoBackupManager', () => ({
  autoBackupManager: { scheduleBackup: jest.fn(), createBackupNow: jest.fn(async () => true) },
}))
jest.mock('../../migrations/accountMigrationMutationJournal', () => ({
  recordAccountMigrationDeletedDocuments: jest.fn(),
  recordAccountMigrationPreferredDocuments: jest.fn(),
}))

type TestState = { user: UserState; plan: { ongoingPlans: unknown[] } }

const highlight = (color: string) => ({ color, date: 1, tags: {} })

describe('firestoreMiddleware while Firebase does not hold the account', () => {
  let state: TestState
  const store = { getState: () => state, dispatch: jest.fn() }
  const next = (action: Action) => {
    state = { ...state, user: userReducer(state.user, action) }
    return action
  }
  const run = (action: Action) => firestoreMiddleware(store as never)(next as never)(action)
  const withBible = (bible: Partial<UserState['bible']>): TestState => ({
    ...state,
    user: { ...state.user, bible: { ...state.user.bible, ...bible } },
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    mockStorage.clear()
    mockSignedInUserId = undefined
    setAccountMigrationWriteScope()
    const user = userReducer(undefined, { type: '@@init' })
    state = { user: { ...user, id: 'user-1', isLoading: false }, plan: { ongoingPlans: [] } }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('queues every edit under the account the store shows, and writes nothing', async () => {
    await run(addHighlightAction({ '1-1-1': highlight('yellow') }))
    await run(setSettingsAlignContent('justify'))
    await run(updateStudy({ id: 'study-1', title: 'Étude', modified_at: 2 }))
    await run(deleteStudy('study-0'))

    expect(batchWriteSubcollection).not.toHaveBeenCalled()
    expect(setDoc).not.toHaveBeenCalled()
    const pending = firestoreSyncOutbox.getPending('user-1')
    expect(pending.map(entry => entry.intent)).toEqual([
      expect.objectContaining({
        kind: 'subcollection',
        collection: 'highlights',
        set: { '1-1-1': highlight('yellow') },
      }),
      expect.objectContaining({
        kind: 'document-set',
        path: ['users', 'user-1'],
        data: { bible: { settings: { alignContent: 'justify' } } },
      }),
      expect.objectContaining({
        kind: 'document-set',
        path: ['studies', 'study-1'],
        data: expect.objectContaining({
          title: 'Étude',
          user: expect.objectContaining({ id: 'user-1' }),
        }),
      }),
    ])
    // The account migration check that runs at the next sign-in keeps these edits.
    expect(recordAccountMigrationPreferredDocuments).toHaveBeenCalledWith('user-1', 'highlights', [
      '1-1-1',
    ])
  })

  it('queues the removal of a study that was on the server', async () => {
    state = withBible({ studies: { 'study-0': { id: 'study-0', title: 'Ancienne' } as never } })

    await run(deleteStudy('study-0'))

    expect(firestoreSyncOutbox.getPending('user-1').map(entry => entry.intent)).toEqual([
      { kind: 'document-delete', path: ['studies', 'study-0'] },
    ])
  })

  it("never writes one account's edits into the account Firebase holds instead", async () => {
    mockSignedInUserId = 'user-2'
    setAccountMigrationWriteScope('user-2')

    await run(addHighlightAction({ '1-1-1': highlight('yellow') }))

    expect(batchWriteSubcollection).not.toHaveBeenCalled()
    expect(firestoreSyncOutbox.getPending('user-2')).toEqual([])
    expect(firestoreSyncOutbox.getPending('user-1')).toHaveLength(1)
  })

  it('writes directly, as before, once the account is signed in and its check allows it', async () => {
    mockSignedInUserId = 'user-1'
    setAccountMigrationWriteScope('user-1')

    await run(addHighlightAction({ '1-1-1': highlight('yellow') }))

    expect(batchWriteSubcollection).toHaveBeenCalledWith(
      'user-1',
      'highlights',
      expect.objectContaining({ set: { '1-1-1': highlight('yellow') } })
    )
    expect(firestoreSyncOutbox.getPending('user-1')).toEqual([])
  })

  it('keeps waiting for the migration check of a signed-in account, as before', async () => {
    mockSignedInUserId = 'user-1'

    await run(addHighlightAction({ '1-1-1': highlight('yellow') }))

    expect(batchWriteSubcollection).not.toHaveBeenCalled()
    expect(firestoreSyncOutbox.getPending('user-1')).toEqual([])
  })

  it('keeps an edit made while signed out through the first server snapshot, then sends it', async () => {
    state = withBible({ highlights: { '3-3-3': highlight('green') } })
    await run(addHighlightAction({ '1-1-1': highlight('yellow') }))

    // The reader signs in again with the same account. The server never received the edit, and
    // another device added a highlight meanwhile; it no longer has the one removed elsewhere.
    mockSignedInUserId = 'user-1'
    const remote = { '2-2-2': highlight('blue') }
    const pending = getPendingSubcollectionTargets(
      firestoreSyncOutbox.getPending('user-1'),
      'highlights'
    )
    state = {
      ...state,
      user: userReducer(
        state.user,
        receiveSubcollectionUpdates({
          collection: 'highlights',
          data: keepPendingWrites<unknown>(remote, state.user.bible.highlights, pending),
          changes: {
            added: withoutPendingWriteTargets(remote, pending),
            modified: {},
            removed: [],
          },
          isInitialLoad: true,
          fromCache: false,
        })
      ),
    }

    expect(state.user.bible.highlights).toEqual({
      '1-1-1': highlight('yellow'),
      '2-2-2': highlight('blue'),
    })

    await firestoreSyncOutbox.replay('user-1')

    expect(batchWriteSubcollection).toHaveBeenCalledWith('user-1', 'highlights', {
      set: { '1-1-1': highlight('yellow') },
      delete: [],
      merge: false,
    })
    expect(firestoreSyncOutbox.getPending('user-1')).toEqual([])
  })

  it('sends nothing of the queue while Firebase still holds no account', async () => {
    await run(addHighlightAction({ '1-1-1': highlight('yellow') }))

    await firestoreSyncOutbox.replay('user-1')
    firestoreSyncOutbox.cancelReplay('user-1')

    expect(batchWriteSubcollection).not.toHaveBeenCalled()
    expect(firestoreSyncOutbox.getPending('user-1')).toHaveLength(1)
  })
})
