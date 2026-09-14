import { selectDailyCollection } from '../selectDailyCollection'

const setup = () => {
  let snapshot: { owner: string; collectionId: string | null } = {
    owner: 'alice',
    collectionId: null,
  }
  let active = true
  const listeners = new Set<() => void>()
  let finish!: () => void
  let fail!: (reason: Error) => void
  const download = new Promise<void>((resolve, reject) => {
    finish = resolve
    fail = reject
  })
  const commit = jest.fn()
  const request = selectDailyCollection({
    read: () => snapshot,
    subscribe: listener => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    prepare: () => download,
    isActive: () => active,
    commit,
  })
  return {
    request,
    commit,
    finish,
    fail,
    listeners,
    leave: () => {
      active = false
    },
    change: (next: Partial<typeof snapshot>) => {
      snapshot = { ...snapshot, ...next }
      listeners.forEach(listener => listener())
    },
  }
}

it('selects only after content is available and releases its subscription', async () => {
  const test = setup()
  expect(test.commit).not.toHaveBeenCalled()
  test.finish()
  expect(await test.request).toBe('selected')
  expect(test.commit).toHaveBeenCalledTimes(1)
  expect(test.listeners.size).toBe(0)
})
it('does not overwrite a preference changed while downloading', async () => {
  const test = setup()
  test.change({ collectionId: 'newer-choice' })
  test.finish()
  expect(await test.request).toBe('cancelled')
  expect(test.commit).not.toHaveBeenCalled()
})
it('invalidates even when logout and login return to the original owner', async () => {
  const test = setup()
  test.change({ owner: '' })
  test.change({ owner: 'alice' })
  test.finish()
  expect(await test.request).toBe('cancelled')
  expect(test.commit).not.toHaveBeenCalled()
})
it('does not select after leaving the collection details', async () => {
  const test = setup()
  test.leave()
  test.finish()
  expect(await test.request).toBe('cancelled')
  expect(test.commit).not.toHaveBeenCalled()
})
it('leaves the preference unchanged after a download error', async () => {
  const test = setup()
  test.fail(new Error('offline'))
  expect(await test.request).toBe('failed')
  expect(test.commit).not.toHaveBeenCalled()
  expect(test.listeners.size).toBe(0)
})
it('does not report an obsolete download failure against another account', async () => {
  const test = setup()
  test.change({ owner: 'bob' })
  test.fail(new Error('offline'))
  expect(await test.request).toBe('cancelled')
  expect(test.commit).not.toHaveBeenCalled()
})
