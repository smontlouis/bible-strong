import {
  createFirestoreSyncOutbox,
  decodeFirestoreSyncData,
  encodeFirestoreSyncData,
  runFirestoreSyncIntentsSerialized,
  type FirestoreSyncOutboxStorage,
} from '../firestoreSyncOutbox'

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }))
jest.mock('../firestoreSubcollections', () => ({ batchWriteSubcollection: jest.fn() }))
jest.mock('../firebase', () => ({
  firebaseDb: {},
  doc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  deleteField: jest.fn(() => ({ _type: 'delete' })),
}))
jest.mock('../storage', () => ({
  storage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}))

const createStorage = (): FirestoreSyncOutboxStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>()
  return {
    values,
    getString: key => values.get(key),
    set: (key, value) => values.set(key, value),
    remove: key => values.delete(key),
  }
}

describe('FirestoreSyncOutbox', () => {
  const noSchedule = () => 0

  it('persists failed work and replays it only for the owning account', async () => {
    const storage = createStorage()
    const execute = jest.fn(async () => undefined)
    const firstRuntime = createFirestoreSyncOutbox({
      storage,
      execute,
      now: () => 100,
      schedule: noSchedule,
    })
    firstRuntime.enqueue('user-1', {
      kind: 'document-set',
      path: ['studies', 'study-1'],
      data: { title: 'Persisted study' },
      merge: true,
    })

    const restoredRuntime = createFirestoreSyncOutbox({
      storage,
      execute,
      now: () => 100,
      schedule: noSchedule,
    })
    await restoredRuntime.replay('user-2')
    expect(execute).not.toHaveBeenCalled()

    await restoredRuntime.replay('user-1')
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        intent: expect.objectContaining({ path: ['studies', 'study-1'] }),
      })
    )
    expect(restoredRuntime.getPending('user-1')).toEqual([])
  })

  it('keeps a failed replay with an exponential retry deadline', async () => {
    const storage = createStorage()
    let now = 1_000
    const execute = jest.fn(async () => {
      throw new Error('unavailable')
    })
    const scheduled: (() => void)[] = []
    const outbox = createFirestoreSyncOutbox({
      storage,
      execute,
      now: () => now,
      schedule: callback => scheduled.push(callback),
    })
    outbox.enqueue('user-1', {
      kind: 'document-delete',
      path: ['studies', 'study-1'],
    })
    outbox.resumeReplay('user-1')

    await outbox.replay('user-1')
    expect(outbox.getPending('user-1')[0]).toEqual(
      expect.objectContaining({ attempts: 1, nextAttemptAt: 2_000 })
    )
    expect(scheduled.length).toBeGreaterThanOrEqual(1)

    await outbox.replay('user-1')
    expect(execute).toHaveBeenCalledTimes(1)

    now = 2_000
    await outbox.replay('user-1')
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('compacts later document intent for the same target', () => {
    const storage = createStorage()
    const outbox = createFirestoreSyncOutbox({
      storage,
      execute: async () => undefined,
      now: () => 100,
      schedule: noSchedule,
    })

    outbox.enqueue('user-1', {
      kind: 'document-set',
      path: ['studies', 'study-1'],
      data: { title: 'Old' },
      merge: true,
    })
    outbox.enqueue('user-1', {
      kind: 'document-delete',
      path: ['studies', 'study-1'],
    })

    expect(outbox.getPending('user-1')).toHaveLength(1)
    expect(outbox.getPending('user-1')[0].intent.kind).toBe('document-delete')
  })

  it('merges compatible updates targeting the same user document', () => {
    const storage = createStorage()
    const outbox = createFirestoreSyncOutbox({
      storage,
      execute: async () => undefined,
      now: () => 100,
      schedule: noSchedule,
    })

    outbox.enqueue('user-1', {
      kind: 'document-set',
      path: ['users', 'user-1'],
      data: { bible: { settings: { fontSizeScale: 1 } } },
      merge: true,
    })
    outbox.enqueue('user-1', {
      kind: 'document-set',
      path: ['users', 'user-1'],
      data: { plan: { reading: { day: 2 } } },
      merge: true,
    })

    expect(outbox.getPending('user-1')[0].intent).toEqual(
      expect.objectContaining({
        data: {
          bible: { settings: { fontSizeScale: 1 } },
          plan: { reading: { day: 2 } },
        },
      })
    )
  })

  it('replays different account queues independently', async () => {
    const storage = createStorage()
    let releaseUser1!: () => void
    const user1Blocked = new Promise<void>(resolve => {
      releaseUser1 = resolve
    })
    const execute = jest.fn(async entry => {
      if (entry.userId === 'user-1') await user1Blocked
    })
    const outbox = createFirestoreSyncOutbox({
      storage,
      execute,
      now: () => 100,
      schedule: noSchedule,
    })
    outbox.enqueue('user-1', { kind: 'document-delete', path: ['studies', 'one'] })
    outbox.enqueue('user-2', { kind: 'document-delete', path: ['studies', 'two'] })

    const replayUser1 = outbox.replay('user-1')
    await outbox.replay('user-2')

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-2' }))
    releaseUser1()
    await replayUser1
  })

  it('keeps a newer generation enqueued while an older generation is replaying', async () => {
    const storage = createStorage()
    let release!: () => void
    const blocked = new Promise<void>(resolve => {
      release = resolve
    })
    const execute = jest.fn(async () => blocked)
    const outbox = createFirestoreSyncOutbox({
      storage,
      execute,
      now: () => 100,
      schedule: noSchedule,
    })
    outbox.enqueue('user-1', {
      kind: 'document-set',
      path: ['users', 'user-1'],
      data: { value: 'old' },
      merge: true,
    })

    const replay = outbox.replay('user-1')
    await Promise.resolve()
    outbox.enqueue('user-1', {
      kind: 'document-set',
      path: ['users', 'user-1'],
      data: { value: 'new' },
      merge: true,
    })
    release()
    await replay

    expect(execute).toHaveBeenCalledTimes(1)
    expect(outbox.getPending('user-1')).toEqual([
      expect.objectContaining({
        generation: 2,
        intent: expect.objectContaining({ data: { value: 'new' } }),
      }),
    ])
  })

  it('round-trips delete sentinels through durable JSON storage', () => {
    const deleteSentinel = {
      _type: 'delete',
      isEqual(this: { _type: string }) {
        return this._type === 'delete'
      },
    }
    const encoded = encodeFirestoreSyncData({ nested: { obsolete: deleteSentinel } })
    const restored = JSON.parse(JSON.stringify(encoded))

    expect(decodeFirestoreSyncData(restored, () => 'DELETE')).toEqual({
      nested: { obsolete: 'DELETE' },
    })
  })

  it('treats an encoded delete as atomic when a later update recreates the object', () => {
    const storage = createStorage()
    const outbox = createFirestoreSyncOutbox({
      storage,
      execute: async () => undefined,
      now: () => 100,
      schedule: noSchedule,
    })
    outbox.enqueue('user-1', {
      kind: 'document-set',
      path: ['users', 'user-1'],
      data: { bible: { settings: { display: { _type: 'delete', isEqual: () => true } } } },
      merge: true,
    })
    outbox.enqueue('user-1', {
      kind: 'document-set',
      path: ['users', 'user-1'],
      data: { bible: { settings: { display: { mode: 'compact' } } } },
      merge: true,
    })

    expect(outbox.getPending('user-1')[0].intent).toEqual(
      expect.objectContaining({
        data: { bible: { settings: { display: { mode: 'compact' } } } },
      })
    )
  })

  it('does not reinterpret ordinary user JSON with a delete-shaped property', () => {
    expect(encodeFirestoreSyncData({ payload: { _type: 'delete', text: 'keep me' } })).toEqual({
      payload: { _type: 'delete', text: 'keep me' },
    })
  })

  it('serializes direct writes and replay writes targeting the same document', async () => {
    const intent = {
      kind: 'document-set' as const,
      path: ['users', 'user-1'],
      data: { value: 'old' },
      merge: true,
    }
    const events: string[] = []
    let release!: () => void
    const blocked = new Promise<void>(resolve => {
      release = resolve
    })

    const oldWrite = runFirestoreSyncIntentsSerialized('user-1', [intent], async () => {
      events.push('old:start')
      await blocked
      events.push('old:end')
    })
    await Promise.resolve()
    const newWrite = runFirestoreSyncIntentsSerialized(
      'user-1',
      [{ ...intent, data: { value: 'new' } }],
      async () => {
        events.push('new')
      }
    )

    await Promise.resolve()
    expect(events).toEqual(['old:start'])
    release()
    await Promise.all([oldWrite, newWrite])
    expect(events).toEqual(['old:start', 'old:end', 'new'])
  })

  it('does not reschedule an active replay after cancellation', async () => {
    const storage = createStorage()
    const scheduled: (() => void)[] = []
    let release!: () => void
    const blocked = new Promise<void>(resolve => {
      release = resolve
    })
    const outbox = createFirestoreSyncOutbox({
      storage,
      execute: async () => blocked.then(() => Promise.reject(new Error('offline'))),
      now: () => 100,
      schedule: callback => scheduled.push(callback),
      cancelScheduled: jest.fn(),
    })
    outbox.enqueue('user-1', {
      kind: 'document-delete',
      path: ['studies', 'study-1'],
    })
    outbox.resumeReplay('user-1')
    const replay = outbox.replay('user-1')
    await Promise.resolve()
    outbox.cancelReplay('user-1')
    release()
    await replay

    expect(scheduled).toHaveLength(1)
  })

  it('supersedes an older pending value after a newer direct write succeeds', () => {
    const storage = createStorage()
    const outbox = createFirestoreSyncOutbox({
      storage,
      execute: async () => undefined,
      now: () => 100,
      schedule: noSchedule,
    })
    const oldIntent = {
      kind: 'document-set' as const,
      path: ['users', 'user-1'],
      data: { bible: { settings: { theme: 'old' } } },
      merge: true,
    }
    const newIntent = {
      ...oldIntent,
      data: { bible: { settings: { theme: 'new' } } },
    }
    outbox.enqueue('user-1', oldIntent)

    outbox.supersedePending('user-1', newIntent)

    expect(outbox.getPending('user-1')[0].intent).toEqual(
      expect.objectContaining({ data: { bible: { settings: { theme: 'new' } } } })
    )
  })
})
