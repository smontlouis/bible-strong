import { applySidebarDrop } from '../sidebarDragDrop'
import React, { act } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { getDefaultStore } from 'jotai/vanilla'
import { tabGroupsAtom, type TabGroup } from '../tabs'
import { cleanupTabGroupsSubscription, useTabGroupsSync } from '../useTabGroupsSync'
import {
  subscribeToSubcollection,
  writeToSubcollection,
  deleteFromSubcollection,
  fetchSubcollection,
} from '~helpers/firestoreSubcollections'
import { recordAccountMigrationPreferredDocuments } from '../../migrations/accountMigrationMutationJournal'
import { isMigrationInProgress } from '../migration'
import { firestoreSyncOutbox } from '~helpers/firestoreSyncOutbox'

jest.mock('../tabs', () => {
  const { atom } = jest.requireActual('jotai/vanilla')
  return {
    tabGroupsAtom: atom([]),
    activeGroupIdAtom: atom('default'),
    appSwitcherModeAtom: atom('view'),
    DEFAULT_GROUP_ID: 'default',
  }
})
jest.mock('../app', () => ({
  resetTabAnimationTriggerAtom: jest.requireActual('jotai/vanilla').atom(0),
}))
jest.mock('../migration', () => ({ isMigrationInProgress: jest.fn(() => false) }))
jest.mock('~helpers/useLogin', () => ({
  __esModule: true,
  default: () => ({ isLogged: true, user: { id: 'test-user' } }),
}))
jest.mock('~helpers/cleanupRegistry', () => ({ registerCleanup: jest.fn() }))
jest.mock('~helpers/storage', () => ({ storage: { getBoolean: () => true } }))
jest.mock('~helpers/firestoreSubcollections', () => ({
  fetchSubcollection: jest.fn(async () => ({})),
  subscribeToSubcollection: jest.fn(() => () => {}),
  writeToSubcollection: jest.fn(async () => {}),
  deleteFromSubcollection: jest.fn(async () => {}),
}))
jest.mock('~helpers/firestoreSyncOutbox', () => ({
  firestoreSyncOutbox: {
    supersedePending: jest.fn(),
    enqueue: jest.fn(),
    getPending: jest.fn(() => []),
  },
  runFirestoreSyncIntentsSerialized: async (
    _uid: string,
    _intents: unknown,
    run: () => Promise<void>
  ) => run(),
}))
jest.mock('../../migrations/accountMigrationMutationJournal', () => ({
  recordAccountMigrationDeletedDocuments: jest.fn(),
  recordAccountMigrationPreferredDocuments: jest.fn(),
}))
const makeGroup = (ids: string[], id = 'default'): TabGroup => ({
  id,
  name: id,
  isDefault: id === 'default',
  activeTabIndex: 0,
  createdAt: 1,
  updatedAt: Date.now(),
  tabs: ids.map(tabId => ({ id: tabId, title: tabId, type: 'new', data: {}, isRemovable: true })),
})
function Probe({ incomingEnabled = true, outgoingEnabled = true } = {}) {
  useTabGroupsSync({ incomingEnabled, outgoingEnabled })
  return null
}
const store = getDefaultStore()
let root: ReactTestRenderer
const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}
const local = async (...groups: TabGroup[]) => {
  await act(async () => {
    store.set(tabGroupsAtom, groups)
  })
}
const receive = async (...groups: TabGroup[]) => {
  const callback = jest.mocked(subscribeToSubcollection).mock.calls[0][2]
  await act(async () => {
    callback(Object.fromEntries(groups.map(g => [g.id, g])), {
      added: {},
      modified: {},
      removed: [],
      fromCache: false,
      isFirstSnapshot: false,
    })
  })
}
beforeEach(async () => {
  jest.useFakeTimers()
  jest.setSystemTime(100000)
  jest.clearAllMocks()
  jest.mocked(isMigrationInProgress).mockReturnValue(false)
  jest.mocked(firestoreSyncOutbox.getPending).mockReturnValue([])
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  store.set(tabGroupsAtom, [makeGroup(['a']), makeGroup(['x'], 'other')])
  await act(async () => {
    root = create(<Probe />)
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  jest.useRealTimers()
})

test('sends a close immediately following an incoming open, without echoing the snapshot', async () => {
  await receive(makeGroup(['a', 'b']), makeGroup(['x'], 'other'))
  await advance(200)
  expect(writeToSubcollection).not.toHaveBeenCalled()
  await local(makeGroup(['a']), makeGroup(['x'], 'other'))
  await advance(1000)
  expect(writeToSubcollection).toHaveBeenCalledWith(
    'test-user',
    'tabGroups',
    'default',
    expect.objectContaining({ tabs: [expect.objectContaining({ id: 'a' })] })
  )
})

test('coalesces rapid edits across different groups without losing the earlier group', async () => {
  const other = store.get(tabGroupsAtom)[1]
  const first = makeGroup(['a', 'b'])
  await local(first, other)
  await advance(200)
  await local(first, makeGroup(['x', 'y'], 'other'))
  await advance(1000)
  expect(
    jest
      .mocked(writeToSubcollection)
      .mock.calls.map(call => call[2])
      .sort()
  ).toEqual(['default', 'other'])
})

test('keeps a close queued while the preceding write is in flight', async () => {
  let finish!: () => void
  jest.mocked(writeToSubcollection).mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        finish = resolve
      })
  )
  const other = store.get(tabGroupsAtom)[1]
  await local(makeGroup(['a', 'b']), other)
  await advance(1000)
  await local(makeGroup(['a']), other)
  await advance(1000)
  await act(async () => finish())
  await advance(1000)
  expect(writeToSubcollection).toHaveBeenLastCalledWith(
    'test-user',
    'tabGroups',
    'default',
    expect.objectContaining({ tabs: [expect.objectContaining({ id: 'a' })] })
  )
  expect(writeToSubcollection).toHaveBeenCalledTimes(2)
})

