import { createKeyedPersistStorage } from '../keyedPersistStorage'

const createBackend = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial))
  return {
    values,
    getString: jest.fn((key: string) => values.get(key)),
    set: jest.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    remove: jest.fn((key: string) => values.delete(key)),
  }
}

type Backend = ReturnType<typeof createBackend>

const writtenKeys = (backend: Backend) => backend.set.mock.calls.map(([key]) => key)

// The format redux-persist wrote with its default serializer: a JSON object of JSON strings.
const legacyValue = (state: Record<string, unknown>) =>
  JSON.stringify(
    Object.fromEntries(Object.entries(state).map(([key, value]) => [key, JSON.stringify(value)]))
  )

const myPlans = [{ id: 'plan-1', sections: [{ id: 'section-1', readingSlices: [] }] }]
const ongoingPlans = [{ id: 'plan-1', status: 'Progress', readingSlices: {} }]
const persistedState = () => ({
  myPlans,
  ongoingPlans,
  images: { 'plan-1': 'data' },
  _persist: { version: -1, rehydrated: true },
})

describe('createKeyedPersistStorage', () => {
  it('stores each key on its own with an index, and reads them back after a relaunch', async () => {
    const backend = createBackend()
    await createKeyedPersistStorage(backend).setItem('plan', persistedState())

    expect(JSON.parse(backend.values.get('plan:keys')!)).toEqual([
      'myPlans',
      'ongoingPlans',
      'images',
      '_persist',
    ])
    expect(JSON.parse(backend.values.get('plan:myPlans')!)).toEqual(myPlans)
    expect(JSON.parse(backend.values.get('plan:ongoingPlans')!)).toEqual(ongoingPlans)
    expect(backend.values.has('plan')).toBe(false)

    await expect(createKeyedPersistStorage(backend).getItem('plan')).resolves.toEqual(
      persistedState()
    )
  })

  it('reads nothing when nothing is stored', async () => {
    await expect(createKeyedPersistStorage(createBackend()).getItem('plan')).resolves.toBe(
      undefined
    )
  })

  it('writes only the keys whose value changed, in the object redux-persist keeps changing', async () => {
    const backend = createBackend()
    const keyedStorage = createKeyedPersistStorage(backend)
    const stagedState: Record<string, unknown> = persistedState()
    await keyedStorage.setItem('plan', stagedState)
    backend.set.mockClear()

    stagedState.ongoingPlans = [{ ...ongoingPlans[0], readingSlices: { 'slice-1': 'Completed' } }]
    await keyedStorage.setItem('plan', stagedState)

    expect(writtenKeys(backend)).toEqual(['plan:ongoingPlans'])
    expect(JSON.parse(backend.values.get('plan:ongoingPlans')!)).toEqual([
      { id: 'plan-1', status: 'Progress', readingSlices: { 'slice-1': 'Completed' } },
    ])
  })

  it('does not write the restored values again at the first write after a launch', async () => {
    const backend = createBackend()
    await createKeyedPersistStorage(backend).setItem('plan', persistedState())
    backend.set.mockClear()

    const keyedStorage = createKeyedPersistStorage(backend)
    const restored = await keyedStorage.getItem('plan')
    await keyedStorage.setItem('plan', {
      ...restored,
      _persist: { version: -1, rehydrated: true },
    })

    expect(writtenKeys(backend)).toEqual(['plan:_persist'])
  })

  it('removes the keys that left the state', async () => {
    const backend = createBackend()
    const keyedStorage = createKeyedPersistStorage(backend)
    await keyedStorage.setItem('plan', persistedState())

    const { images: _images, ...withoutImages } = persistedState()
    await keyedStorage.setItem('plan', withoutImages)

    expect(backend.values.has('plan:images')).toBe(false)
    expect(JSON.parse(backend.values.get('plan:keys')!)).toEqual([
      'myPlans',
      'ongoingPlans',
      '_persist',
    ])
    await expect(createKeyedPersistStorage(backend).getItem('plan')).resolves.toEqual(withoutImages)
  })

  it('keeps the other keys when one stored value is unreadable, and writes it again', async () => {
    const backend = createBackend()
    await createKeyedPersistStorage(backend).setItem('plan', persistedState())
    backend.values.set('plan:images', '{not json')

    const keyedStorage = createKeyedPersistStorage(backend)
    const restored = (await keyedStorage.getItem('plan')) as Record<string, unknown>
    expect(restored).toEqual({
      myPlans,
      ongoingPlans,
      _persist: { version: -1, rehydrated: true },
    })

    backend.set.mockClear()
    await keyedStorage.setItem('plan', { ...restored, images: {} })
    expect(writtenKeys(backend)).toEqual(['plan:images'])
    expect(backend.values.get('plan:images')).toBe('{}')
  })

  it('keeps writing the other keys when one write fails, and tries that one again later', async () => {
    const backend = createBackend()
    const keyedStorage = createKeyedPersistStorage(backend)
    const stagedState: Record<string, unknown> = persistedState()
    await keyedStorage.setItem('plan', stagedState)

    backend.set.mockImplementationOnce(() => {
      throw new Error('No space left')
    })
    const nextPlans = [...myPlans, { id: 'plan-2', sections: [] }]
    const nextProgress = [{ ...ongoingPlans[0], readingSlices: { 'slice-1': 'Completed' } }]
    stagedState.myPlans = nextPlans
    stagedState.ongoingPlans = nextProgress
    await expect(keyedStorage.setItem('plan', stagedState)).rejects.toThrow('No space left')

    // The progress is stored; the plans keep their last stored value.
    expect(JSON.parse(backend.values.get('plan:ongoingPlans')!)).toEqual(nextProgress)
    expect(JSON.parse(backend.values.get('plan:myPlans')!)).toEqual(myPlans)

    backend.set.mockClear()
    await keyedStorage.setItem('plan', stagedState)
    expect(writtenKeys(backend)).toEqual(['plan:myPlans'])
    expect(JSON.parse(backend.values.get('plan:myPlans')!)).toEqual(nextPlans)
  })

  describe('former single-key format', () => {
    it('moves it to the new keys and removes it once they are written', async () => {
      const backend = createBackend({ plan: legacyValue(persistedState()) })

      await expect(createKeyedPersistStorage(backend).getItem('plan')).resolves.toEqual(
        persistedState()
      )

      expect(backend.values.has('plan')).toBe(false)
      expect(JSON.parse(backend.values.get('plan:myPlans')!)).toEqual(myPlans)
      expect(JSON.parse(backend.values.get('plan:ongoingPlans')!)).toEqual(ongoingPlans)
      const indexWrite = backend.set.mock.calls.findIndex(([key]) => key === 'plan:keys')
      const legacyRemoval = backend.remove.mock.calls.findIndex(([key]) => key === 'plan')
      expect(backend.set.mock.invocationCallOrder[indexWrite]).toBeLessThan(
        backend.remove.mock.invocationCallOrder[legacyRemoval]
      )

      await expect(createKeyedPersistStorage(backend).getItem('plan')).resolves.toEqual(
        persistedState()
      )
    })

    it('does not write the moved values again at the first write after the move', async () => {
      const backend = createBackend({ plan: legacyValue(persistedState()) })
      const keyedStorage = createKeyedPersistStorage(backend)
      const restored = await keyedStorage.getItem('plan')
      backend.set.mockClear()

      await keyedStorage.setItem('plan', {
        ...restored,
        _persist: { version: -1, rehydrated: true },
      })

      expect(writtenKeys(backend)).toEqual(['plan:_persist'])
    })

    it('does the move again when it stopped before the index was written', async () => {
      const backend = createBackend({
        plan: legacyValue(persistedState()),
        'plan:myPlans': JSON.stringify(myPlans),
      })

      await expect(createKeyedPersistStorage(backend).getItem('plan')).resolves.toEqual(
        persistedState()
      )
      expect(backend.values.has('plan')).toBe(false)
      expect(backend.values.has('plan:keys')).toBe(true)
    })

    it('reads the new keys and removes it when it was left after the index was written', async () => {
      const backend = createBackend()
      await createKeyedPersistStorage(backend).setItem('plan', persistedState())
      backend.values.set('plan', legacyValue({ ...persistedState(), ongoingPlans: [] }))

      await expect(createKeyedPersistStorage(backend).getItem('plan')).resolves.toEqual(
        persistedState()
      )
      expect(backend.values.has('plan')).toBe(false)
    })

    it('still restores the state and keeps the former value when the move cannot be written', async () => {
      const backend = createBackend({ plan: legacyValue(persistedState()) })
      backend.set.mockImplementation((key: string, value: string) => {
        if (key === 'plan:myPlans') throw new Error('No space left')
        backend.values.set(key, value)
      })
      const keyedStorage = createKeyedPersistStorage(backend)

      const restored = await keyedStorage.getItem('plan')

      expect(restored).toEqual(persistedState())
      expect(backend.values.has('plan')).toBe(true)
      expect(backend.values.has('plan:keys')).toBe(false)

      // Once a write succeeds, the move is complete.
      backend.set.mockImplementation((key: string, value: string) => {
        backend.values.set(key, value)
      })
      backend.set.mockClear()
      await keyedStorage.setItem('plan', restored)
      expect(writtenKeys(backend)).toEqual(['plan:myPlans', 'plan:keys'])
      expect(backend.values.has('plan')).toBe(false)
      await expect(createKeyedPersistStorage(backend).getItem('plan')).resolves.toEqual(
        persistedState()
      )
    })

    it('rejects an unreadable former value, then replaces it at the first write', async () => {
      const backend = createBackend({ plan: '{not json' })
      const keyedStorage = createKeyedPersistStorage(backend)

      await expect(keyedStorage.getItem('plan')).rejects.toThrow()
      expect(backend.values.has('plan')).toBe(true)

      await keyedStorage.setItem('plan', persistedState())
      expect(backend.values.has('plan')).toBe(false)
      await expect(createKeyedPersistStorage(backend).getItem('plan')).resolves.toEqual(
        persistedState()
      )
    })
  })

  it('removes every key, the index and a former value, then writes everything again', async () => {
    const backend = createBackend({ other: 'kept' })
    const keyedStorage = createKeyedPersistStorage(backend)
    const stagedState = persistedState()
    await keyedStorage.setItem('plan', stagedState)
    backend.values.set('plan', legacyValue(stagedState))

    await keyedStorage.removeItem('plan')

    expect(Array.from(backend.values.keys())).toEqual(['other'])
    await expect(createKeyedPersistStorage(backend).getItem('plan')).resolves.toBe(undefined)

    await keyedStorage.setItem('plan', stagedState)
    await expect(createKeyedPersistStorage(backend).getItem('plan')).resolves.toEqual(
      persistedState()
    )
  })

  it('removes the stored keys even when nothing was read or written in this launch', async () => {
    const backend = createBackend()
    await createKeyedPersistStorage(backend).setItem('plan', persistedState())

    await createKeyedPersistStorage(backend).removeItem('plan')

    expect(backend.values.size).toBe(0)
  })

  it('refuses a state key that would overwrite the index', async () => {
    const backend = createBackend()

    await expect(createKeyedPersistStorage(backend).setItem('plan', { keys: [] })).rejects.toThrow(
      'reserved'
    )
    expect(backend.set).not.toHaveBeenCalled()
  })
})
