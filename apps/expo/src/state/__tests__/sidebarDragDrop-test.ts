import { applySidebarDrop } from '../sidebarDragDrop'
import type { TabGroup } from '../tabs'

const group = (id: string, tabs: string[], activeTabIndex = 0): TabGroup => ({
  id,
  name: id,
  isDefault: id === 'default',
  tabs: tabs.map(id => ({ id, title: id, type: 'new', data: {}, isRemovable: true })),
  activeTabIndex,
  createdAt: 0,
  updatedAt: 0,
})

it('reorders tabs in both directions without changing the selected tab', () => {
  const groups = [group('default', ['a', 'b', 'c'], 1)]
  const after = applySidebarDrop(
    groups,
    'default',
    { kind: 'tab', groupId: 'default', tabId: 'a' },
    { groupId: 'default', tabId: 'c', edge: 'after' }
  )!
  expect(after.groups[0].tabs.map(tab => tab.id)).toEqual(['b', 'c', 'a'])
  expect(after.groups[0].activeTabIndex).toBe(0)
  const before = applySidebarDrop(
    after.groups,
    'default',
    { kind: 'tab', groupId: 'default', tabId: 'a' },
    { groupId: 'default', tabId: 'b', edge: 'before' }
  )!
  expect(before.groups[0].tabs.map(tab => tab.id)).toEqual(['a', 'b', 'c'])
  expect(before.groups[0].activeTabIndex).toBe(1)
  expect(groups[0].tabs.map(tab => tab.id)).toEqual(['a', 'b', 'c'])
})

it('moves an active tab into another group and keeps that tab active', () => {
  const groups = [group('default', ['a', 'b'], 1), group('work', ['c', 'd'])]
  const result = applySidebarDrop(
    groups,
    'default',
    { kind: 'tab', groupId: 'default', tabId: 'b' },
    { groupId: 'work', tabId: 'd', edge: 'before' }
  )!
  expect(result.groups.map(group => group.tabs.map(tab => tab.id))).toEqual([
    ['a'],
    ['c', 'b', 'd'],
  ])
  expect(result.activeGroupId).toBe('work')
  expect(result.groups[1].activeTabIndex).toBe(1)
})

it('accepts empty/default groups and preserves selection when an inactive tab moves', () => {
  const groups = [group('default', []), group('work', ['a', 'b'], 1)]
  const result = applySidebarDrop(
    groups,
    'work',
    { kind: 'tab', groupId: 'work', tabId: 'a' },
    { groupId: 'default', edge: 'inside' }
  )!
  expect(result.groups[0].tabs.map(tab => tab.id)).toEqual(['a'])
  expect(result.activeGroupId).toBe('work')
  expect(result.groups[1].activeTabIndex).toBe(0)
})

it('keeps an empty source group after moving its last tab', () => {
  const result = applySidebarDrop(
    [group('default', ['a']), group('work', [])],
    'default',
    { kind: 'tab', groupId: 'default', tabId: 'a' },
    { groupId: 'work', edge: 'inside' }
  )!
  expect(result.groups[0].tabs).toEqual([])
  expect(result.groups[0].activeTabIndex).toBe(0)
  expect(result.activeGroupId).toBe('work')
})

it('reorders whole groups without moving their tabs or the default group', () => {
  const groups = [group('default', ['a']), group('one', ['b']), group('two', ['c'])]
  const result = applySidebarDrop(
    groups,
    'one',
    { kind: 'group', groupId: 'two' },
    { groupId: 'one', edge: 'before' },
    123
  )!
  expect(result.groups.map(group => group.id)).toEqual(['default', 'two', 'one'])
  expect(result.groups[1].tabs).toBe(groups[2].tabs)
  expect(result.groups.map(group => group.sortOrder)).toEqual([0, 1, 2])
  expect(result.groups.every(group => group.updatedAt === 123)).toBe(true)
  expect(result.groups.map(group => group.createdAt)).toEqual([0, 0, 0])
  expect(result.activeGroupId).toBe('one')
  expect(
    applySidebarDrop(
      groups,
      'one',
      { kind: 'group', groupId: 'default' },
      { groupId: 'two', edge: 'after' }
    )
  ).toBeNull()
  expect(
    applySidebarDrop(
      groups,
      'one',
      { kind: 'group', groupId: 'two' },
      { groupId: 'default', edge: 'before' }
    )
  ).toBeNull()
})

it('ignores stale and self drops instead of losing tabs', () => {
  const groups = [group('default', ['a'])]
  expect(
    applySidebarDrop(
      groups,
      'default',
      { kind: 'tab', groupId: 'default', tabId: 'a' },
      { groupId: 'default', tabId: 'a', edge: 'after' }
    )
  ).toBeNull()
  expect(
    applySidebarDrop(
      groups,
      'default',
      { kind: 'tab', groupId: 'default', tabId: 'gone' },
      { groupId: 'default', edge: 'inside' }
    )
  ).toBeNull()
})