test('receives other groups without overwriting a pending local edit or extending its debounce', async () => {
  await local(makeGroup(['a', 'b']), store.get(tabGroupsAtom)[1])
  await advance(500)
  await receive(makeGroup(['a']), makeGroup(['x', 'y'], 'other'))
  expect(store.get(tabGroupsAtom)[0].tabs.map(t => t.id)).toEqual(['a', 'b'])
  expect(store.get(tabGroupsAtom)[1].tabs.map(t => t.id)).toEqual(['x', 'y'])
  await advance(500)
  expect(writeToSubcollection).toHaveBeenCalledTimes(1)
})

test('does not resurrect a group deleted before its delayed write', async () => {
  await local(store.get(tabGroupsAtom)[0], makeGroup(['x', 'y'], 'other'))
  await local(store.get(tabGroupsAtom)[0])
  await advance(2000)
  expect(deleteFromSubcollection).toHaveBeenCalledWith('test-user', 'tabGroups', 'other')
  expect(jest.mocked(writeToSubcollection).mock.calls.some(call => call[2] === 'other')).toBe(false)
})

test('hands failed writes to the persistent retry outbox', async () => {
  jest.mocked(writeToSubcollection).mockRejectedValueOnce(new Error('offline'))
  await local(makeGroup(['a', 'b']), store.get(tabGroupsAtom)[1])
  await advance(1000)
  expect(firestoreSyncOutbox.enqueue).toHaveBeenCalledWith(
    'test-user',
    expect.objectContaining({
      collection: 'tabGroups',
      set: expect.objectContaining({ default: expect.anything() }),
    })
  )
})

test('never echoes a received snapshot back to Firestore', async () => {
  await receive(makeGroup(['a', 'b']), makeGroup(['x', 'y'], 'other'))
  await advance(5000)
  expect(writeToSubcollection).not.toHaveBeenCalled()
  expect(deleteFromSubcollection).not.toHaveBeenCalled()
})

