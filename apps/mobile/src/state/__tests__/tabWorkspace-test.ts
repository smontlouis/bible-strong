import {
  addTabToGroup,
  clampTabIndex,
  createTabGroup,
  deleteTabGroup,
  moveTabToGroup,
  reorderTabGroups,
  switchTabGroup,
  updateTabGroupActiveIndex,
  updateTabGroupTabs,
} from '../tabWorkspace'
import type { TabGroup, TabItem } from '../tabs'

const makeTab = (id: string): TabItem => ({
  id,
  title: id,
  isRemovable: true,
  type: 'new',
  data: {},
})

const makeGroup = (id: string, tabs: TabItem[], activeTabIndex = 0): TabGroup => ({
  id,
  name: id,
  isDefault: id === 'default',
  tabs,
  activeTabIndex,
  createdAt: 0,
  updatedAt: 0,
})

describe('tabWorkspace', () => {
  it('clamps active tab indexes into the available tab range', () => {
    expect(clampTabIndex(-1, 3)).toBe(0)
    expect(clampTabIndex(9, 3)).toBe(2)
    expect(clampTabIndex(1, 3)).toBe(1)
    expect(clampTabIndex(1, 0)).toBe(0)
  })

  it('updates tabs for one group and clamps its active index', () => {
    const groups = [
      makeGroup('default', [makeTab('a'), makeTab('b')], 1),
      makeGroup('other', [makeTab('c')], 0),
    ]

    const next = updateTabGroupTabs(groups, 'default', [makeTab('a')])

    expect(next[0].tabs).toHaveLength(1)
    expect(next[0].activeTabIndex).toBe(0)
    expect(next[1]).toBe(groups[1])
  })

  it('updates the active index for one group', () => {
    const groups = [makeGroup('default', [makeTab('a'), makeTab('b')], 0)]

    const next = updateTabGroupActiveIndex(groups, 'default', 5)

    expect(next[0].activeTabIndex).toBe(1)
  })

  it('creates a group when the max group limit is not reached', () => {
    const groups = [makeGroup('default', [makeTab('a')])]
    const newGroup = makeGroup('other', [makeTab('b')])

    const result = createTabGroup(groups, newGroup, 2)

    expect(result.ok).toBe(true)
    expect(result.value).toBe('other')
    expect(result.groups).toEqual([...groups, newGroup])
  })

  it('refuses to create a group after the max group limit is reached', () => {
    const groups = [makeGroup('default', [makeTab('a')])]
    const newGroup = makeGroup('other', [makeTab('b')])

    const result = createTabGroup(groups, newGroup, 1)

    expect(result.ok).toBe(false)
    expect(result.groups).toBe(groups)
  })

  it('switches group by clearing cached tab ids and returning the active group id', () => {
    const groups = [makeGroup('default', [makeTab('a')]), makeGroup('other', [makeTab('b')])]

    const result = switchTabGroup(groups, 'other')

    expect(result.ok).toBe(true)
    expect(result.value).toBe('other')
    expect(result.cacheTabIds).toEqual([])
    expect(result.groups).toBe(groups)
  })

  it('deletes non-default groups and removes their tabs from cache', () => {
    const groups = [
      makeGroup('default', [makeTab('a')]),
      makeGroup('other', [makeTab('b'), makeTab('c')]),
    ]

    const result = deleteTabGroup(groups, 'other', ['a', 'b', 'c'])

    expect(result.ok).toBe(true)
    expect(result.groups.map(group => group.id)).toEqual(['default'])
    expect(result.cacheTabIds).toEqual(['a'])
  })

  it('refuses to delete the default group', () => {
    const groups = [makeGroup('default', [makeTab('a')])]

    const result = deleteTabGroup(groups, 'default', ['a'])

    expect(result.ok).toBe(false)
    expect(result.groups).toBe(groups)
    expect(result.cacheTabIds).toEqual(['a'])
  })

  it('adds a tab to a group and activates it', () => {
    const groups = [makeGroup('default', [makeTab('a')], 0)]

    const result = addTabToGroup(groups, 'default', makeTab('b'), 10)

    expect(result.ok).toBe(true)
    expect(result.groups[0].tabs.map(tab => tab.id)).toEqual(['a', 'b'])
    expect(result.groups[0].activeTabIndex).toBe(1)
    expect(result.groups[0].updatedAt).toBe(10)
  })

  it('moves a tab to another group and removes it from cache', () => {
    const groups = [
      makeGroup('default', [makeTab('a'), makeTab('b')], 1),
      makeGroup('other', [makeTab('c')], 0),
    ]

    const result = moveTabToGroup(groups, {
      tabId: 'b',
      fromGroupId: 'default',
      toGroupId: 'other',
      cacheTabIds: ['a', 'b'],
      updatedAt: 10,
    })

    expect(result.ok).toBe(true)
    expect(result.cacheTabIds).toEqual(['a'])
    expect(result.groups[0].tabs.map(tab => tab.id)).toEqual(['a'])
    expect(result.groups[0].activeTabIndex).toBe(0)
    expect(result.groups[1].tabs.map(tab => tab.id)).toEqual(['c', 'b'])
    expect(result.groups[1].activeTabIndex).toBe(1)
  })

  it('keeps active index clamped when moving the last tab out of a group', () => {
    const groups = [makeGroup('default', [makeTab('a')], 0), makeGroup('other', [makeTab('b')], 0)]

    const result = moveTabToGroup(groups, {
      tabId: 'a',
      fromGroupId: 'default',
      toGroupId: 'other',
      cacheTabIds: [],
    })

    expect(result.ok).toBe(true)
    expect(result.groups[0].tabs).toEqual([])
    expect(result.groups[0].activeTabIndex).toBe(0)
  })

  it('reorders groups by index', () => {
    const groups = [
      makeGroup('default', [makeTab('a')]),
      makeGroup('second', [makeTab('b')]),
      makeGroup('third', [makeTab('c')]),
    ]

    const result = reorderTabGroups(groups, 0, 2)

    expect(result.ok).toBe(true)
    expect(result.groups.map(group => group.id)).toEqual(['second', 'third', 'default'])
  })
})
