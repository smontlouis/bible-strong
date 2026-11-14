import cards, { collectCard, mergeCollectedCards, parseCollectedCards } from '../cards'
import { importData, receiveLiveUpdates, USER_LOGOUT } from '../user'

// The user module pulls in the app's runtime: the same mocks as the plan's test.
jest.mock('react-native', () => ({
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
  },
}))

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('expo-file-system', () => ({}))

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({}))

// Mock bibleVersions and databases to avoid deep import chains
jest.mock('~helpers/bibleVersions', () => ({
  versions: {},
  getIfVersionNeedsUpdate: jest.fn(),
}))

jest.mock('~helpers/databases', () => ({
  databases: {},
  getIfDatabaseNeedsUpdate: jest.fn(),
}))

// Mock modules before importing reducer
jest.mock('~helpers/firebase', () => ({
  firebaseDb: {},
  increment: {},
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
}))

jest.mock('~state/tabs', () => ({
  tabGroupsAtom: {},
}))

jest.mock('jotai/vanilla', () => ({
  getDefaultStore: jest.fn(() => ({
    set: jest.fn(),
  })),
}))

jest.mock('~i18n', () => ({
  getLanguage: jest.fn(() => 'fr'),
}))

jest.mock('~helpers/languageUtils', () => ({
  getDefaultBibleVersion: jest.fn(() => 'LSG'),
}))

// Mock theme imports
jest.mock('~themes/colors', () => ({ primary: '#000' }))
jest.mock('~themes/darkColors', () => ({ primary: '#111' }))
jest.mock('~themes/blackColors', () => ({ primary: '#222' }))
jest.mock('~themes/sepiaColors', () => ({ primary: '#333' }))
jest.mock('~themes/natureColors', () => ({ primary: '#444' }))
jest.mock('~themes/sunsetColors', () => ({ primary: '#555' }))
jest.mock('~themes/mauveColors', () => ({ primary: '#666' }))
jest.mock('~themes/nightColors', () => ({ primary: '#777' }))

const initial = cards(undefined, { type: '@@init' })

describe('the collected cards', () => {
  it('keeps the first time a card was collected', () => {
    const once = cards(initial, collectCard({ id: 'Adam@Gen.2.19-Jud', collectedAt: 10 }))
    const twice = cards(once, collectCard({ id: 'Adam@Gen.2.19-Jud', collectedAt: 20 }))
    expect(twice.collected).toEqual({ 'Adam@Gen.2.19-Jud': 10 })
  })

  it('takes the account’s collection from its document', () => {
    const local = cards(initial, collectCard({ id: 'Adam@Gen.2.19-Jud', collectedAt: 10 }))
    const remoteUserData = { cards: { 'Eve@Gen.3.20-1Ti': 5 } } as unknown as Parameters<
      typeof receiveLiveUpdates
    >[0]['remoteUserData']
    expect(cards(local, receiveLiveUpdates({ remoteUserData })).collected).toEqual({
      'Eve@Gen.3.20-1Ti': 5,
    })
    // A document without cards leaves the collection as it is.
    const withoutCards = {} as typeof remoteUserData
    expect(cards(local, receiveLiveUpdates({ remoteUserData: withoutCards })).collected).toEqual(
      local.collected
    )
  })

  it('adds the cards of an import, and forgets them all at logout', () => {
    const local = cards(initial, collectCard({ id: 'Adam@Gen.2.19-Jud', collectedAt: 10 }))
    const imported = cards(
      local,
      importData({
        bible: {},
        studies: {},
        cards: { 'Adam@Gen.2.19-Jud': 4, 'Eve@Gen.3.20-1Ti': 6 },
      })
    )
    expect(imported.collected).toEqual({ 'Adam@Gen.2.19-Jud': 4, 'Eve@Gen.3.20-1Ti': 6 })
    expect(cards(imported, { type: USER_LOGOUT }).collected).toEqual({})
  })

  it('reads only well-formed entries', () => {
    expect(parseCollectedCards({ a: 1, b: 'no', c: Number.NaN, '': 3 })).toEqual({ a: 1 })
    expect(parseCollectedCards([1, 2])).toBeUndefined()
    expect(mergeCollectedCards({ a: 5 }, { a: 2, b: 9 })).toEqual({ a: 2, b: 9 })
  })
})