test('records a local action even when it shares a React batch with the incoming snapshot', async () => {
  const callback = jest.mocked(subscribeToSubcollection).mock.calls[0][2]
  await act(async () => {
    callback(
      { default: makeGroup(['a', 'b']) },
      {
        added: {},
        modified: {},
        removed: [],
        fromCache: false,
        isFirstSnapshot: false,
      }
    )
    store.set(tabGroupsAtom, [makeGroup(['a']), store.get(tabGroupsAtom)[1]])
  })
  await advance(1000)
  expect(writeToSubcollection).toHaveBeenCalledTimes(1)
})

test('accepts another group update during a slow outgoing write', async () => {
  let finish!: () => void
  jest.mocked(writeToSubcollection).mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        finish = resolve
      })
  )
  await local(makeGroup(['a', 'b']), store.get(tabGroupsAtom)[1])
  await advance(1000)
  await receive(makeGroup(['a']), makeGroup(['x', 'y'], 'other'))
  expect(store.get(tabGroupsAtom)[0].tabs.map(t => t.id)).toEqual(['a', 'b'])
  expect(store.get(tabGroupsAtom)[1].tabs.map(t => t.id)).toEqual(['x', 'y'])
  await act(async () => finish())
  await advance(1000)
  expect(writeToSubcollection).toHaveBeenCalledTimes(1)
})

test('queues a group deletion behind an in-flight write', async () => {
  let finish!: () => void
  jest.mocked(writeToSubcollection).mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        finish = resolve
      })
  )
  await local(store.get(tabGroupsAtom)[0], makeGroup(['x', 'y'], 'other'))
  await advance(1000)
  await local(store.get(tabGroupsAtom)[0])
  await receive(makeGroup(['a']), makeGroup(['x', 'y'], 'other'))
  expect(store.get(tabGroupsAtom).map(g => g.id)).toEqual(['default'])
  await act(async () => finish())
  expect(deleteFromSubcollection).toHaveBeenCalledWith('test-user', 'tabGroups', 'other')
})

test('keeps changes pending until a running migration finishes', async () => {
  jest.mocked(isMigrationInProgress).mockReturnValue(true)
  await local(makeGroup(['a', 'b']), store.get(tabGroupsAtom)[1])
  await advance(1000)
  expect(writeToSubcollection).not.toHaveBeenCalled()
  jest.mocked(isMigrationInProgress).mockReturnValue(false)
  await advance(1000)
  expect(writeToSubcollection).toHaveBeenCalledTimes(1)
})

test('logout persists pending changes and stops observing account data before its reset', async () => {
  await local(makeGroup(['a', 'b']), store.get(tabGroupsAtom)[1])
  cleanupTabGroupsSubscription()
  expect(firestoreSyncOutbox.enqueue).toHaveBeenCalledWith(
    'test-user',
    expect.objectContaining({ set: expect.objectContaining({ default: expect.anything() }) })
  )
  await local(makeGroup(['guest']))
  await advance(5000)
  expect(writeToSubcollection).not.toHaveBeenCalled()
  expect(deleteFromSubcollection).not.toHaveBeenCalled()
  expect(firestoreSyncOutbox.enqueue).toHaveBeenCalledTimes(1)
})

test('finishing an old write after logout cannot replace the newer saved close', async () => {
  let finish!: () => void
  jest.mocked(writeToSubcollection).mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        finish = resolve
      })
  )
  await local(makeGroup(['a', 'b']), store.get(tabGroupsAtom)[1])
  await advance(1000)
  await local(makeGroup(['a']), store.get(tabGroupsAtom)[1])
  cleanupTabGroupsSubscription()
  await act(async () => finish())
  expect(firestoreSyncOutbox.supersedePending).toHaveBeenLastCalledWith(
    'test-user',
    expect.objectContaining({
      set: expect.objectContaining({
        default: expect.objectContaining({ tabs: [expect.objectContaining({ id: 'a' })] }),
      }),
    })
  )
})

