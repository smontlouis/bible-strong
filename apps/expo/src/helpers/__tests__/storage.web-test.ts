import type { DurableStore, StorageOp, WebStorageEnvironment } from '../storage.web'

describe('web storage', () => {
  beforeEach(() => {
    jest.resetModules()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: (() => {
        const values = new Map<string, string>()
        return {
          clear: () => values.clear(),
          getItem: (key: string) => values.get(key) ?? null,
          removeItem: (key: string) => values.delete(key),
          setItem: (key: string, value: string) => values.set(key, value),
        }
      })(),
    })
  })

  it('persists synchronous values and exposes the Redux persistence adapter', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage, storage } = require('../storage.web') as typeof import('../storage.web')

    storage.set('theme', 'night')
    storage.set('onboarding', true)
    storage.set('fontSize', 18)

    expect(storage.getString('theme')).toBe('night')
    expect(storage.getBoolean('onboarding')).toBe(true)
    expect(storage.getNumber('fontSize')).toBe(18)

    await mmkvStorage.setItem('root', '{"ready":true}')
    expect(await mmkvStorage.getItem('root')).toBe('{"ready":true}')

    storage.remove('theme')
    expect(storage.getString('theme')).toBeUndefined()
  })

  it('falls back to memory when localStorage is unavailable', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => undefined,
    })
    jest.resetModules()

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { storage } = require('../storage.web') as typeof import('../storage.web')

    storage.set('theme', 'night')
    expect(storage.getString('theme')).toBe('night')
    storage.remove('theme')
    expect(storage.getString('theme')).toBeUndefined()
  })
})

const fakeLocalStorage = (entries: Record<string, string> = {}) => {
  const values = new Map(Object.entries(entries))
  return {
    values,
    get length() {
      return values.size
    },
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  } as unknown as globalThis.Storage & { values: Map<string, string> }
}

const fakeDurable = (entries: Record<string, string> = {}) => {
  const values = new Map(Object.entries(entries))
  const applied: StorageOp[][] = []
  let failing = false
  const store: DurableStore = {
    load: async () => new Map(values),
    apply: async ops => {
      if (failing) throw new Error('quota')
      applied.push(ops)
      for (const op of ops) {
        if (op.op === 'set') values.set(op.key, op.value)
        else if (op.op === 'remove') values.delete(op.key)
        else values.clear()
      }
    },
  }
  return { store, values, applied, fail: (value: boolean) => (failing = value) }
}

type Listener = (event: MessageEvent<StorageOp>) => void
const fakeChannels = () => {
  const pages: Listener[][] = []
  return () => {
    const own: Listener[] = []
    pages.push(own)
    return {
      postMessage: (message: StorageOp) =>
        pages
          .filter(page => page !== own)
          .forEach(page => page.forEach(listener => listener({ data: message } as MessageEvent))),
      addEventListener: (_: 'message', listener: Listener) => void own.push(listener),
    }
  }
}

const webStorageWith = (overrides: Partial<WebStorageEnvironment>) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createWebStorage } = require('../storage.web') as typeof import('../storage.web')
  return createWebStorage({
    openDurable: async () => undefined,
    localStorage: () => undefined,
    channel: () => undefined,
    onError: jest.fn(),
    openTimeoutMs: 50,
    ...overrides,
  })
}

