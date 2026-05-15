/* eslint-env jest */

import { clampTabIndex, updateTabGroupActiveIndex, updateTabGroupTabs } from '../tabWorkspace'
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
})
