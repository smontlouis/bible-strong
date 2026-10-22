import React from 'react'
import { act, create } from 'react-test-renderer'

import useLiveUpdates from '~helpers/useLiveUpdates'

const mockDispatch = jest.fn()
const mockCaptureError = jest.fn()
const mockOnSnapshot = jest.fn((..._args: unknown[]) => jest.fn())
let mockHasStudies = false
let mockPreviousIsLogged = false
let mockSubcollectionOnChange: ((data: unknown, changes: unknown) => void) | undefined
const mockSubscribeToSubcollection = jest.fn((...args: unknown[]) => {
  mockSubcollectionOnChange = args[2] as typeof mockSubcollectionOnChange
  return jest.fn()
})

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      user: { isLoading: false, bible: { studies: mockHasStudies ? { study: {} } : {} } },
    }),
}))

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}))

jest.mock('~helpers/useLogin', () => ({
  __esModule: true,
  default: () => ({ isLogged: true, user: { id: 'user-1' } }),
}))

jest.mock('~helpers/usePrevious', () => ({
  usePrevious: () => mockPreviousIsLogged,
}))

jest.mock('~helpers/useConnection', () => ({
  useConnectionStatus: () => 'internet',
}))

jest.mock('~helpers/agentObservability', () => ({
  appLogger: { captureError: (...args: unknown[]) => mockCaptureError(...args) },
}))

jest.mock('~helpers/cleanupRegistry', () => ({
  registerCleanup: jest.fn(),
}))

jest.mock('~helpers/firebase', () => ({
  firebaseDb: {},
  doc: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}))

jest.mock('~helpers/firestoreSubcollections', () => ({
  LIVE_SUBCOLLECTION_NAMES: ['bookmarks'],
  subscribeToSubcollection: (...args: unknown[]) => mockSubscribeToSubcollection(...args),
}))

let mockPendingEntries: unknown[] = []
jest.mock('~helpers/firestoreSyncOutbox', () => ({
  firestoreSyncOutbox: {
    getPending: () => mockPendingEntries,
    replay: jest.fn(async () => undefined),
    cancelReplay: jest.fn(),
    resumeReplay: jest.fn(),
  },
}))

jest.mock('~redux/modules/user', () => ({
  addStudies: (payload: unknown) => ({ type: 'user/add-studies', payload }),
  deleteStudy: (payload: unknown, options?: unknown) => ({
    type: 'user/delete-study',
    payload,
    meta: options,
  }),
  finishUserDataSync: () => ({ type: 'user/finish-sync' }),
  markUserDataSyncCollectionLoaded: (payload: unknown) => ({
    type: 'user/mark-loaded',
    payload,
  }),
  receiveLiveUpdates: (payload: unknown) => ({ type: 'user/receive-live', payload }),
  receiveSubcollectionUpdates: (payload: unknown) => ({
    type: 'user/receive-subcollection',
    payload,
  }),
  startUserDataSync: () => ({ type: 'user/start-sync' }),
  updateStudy: (payload: unknown, options?: unknown) => ({
    type: 'user/update-study',
    payload,
    meta: options,
  }),
}))

let mockLocalBible: Record<string, unknown> = {}
jest.mock('~redux/store', () => ({
  store: {
    getState: () => ({ user: { sync: { isLoading: false }, bible: mockLocalBible } }),
  },
}))

jest.mock('~state/migration', () => ({
  isMigrationInProgress: () => false,
}))