describe('the web storage over IndexedDB', () => {
  it('moves what localStorage held, then frees it', async () => {
    const local = fakeLocalStorage({
      'bible-strong:root': '{"user":{}}',
      'bible-strong:plan:myPlans': '[]',
      firestore_targets_x: 'kept',
    })
    const durable = fakeDurable()
    const { storage, prepareStorage } = webStorageWith({
      openDurable: async () => durable.store,
      localStorage: () => local,
    })

    await prepareStorage()

    expect(storage.getString('root')).toBe('{"user":{}}')
    expect(storage.getString('plan:myPlans')).toBe('[]')
    expect(durable.values.get('root')).toBe('{"user":{}}')
    expect(Array.from(local.values.keys())).toEqual(['firestore_targets_x'])
  })

  it('keeps what IndexedDB holds over what a page of the former build left in localStorage', async () => {
    const local = fakeLocalStorage({ 'bible-strong:theme': 'stale' })
    const durable = fakeDurable({ theme: 'night' })
    const { storage, prepareStorage } = webStorageWith({
      openDurable: async () => durable.store,
      localStorage: () => local,
    })

    await prepareStorage()

    expect(storage.getString('theme')).toBe('night')
    expect(local.values.size).toBe(0)
  })

  it('writes to IndexedDB in order, and reads at once', async () => {
    const durable = fakeDurable()
    const { storage, prepareStorage, flushStorage } = webStorageWith({
      openDurable: async () => durable.store,
    })
    await prepareStorage()

    storage.set('a', '1')
    storage.set('a', '2')
    storage.remove('b')
    expect(storage.getString('a')).toBe('2')
    await flushStorage()

    expect(durable.applied.flat()).toEqual([
      { op: 'set', key: 'a', value: '1' },
      { op: 'set', key: 'a', value: '2' },
      { op: 'remove', key: 'b' },
    ])
    storage.clearAll()
    await flushStorage()
    expect(durable.values.size).toBe(0)
  })

  it('sends what was written while a send was on its way', async () => {
    const durable = fakeDurable()
    const gates: (() => void)[] = []
    const store: DurableStore = {
      load: durable.store.load,
      apply: ops =>
        new Promise<void>(resolve => gates.push(resolve)).then(() => durable.store.apply(ops)),
    }
    const { storage, prepareStorage, flushStorage } = webStorageWith({
      openDurable: async () => store,
    })
    await prepareStorage()

    storage.set('a', '1')
    await Promise.resolve()
    expect(gates).toHaveLength(1)
    storage.set('b', '2')
    gates[0]()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(gates).toHaveLength(2)
    gates[1]()
    await flushStorage()

    expect(durable.values.get('a')).toBe('1')
    expect(durable.values.get('b')).toBe('2')
  })

  it('keeps a failed write for the next one', async () => {
    const durable = fakeDurable()
    const onError = jest.fn()
    const { storage, prepareStorage, flushStorage } = webStorageWith({
      openDurable: async () => durable.store,
      onError,
    })
    await prepareStorage()

    durable.fail(true)
    storage.set('a', '1')
    await flushStorage()
    expect(onError).toHaveBeenCalledWith('web.storage.write_failed', expect.any(Error))

    durable.fail(false)
    await flushStorage()
    expect(durable.values.get('a')).toBe('1')
  })

  it('tells a page what another page wrote', async () => {
    const channel = fakeChannels()
    const durable = fakeDurable()
    const first = webStorageWith({ openDurable: async () => durable.store, channel })
    const second = webStorageWith({ openDurable: async () => durable.store, channel })
    await first.prepareStorage()
    await second.prepareStorage()
    const heard = jest.fn()
    second.storage.subscribe('tabs', heard)

    first.storage.set('tabs', '[1]')

    expect(second.storage.getString('tabs')).toBe('[1]')
    expect(heard).toHaveBeenCalledWith('[1]')
    first.storage.remove('tabs')
    expect(second.storage.getString('tabs')).toBeUndefined()
    expect(heard).toHaveBeenLastCalledWith(null)
  })

  it('stays on localStorage when IndexedDB does not answer', async () => {
    const local = fakeLocalStorage({ 'bible-strong:theme': 'night' })
    const { storage, prepareStorage } = webStorageWith({
      openDurable: () => new Promise(() => undefined),
      localStorage: () => local,
    })

    await prepareStorage()

    expect(storage.getString('theme')).toBe('night')
    storage.set('theme', 'day')
    expect(local.values.get('bible-strong:theme')).toBe('day')
  })

  it('stays on localStorage, untouched, when the move fails', async () => {
    const local = fakeLocalStorage({ 'bible-strong:root': '{}' })
    const durable = fakeDurable()
    durable.fail(true)
    const onError = jest.fn()
    const { storage, prepareStorage } = webStorageWith({
      openDurable: async () => durable.store,
      localStorage: () => local,
      onError,
    })

    await prepareStorage()

    expect(onError).toHaveBeenCalledWith('web.storage.migration_failed', expect.any(Error))
    expect(local.values.get('bible-strong:root')).toBe('{}')
    expect(storage.getString('root')).toBe('{}')
  })
})
