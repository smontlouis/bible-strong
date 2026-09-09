import { createStore } from 'jotai/vanilla'
import { collapsedWorkspaceGroupsAtom } from '../workspacePreferences'
import { tabGroupsAtom, type TabGroup } from '../tabs'

jest.mock('../tabs', () => ({ tabGroupsAtom: jest.requireActual('jotai/vanilla').atom([]) }))

it('stores collapse changes on groups, marks them modified, and ignores the default group', () => {
  const store = createStore()
  const makeGroup = (id: string): TabGroup => ({
    id,
    name: id,
    isDefault: id === 'default',
    tabs: [],
    activeTabIndex: 0,
    createdAt: 1,
    updatedAt: 1,
  })
  store.set(tabGroupsAtom, [makeGroup('default'), makeGroup('work')])
  store.set(collapsedWorkspaceGroupsAtom, ['default', 'work'])
  expect(store.get(collapsedWorkspaceGroupsAtom)).toEqual(['work'])
  expect(store.get(tabGroupsAtom)[1].isCollapsed).toBe(true)
  expect(store.get(tabGroupsAtom)[1].updatedAt).toBeGreaterThan(1)
  expect(store.get(tabGroupsAtom)[0].updatedAt).toBe(1)
  store.set(collapsedWorkspaceGroupsAtom, ids => ids.filter(id => id !== 'work'))
  expect(store.get(tabGroupsAtom)[1].isCollapsed).toBe(false)
  expect(store.get(collapsedWorkspaceGroupsAtom)).toEqual([])
})
