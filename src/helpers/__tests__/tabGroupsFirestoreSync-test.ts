jest.mock('../firestoreSubcollections', () => ({
  writeToSubcollection: jest.fn(),
  deleteFromSubcollection: jest.fn(),
  fetchSubcollection: jest.fn(),
  subscribeToSubcollection: jest.fn(),
}))

jest.mock('../storage', () => ({
  storage: {
    getBoolean: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}))

import {
  hydrateTabGroup,
  prepareTabGroupForSync,
  type FirestoreTabGroup,
} from '../tabGroupsFirestoreSync'
import type { TabGroup, TabItem } from '~state/tabs'

const makeTab = (id: string, base64Preview?: string): TabItem => ({
  id,
  title: id,
  isRemovable: true,
  type: 'new',
  data: {},
  base64Preview,
})

const makeGroup = (tabs: TabItem[], activeTabIndex = 0): TabGroup => ({
  id: 'group-1',
  name: 'Group',
  isDefault: false,
  tabs,
  activeTabIndex,
  createdAt: 1,
  updatedAt: 2,
})

describe('tabGroupsFirestoreSync', () => {
  it('omits local-only active tab and preview data from Firestore payloads', () => {
    const group = makeGroup([makeTab('a', 'preview-a'), makeTab('b')], 1)

    const synced = prepareTabGroupForSync(group, { updatedAt: 123 })

    expect(synced.updatedAt).toBe(123)
    expect('activeTabIndex' in synced).toBe(false)
    expect('base64Preview' in synced.tabs[0]).toBe(false)
  })

  it('keeps the local active tab by tab id when hydrating reordered remote tabs', () => {
    const local = makeGroup([makeTab('a'), makeTab('b', 'preview-b'), makeTab('c')], 1)
    const remote: FirestoreTabGroup = {
      id: 'group-1',
      name: 'Group',
      isDefault: false,
      tabs: [makeTab('c'), makeTab('a'), makeTab('b')],
      createdAt: 1,
      updatedAt: 10,
    }

    const hydrated = hydrateTabGroup(remote, local)

    expect(hydrated.activeTabIndex).toBe(2)
    expect(hydrated.tabs[2].id).toBe('b')
    expect(hydrated.tabs[2].base64Preview).toBe('preview-b')
  })

  it('clamps the local active tab index when the active tab was deleted remotely', () => {
    const local = makeGroup([makeTab('a'), makeTab('b'), makeTab('c')], 2)
    const remote: FirestoreTabGroup = {
      id: 'group-1',
      name: 'Group',
      isDefault: false,
      tabs: [makeTab('a'), makeTab('b')],
      createdAt: 1,
      updatedAt: 10,
    }

    const hydrated = hydrateTabGroup(remote, local)

    expect(hydrated.activeTabIndex).toBe(1)
    expect(hydrated.tabs[1].id).toBe('b')
  })
})
