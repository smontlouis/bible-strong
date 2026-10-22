import type { TabGroup, TabItem } from '../tabs'
import { withTabPreviewUri } from '../tabPreview'
import { createTabGroupsSyncQueue } from '../tabGroupsSyncQueue'

// The queue compares groups as the sync prepares them; nothing here reaches Firestore.
jest.mock('~helpers/firestoreSubcollections', () => ({
  writeToSubcollection: jest.fn(),
  deleteFromSubcollection: jest.fn(),
  fetchSubcollection: jest.fn(),
  subscribeToSubcollection: jest.fn(),
}))
jest.mock('~helpers/storage', () => ({
  storage: { getBoolean: jest.fn(), set: jest.fn(), remove: jest.fn() },
}))

const tab = (id: string, previewUri?: string): TabItem => ({
  id,
  title: id,
  isRemovable: true,
  type: 'new',
  data: {},
  previewUri,
})

const group = (id: string, tabs: TabItem[]): TabGroup => ({
  id,
  name: id,
  isDefault: false,
  tabs,
  activeTabIndex: 0,
  createdAt: 1,
  updatedAt: 1,
})

describe('withTabPreviewUri', () => {
  it('sets the preview of a tab and keeps the date of its group', () => {
    const groups = [group('a', [tab('one'), tab('two')]), group('b', [tab('three')])]

    const next = withTabPreviewUri(groups, 'two', 'file:///previews/two.jpg?v=2')

    expect(next[0]!.tabs.map(item => item.previewUri)).toEqual([
      undefined,
      'file:///previews/two.jpg?v=2',
    ])
    expect(next[0]!.updatedAt).toBe(1)
    expect(next[1]).toBe(groups[1])
  })

  it('returns the same groups when the tab is absent or already shows the preview', () => {
    const groups = [group('a', [tab('one', 'file:///previews/one.jpg?v=1')])]

    expect(withTabPreviewUri(groups, 'missing', 'file:///previews/x.jpg?v=1')).toBe(groups)
    expect(withTabPreviewUri(groups, 'one', 'file:///previews/one.jpg?v=1')).toBe(groups)
  })

  it('gives the sync nothing to send to Firestore', () => {
    const groups = [group('a', [tab('one')])]
    const queue = createTabGroupsSyncQueue(groups, async () => {})

    const changes = queue.recordLocal(withTabPreviewUri(groups, 'one', 'file:///p/one.jpg?v=3'))

    expect(changes.size).toBe(0)
    queue.dispose()
  })
})
