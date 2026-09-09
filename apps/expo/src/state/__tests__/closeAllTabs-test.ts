import { createStore } from 'jotai/vanilla'
import {
  activeGroupIdAtom,
  cachedTabIdsAtom,
  closeAllTabsAtom,
  tabGroupsAtom,
  type TabGroup,
} from '../tabs'

jest.mock('~helpers/storage', () => ({ storage: { getString: jest.fn(), set: jest.fn() } }))
jest.mock('~helpers/atomWithAsyncStorage', () => ({
  __esModule: true,
  default: (_key: string, initial: unknown) => jest.requireActual('jotai/vanilla').atom(initial),
}))
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

const group = (id: string): TabGroup => ({
  id,
  name: id,
  isDefault: id === 'default',
  activeTabIndex: 0,
  createdAt: 1,
  updatedAt: 1,
  tabs: [{ id: `${id}-tab`, title: id, type: 'new', data: {}, isRemovable: true }],
})

test('closing another group preserves the selected group, its tabs and cached surfaces', () => {
  const store = createStore()
  const selected = group('default')
  store.set(tabGroupsAtom, [selected, group('other')])
  store.set(activeGroupIdAtom, 'default')
  store.set(cachedTabIdsAtom, ['default-tab', 'previous-tab'])
  store.set(closeAllTabsAtom, 'other')
  expect(store.get(activeGroupIdAtom)).toBe('default')
  expect(store.get(tabGroupsAtom)[0]).toBe(selected)
  expect(store.get(tabGroupsAtom)[1].tabs).toEqual([])
  expect(store.get(cachedTabIdsAtom)).toEqual(['default-tab', 'previous-tab'])
})

test('closing without a group still closes the active group and clears its cache', () => {
  const store = createStore()
  const other = group('other')
  store.set(tabGroupsAtom, [group('default'), other])
  store.set(activeGroupIdAtom, 'default')
  store.set(cachedTabIdsAtom, ['default-tab'])
  store.set(closeAllTabsAtom)
  expect(store.get(tabGroupsAtom)[0].tabs).toEqual([])
  expect(store.get(tabGroupsAtom)[1]).toBe(other)
  expect(store.get(cachedTabIdsAtom)).toEqual([])
})