test('protects local changes already held by the durable retry queue', async () => {
  jest.mocked(firestoreSyncOutbox.getPending).mockReturnValue([
    {
      id: 'retry',
      userId: 'test-user',
      createdAt: 1,
      attempts: 1,
      nextAttemptAt: 1,
      generation: 1,
      intent: { kind: 'subcollection', collection: 'tabGroups', set: { default: {} }, delete: [] },
    },
  ])
  await receive(makeGroup(['a', 'remote']), makeGroup(['x', 'y'], 'other'))
  expect(store.get(tabGroupsAtom)[0].tabs.map(t => t.id)).toEqual(['a'])
  expect(store.get(tabGroupsAtom)[1].tabs.map(t => t.id)).toEqual(['x', 'y'])
  await advance(5000)
  expect(writeToSubcollection).not.toHaveBeenCalled()
})

test('keeps active-tab navigation local and does not postpone a pending content write', async () => {
  const other = store.get(tabGroupsAtom)[1]
  await local(makeGroup(['a', 'b']), other)
  await advance(500)
  await local({ ...store.get(tabGroupsAtom)[0], activeTabIndex: 1 }, other)
  await advance(500)
  expect(writeToSubcollection).toHaveBeenCalledTimes(1)
  expect(store.get(tabGroupsAtom)[0].activeTabIndex).toBe(1)
})

test('outgoing-only migration mode writes immediately and records local ownership', async () => {
  await act(async () => {
    root.update(<Probe incomingEnabled={false} />)
  })
  await local(makeGroup(['a', 'b']), store.get(tabGroupsAtom)[1])
  expect(writeToSubcollection).toHaveBeenCalledTimes(1)
  expect(recordAccountMigrationPreferredDocuments).toHaveBeenCalledWith('test-user', 'tabGroups', [
    'default',
  ])
})

test('does not write local changes while outgoing sync is disabled', async () => {
  await act(async () => {
    root.update(<Probe outgoingEnabled={false} />)
  })
  await local(makeGroup(['a', 'b']), store.get(tabGroupsAtom)[1])
  await advance(5000)
  expect(writeToSubcollection).not.toHaveBeenCalled()
})

test('a delayed initial fetch cannot erase a local action waiting to be sent', async () => {
  let finish!: (data: Record<string, TabGroup>) => void
  jest.mocked(fetchSubcollection).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve
      })
  )
  await act(async () => {
    root.update(<Probe outgoingEnabled={false} />)
  })
  // Start the delayed load with normal outgoing tracking enabled.
  jest.mocked(fetchSubcollection).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve
      })
  )
  await act(async () => {
    root.update(<Probe />)
  })
  await local(makeGroup(['a', 'b']), store.get(tabGroupsAtom)[1])
  await act(async () => {
    finish({ default: { ...makeGroup(['a']), updatedAt: Date.now() + 1000 } })
  })
  expect(store.get(tabGroupsAtom)[0].tabs.map(t => t.id)).toEqual(['a', 'b'])
  await advance(1000)
  expect(writeToSubcollection).toHaveBeenCalledTimes(1)
})

test('sends a dragged group order and restores it from an unordered Firestore snapshot', async () => {
  await receive(makeGroup(['a']), makeGroup(['x'], 'other'), makeGroup(['y'], 'third'))
  const result = applySidebarDrop(
    store.get(tabGroupsAtom),
    'default',
    { kind: 'group', groupId: 'third' },
    { groupId: 'other', edge: 'before' }
  )!
  await local(...result.groups)
  await advance(1000)
  expect(writeToSubcollection).toHaveBeenCalledTimes(3)
  const published = jest.mocked(writeToSubcollection).mock.calls.map(call => call[3])
  // Snapshot document order is unrelated to the user's sidebar order.
  const callback = jest.mocked(subscribeToSubcollection).mock.calls[0][2]
  await act(async () => {
    callback(Object.fromEntries(published.reverse().map(group => [group.id, group])), {
      added: {},
      modified: {},
      removed: [],
      fromCache: false,
      isFirstSnapshot: false,
    })
  })
  expect(store.get(tabGroupsAtom).map(group => group.id)).toEqual(['default', 'third', 'other'])
  await advance(2000)
  expect(writeToSubcollection).toHaveBeenCalledTimes(3)
})