describe('useLiveUpdates account-entry gate', () => {
  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockSubcollectionOnChange = undefined
    mockPendingEntries = []
    mockLocalBible = {}
    mockHasStudies = false
    mockPreviousIsLogged = false
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('starts no migration or listener while account entry is gated', async () => {
    const runBeforeSync = jest.fn(async () => true)
    const Harness = ({ enabled }: { enabled: boolean }) => {
      useLiveUpdates({ enabled, runBeforeSync, resumeToken: 0 })
      return null
    }

    let renderer!: ReturnType<typeof create>
    await act(async () => {
      renderer = create(<Harness enabled={false} />)
    })

    expect(runBeforeSync).not.toHaveBeenCalled()
    expect(mockSubscribeToSubcollection).not.toHaveBeenCalled()
    expect(mockOnSnapshot).not.toHaveBeenCalled()

    await act(async () => {
      renderer.update(<Harness enabled />)
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(runBeforeSync).toHaveBeenCalledWith('user-1', expect.any(Object))
    expect(mockSubscribeToSubcollection).toHaveBeenCalledTimes(1)
    expect(mockSubscribeToSubcollection).toHaveBeenCalledWith(
      'user-1',
      'bookmarks',
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ includeMetadataChanges: true })
    )
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)

    await act(async () => {
      renderer.unmount()
    })
  })

  it('marks an initial cache snapshot as non-authoritative for Redux hydration', async () => {
    const runBeforeSync = jest.fn(async () => true)
    const Harness = ({ enabled }: { enabled: boolean }) => {
      useLiveUpdates({ enabled, runBeforeSync, resumeToken: 0 })
      return null
    }

    let renderer!: ReturnType<typeof create>
    await act(async () => {
      renderer = create(<Harness enabled={false} />)
    })
    await act(async () => {
      renderer.update(<Harness enabled />)
      await Promise.resolve()
    })

    act(() => {
      mockSubcollectionOnChange?.(
        {},
        {
          added: {},
          modified: {},
          removed: [],
          fromCache: true,
        }
      )
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'user/receive-subcollection',
      payload: expect.objectContaining({
        collection: 'bookmarks',
        isInitialLoad: true,
        fromCache: true,
      }),
    })

    await act(async () => {
      renderer.unmount()
    })
  })

  it('treats the first server snapshot as authoritative even without document changes', async () => {
    const runBeforeSync = jest.fn(async () => true)
    const Harness = () => {
      useLiveUpdates({ enabled: true, runBeforeSync, resumeToken: 0 })
      return null
    }

    let renderer!: ReturnType<typeof create>
    await act(async () => {
      renderer = create(<Harness />)
      await Promise.resolve()
    })

    act(() => {
      mockSubcollectionOnChange?.(
        { remote: { id: 'remote' } },
        {
          added: { remote: { id: 'remote' } },
          modified: {},
          removed: [],
          fromCache: true,
        }
      )
      mockSubcollectionOnChange?.(
        { remote: { id: 'remote' } },
        { added: {}, modified: {}, removed: [], fromCache: false }
      )
      mockSubcollectionOnChange?.(
        { remote: { id: 'remote' } },
        {
          added: { remote: { id: 'remote' } },
          modified: {},
          removed: [],
          fromCache: true,
          isFirstSnapshot: true,
        }
      )
      mockSubcollectionOnChange?.(
        { remote: { id: 'remote' } },
        {
          added: {},
          modified: {},
          removed: [],
          fromCache: false,
          isFirstSnapshot: false,
        }
      )
    })

    expect(mockDispatch).toHaveBeenLastCalledWith({
      type: 'user/receive-subcollection',
      payload: expect.objectContaining({
        collection: 'bookmarks',
        isInitialLoad: true,
        fromCache: false,
      }),
    })

    await act(async () => {
      renderer.unmount()
    })
  })

  it('takes study changes from another install without writing them back', async () => {
    mockHasStudies = true
    mockPreviousIsLogged = true
    const runBeforeSync = jest.fn(async () => true)
    const Harness = () => {
      useLiveUpdates({ enabled: true, runBeforeSync, resumeToken: 0 })
      return null
    }

    let renderer!: ReturnType<typeof create>
    await act(async () => {
      renderer = create(<Harness />)
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const onStudies = mockOnSnapshot.mock.calls[1]?.[1] as (snapshot: unknown) => void
    const studiesSnapshot = (changes: unknown[]) => ({
      metadata: { hasPendingWrites: false },
      forEach: jest.fn(),
      docChanges: () => changes,
    })
    const change = (type: string, id: string) => ({
      type,
      doc: { data: () => ({ id, title: 'Remote' }) },
    })
    act(() => {
      // The first snapshot repeats the studies already in the store.
      onStudies(studiesSnapshot([]))
      onStudies(
        studiesSnapshot([
          change('added', 'study-1'),
          change('modified', 'study-2'),
          change('removed', 'study-3'),
        ])
      )
    })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'user/update-study',
      payload: { id: 'study-1', title: 'Remote' },
      meta: { localOnly: true },
    })
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'user/update-study',
      payload: { id: 'study-2', title: 'Remote' },
      meta: { localOnly: true },
    })
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'user/delete-study',
      payload: 'study-3',
      meta: { localOnly: true },
    })

    await act(async () => {
      renderer.unmount()
    })
  })

  it('measures only the listeners when it reports a slow first sync', async () => {
    jest.useFakeTimers()
    const runBeforeSync = jest.fn(
      () => new Promise<boolean>(resolve => setTimeout(() => resolve(true), 20_000))
    )
    const Harness = () => {
      useLiveUpdates({ enabled: true, runBeforeSync, resumeToken: 0 })
      return null
    }

    let renderer!: ReturnType<typeof create>
    await act(async () => {
      renderer = create(<Harness />)
    })
    // A slow migration check is not a slow sync.
    await act(async () => {
      jest.advanceTimersByTime(20_000)
    })
    expect(mockCaptureError).not.toHaveBeenCalled()
    expect(mockSubscribeToSubcollection).toHaveBeenCalled()

    act(() => {
      mockSubcollectionOnChange?.(
        {},
        { added: {}, modified: {}, removed: [], fromCache: false, isFirstSnapshot: true }
      )
    })
    await act(async () => {
      jest.advanceTimersByTime(15_000)
    })

    expect(mockCaptureError).toHaveBeenCalledWith(
      'sync',
      'account_sync.initial_load_timeout',
      expect.any(Error),
      expect.objectContaining({
        accountMigrationDurationMs: 20_000,
        connectionStatus: 'internet',
        missingCollections: expect.arrayContaining(['studies']),
      })
    )
    const [, , , context] = mockCaptureError.mock.calls[0] as [
      string,
      string,
      Error,
      { missingCollections: string[] },
    ]
    expect(context.missingCollections).not.toContain('bookmarks')

    await act(async () => {
      renderer.unmount()
    })
    jest.useRealTimers()
  })

  it('stops waiting for a collection held back by local writes', async () => {
    const runBeforeSync = jest.fn(async () => true)
    const Harness = () => {
      useLiveUpdates({ enabled: true, runBeforeSync, resumeToken: 0 })
      return null
    }

    let renderer!: ReturnType<typeof create>
    await act(async () => {
      renderer = create(<Harness />)
      await Promise.resolve()
    })

    const options = mockSubscribeToSubcollection.mock.calls[0]?.[4] as {
      onPendingWrites: () => void
    }
    act(() => {
      options.onPendingWrites()
      options.onPendingWrites()
    })

    expect(
      mockDispatch.mock.calls.filter(([action]) => action.type === 'user/mark-loaded')
    ).toEqual([[{ type: 'user/mark-loaded', payload: { collection: 'bookmarks' } }]])

    await act(async () => {
      renderer.unmount()
    })
  })

  it('keeps a local document a queued write will still send', async () => {
    mockLocalBible = {
      bookmarks: { local: { id: 'local', name: 'Not sent yet' } },
      studies: { study: { id: 'study', title: 'Local edit' } },
    }
    mockPendingEntries = [
      {
        userId: 'user-1',
        intent: {
          kind: 'subcollection',
          collection: 'bookmarks',
          set: { local: { id: 'local' } },
          delete: ['gone'],
        },
      },
      {
        userId: 'user-1',
        intent: { kind: 'document-set', path: ['studies', 'study'], data: {}, merge: true },
      },
    ]
    const runBeforeSync = jest.fn(async () => true)
    const Harness = () => {
      useLiveUpdates({ enabled: true, runBeforeSync, resumeToken: 0 })
      return null
    }

    let renderer!: ReturnType<typeof create>
    await act(async () => {
      renderer = create(<Harness />)
      await Promise.resolve()
    })

    act(() => {
      mockSubcollectionOnChange?.(
        { remote: { id: 'remote' }, gone: { id: 'gone' } },
        {
          added: { remote: { id: 'remote' }, gone: { id: 'gone' } },
          modified: {},
          removed: [],
          fromCache: false,
          isFirstSnapshot: true,
        }
      )
    })
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'user/receive-subcollection',
      payload: expect.objectContaining({
        isInitialLoad: true,
        data: { remote: { id: 'remote' }, local: { id: 'local', name: 'Not sent yet' } },
        changes: { added: { remote: { id: 'remote' } }, modified: {}, removed: [] },
      }),
    })

    const onStudies = mockOnSnapshot.mock.calls[1]?.[1] as (snapshot: unknown) => void
    act(() => {
      onStudies({
        metadata: { hasPendingWrites: false },
        forEach: (callback: (doc: unknown) => void) =>
          callback({ data: () => ({ id: 'study', title: 'Server' }) }),
        docChanges: () => [],
      })
    })
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'user/add-studies',
      payload: { study: { id: 'study', title: 'Local edit' } },
    })

    await act(async () => {
      renderer.unmount()
    })
  })
})
