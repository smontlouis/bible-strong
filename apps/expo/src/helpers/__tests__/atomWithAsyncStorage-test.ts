import { getDefaultStore } from 'jotai/vanilla'

import atomWithAsyncStorage from '../atomWithAsyncStorage'

type Listener = (value: string | null) => void

const mockValues = new Map<string, string>()
const mockListeners = new Map<string, Listener>()
const mockSet = jest.fn((key: string, value: string) => mockValues.set(key, value))

jest.mock('../storage', () => ({
  storage: {
    getString: (key: string) => mockValues.get(key),
    set: (key: string, value: string) => mockSet(key, value),
    remove: (key: string) => mockValues.delete(key),
    clearAll: () => mockValues.clear(),
    subscribe: (key: string, callback: Listener) => {
      mockListeners.set(key, callback)
      return () => mockListeners.delete(key)
    },
  },
}))

beforeEach(() => {
  mockValues.clear()
  mockListeners.clear()
  mockSet.mockClear()
})

describe('atomWithAsyncStorage', () => {
  it('follows what another page writes, merged with this page, without writing it back', () => {
    mockValues.set('pages', JSON.stringify({ shared: 1, local: 'here' }))
    const pagesAtom = atomWithAsyncStorage(
      'pages',
      { shared: 0, local: '' },
      {
        mergeFromOtherPages: (written, current) => ({ ...written, local: current.local }),
      }
    )
    const store = getDefaultStore()
    const unsubscribe = store.sub(pagesAtom, () => undefined)

    mockListeners.get('pages')!(JSON.stringify({ shared: 2, local: 'there' }))

    expect(store.get(pagesAtom)).toEqual({ shared: 2, local: 'here' })
    expect(mockSet).not.toHaveBeenCalled()
    unsubscribe()
    expect(mockListeners.has('pages')).toBe(false)
  })

  it('does not listen to other pages unless asked to', () => {
    const settingAtom = atomWithAsyncStorage('setting', 0)
    const unsubscribe = getDefaultStore().sub(settingAtom, () => undefined)

    expect(mockListeners.has('setting')).toBe(false)
    unsubscribe()
  })
})
