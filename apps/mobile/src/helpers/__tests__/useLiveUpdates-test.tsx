import React from 'react'
import { act, create } from 'react-test-renderer'

import useLiveUpdates from '~helpers/useLiveUpdates'

const mockDispatch = jest.fn()
const mockOnSnapshot = jest.fn(() => jest.fn())
let mockSubcollectionOnChange: ((data: unknown, changes: unknown) => void) | undefined
const mockSubscribeToSubcollection = jest.fn((...args: unknown[]) => {
  mockSubcollectionOnChange = args[2] as typeof mockSubcollectionOnChange
  return jest.fn()
})

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: () => false,
}))

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}))

jest.mock('~helpers/useLogin', () => ({
  __esModule: true,
  default: () => ({ isLogged: true, user: { id: 'user-1' } }),
}))

jest.mock('~helpers/usePrevious', () => ({
  usePrevious: () => false,
}))

jest.mock('~helpers/useConnection', () => ({
  useConnectionStatus: () => 'internet',
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
  onSnapshot: (..._args: unknown[]) => mockOnSnapshot(),
}))

jest.mock('~helpers/firestoreSubcollections', () => ({
  USER_DATA_SUBCOLLECTION_NAMES: ['bookmarks'],
  subscribeToSubcollection: (...args: unknown[]) => mockSubscribeToSubcollection(...args),
}))

jest.mock('~helpers/firestoreSyncOutbox', () => ({
  firestoreSyncOutbox: {
    replay: jest.fn(async () => undefined),
    cancelReplay: jest.fn(),
    resumeReplay: jest.fn(),
  },
}))

jest.mock('~redux/modules/user', () => ({
  addStudies: (payload: unknown) => ({ type: 'user/add-studies', payload }),
  deleteStudy: (payload: unknown) => ({ type: 'user/delete-study', payload }),
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
  updateStudy: (payload: unknown) => ({ type: 'user/update-study', payload }),
}))

jest.mock('~redux/store', () => ({
  store: {
    getState: () => ({ user: { sync: { isLoading: false } } }),
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
      { includeMetadataChanges: true }
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
})
