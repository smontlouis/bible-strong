const mockInvoke = jest.fn()

jest.mock('~desktop/bridge', () => ({
  desktopBootstrap: () => ({ kv: { root: '{"a":1}', flag: 'true', count: '3' } }),
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))
jest.mock('../agentObservability', () => ({ appLogger: { captureError: jest.fn() } }))

const load = () => {
  let loaded: typeof import('../storage.desktop') | undefined
  jest.isolateModules(() => {
    loaded = require('../storage.desktop')
  })
  return loaded!
}

describe('desktop key-value store', () => {
  beforeEach(() => mockInvoke.mockReset())

  it('reads the snapshot synchronously', () => {
    const { storage } = load()
    expect(storage.getString('root')).toBe('{"a":1}')
    expect(storage.getBoolean('flag')).toBe(true)
    expect(storage.getNumber('count')).toBe(3)
    expect(storage.getString('missing')).toBeUndefined()
  })

  it('sends writes in order, batching those made while one is in flight', async () => {
    let release!: () => void
    mockInvoke.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          release = resolve
        })
    )
    mockInvoke.mockResolvedValue(undefined)
    const { storage, flushStorage } = load()

    storage.set('a', 1)
    await Promise.resolve()
    expect(mockInvoke).toHaveBeenCalledTimes(1)
    storage.set('b', true)
    storage.remove('a')
    storage.set('c', 'x')
    expect(storage.getString('a')).toBeUndefined()
    release()
    await flushStorage()

    expect(mockInvoke.mock.calls).toEqual([
      ['kv_apply', { ops: [{ op: 'set', key: 'a', value: '1' }] }],
      [
        'kv_apply',
        {
          ops: [
            { op: 'set', key: 'b', value: 'true' },
            { op: 'remove', key: 'a' },
            { op: 'set', key: 'c', value: 'x' },
          ],
        },
      ],
    ])
  })

  it('keeps failed writes for the next batch', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('disk')).mockResolvedValue(undefined)
    const { storage, flushStorage } = load()
    storage.set('a', 'x')
    await flushStorage()
    expect(mockInvoke).toHaveBeenLastCalledWith('kv_apply', {
      ops: [{ op: 'set', key: 'a', value: 'x' }],
    })
  })
})
