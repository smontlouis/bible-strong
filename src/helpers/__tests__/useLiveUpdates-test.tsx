import React from 'react'
import { act, create } from 'react-test-renderer'

import useLiveUpdates from '~helpers/useLiveUpdates'

const mockDispatch = jest.fn()
const mockOnSnapshot = jest.fn(() => jest.fn())
const mockSubscribeToSubcollection = jest.fn(() => jest.fn())

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
  subscribeToSubcollection: (..._args: unknown[]) => mockSubscribeToSubcollection(),
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
      await Promise.resolve()
    })

    expect(runBeforeSync).toHaveBeenCalledWith('user-1', expect.any(Object))
    expect(mockSubscribeToSubcollection).toHaveBeenCalledTimes(1)
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2)

    await act(async () => {
      renderer.unmount()
    })
  })
})
