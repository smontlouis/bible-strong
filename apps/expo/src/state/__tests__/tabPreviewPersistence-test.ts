import type { TabGroup, TabItem } from '../tabs'

type MockStorage = {
  getString: (key: string) => string | undefined
  set: jest.Mock
}

// Survives `jest.resetModules`, like MMKV survives a relaunch.
jest.mock('~helpers/storage', () => {
  const persisted = globalThis as { mockPersistedValues?: Map<string, string> }
  persisted.mockPersistedValues ??= new Map()
  const values = persisted.mockPersistedValues
  return {
    storage: {
      getString: (key: string) => values.get(key),
      set: jest.fn((key: string, value: string) => values.set(key, value)),
      remove: (key: string) => values.delete(key),
      clearAll: () => values.clear(),
    },
  }
})
jest.mock('~helpers/bibleVersions', () => ({ versions: {}, getBibleVersionCanonId: jest.fn() }))
jest.mock('~helpers/languageUtils', () => ({ getDefaultBibleVersion: () => 'LSG' }))
jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  getLanguage: () => 'fr',
}))
jest.mock('~helpers/bibleCoverage', () => ({}))
jest.mock('~helpers/bibleTabVersionSelection', () => ({}))
jest.mock('~helpers/agentObservability', () => ({ appLogger: {} }))

const persistedValues = new Map<string, string>()
Object.assign(globalThis, { mockPersistedValues: persistedValues })
const values = () => persistedValues

/** Loads the tab state as a launch does: the persisted groups are read when the atom is built. */
const launch = () => {
  jest.resetModules()
  const { createStore } = jest.requireActual<typeof import('jotai/vanilla')>('jotai/vanilla')
  const { tabGroupsAtom } = jest.requireActual<typeof import('../tabs')>('../tabs')
  const { storage } = jest.requireMock('../../helpers/storage') as { storage: MockStorage }
  return { tabGroupsAtom, storage, store: createStore() }
}

const group = (tabs: TabItem[]): TabGroup => ({
  id: 'group',
  name: 'Group',
  isDefault: false,
  isCollapsed: false,
  tabs,
  activeTabIndex: 0,
  createdAt: 1,
  updatedAt: 1,
})

const tab = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, title: id, isRemovable: true, type: 'new', data: {}, ...extra }) as TabItem

beforeEach(() => values().clear())

it('drops the inline previews of an earlier version and saves the slimmer groups once', () => {
  const kept = 'file:///documents/tab-previews/b-1.jpg'
  values().set(
    'tabGroupsAtom',
    JSON.stringify([
      group([tab('a', { base64Preview: 'x'.repeat(1000) }), tab('b', { previewUri: kept })]),
    ])
  )

  const first = launch()
  const groups = first.store.get(first.tabGroupsAtom)

  expect(groups[0].tabs[0]).not.toHaveProperty('base64Preview')
  expect(groups[0].tabs[1].previewUri).toBe(kept)
  expect(first.storage.set).toHaveBeenCalledTimes(1)
  expect(values().get('tabGroupsAtom')).not.toContain('base64Preview')

  const second = launch()
  second.store.get(second.tabGroupsAtom)
  expect(second.storage.set).not.toHaveBeenCalled()
})

it('keeps a web preview for the session only', () => {
  const file = 'file:///documents/tab-previews/b-1.jpg'
  const { store, tabGroupsAtom } = launch()

  store.set(tabGroupsAtom, [
    group([
      tab('a', { previewUri: 'data:image/jpeg;base64,AAAA' }),
      tab('b', { previewUri: file }),
    ]),
  ])

  expect(store.get(tabGroupsAtom)[0].tabs[0].previewUri).toBe('data:image/jpeg;base64,AAAA')
  const persisted = JSON.parse(values().get('tabGroupsAtom')!) as TabGroup[]
  expect(persisted[0].tabs[0]).not.toHaveProperty('previewUri')
  expect(persisted[0].tabs[1].previewUri).toBe(file)
})
