import {
  hydrateTabGroup,
  mergeTabGroups,
  prepareTabGroupForSync,
  reconcileTabGroupsSnapshot,
  subscribeToTabGroupsFirestore,
  createTabGroupsSyncIntent,
  type FirestoreTabGroup,
} from '../tabGroupsFirestoreSync'
import { subscribeToSubcollection } from '../firestoreSubcollections'
import type { BibleTab, TabGroup, TabItem } from '~state/tabs'
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

const makeTab = (id: string, previewUri?: string): TabItem => ({
  id,
  title: id,
  isRemovable: true,
  type: 'new',
  data: {},
  previewUri,
})

const previewOf = (id: string) => `file:///documents/tab-previews/${id}-1.jpg`

// A tab saved by a version that kept its preview inline.
const makeLegacyTab = (id: string) =>
  ({ ...makeTab(id), base64Preview: 'inline-jpeg' }) as unknown as TabItem

const makeBibleTab = (): BibleTab => ({
  id: 'bible-1',
  title: 'Genèse 1',
  isRemovable: true,
  type: 'bible',
  data: {
    selectedVersion: 'LSG',
    strongBibleSourceVersionId: 'DBY',
    selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
    selectedChapter: 1,
    selectedVerse: 1,
    parallelVersions: [],
    temp: {
      selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
      selectedChapter: 1,
      selectedVerse: 1,
    },
    selectedVerses: {
      '1-1-1': true,
      '1-1-2': true,
    },
    selectionMode: 'grid',
    focusVerses: [1, 2],
    isSelectionMode: undefined,
    contextDisplayMode: 'focused',
    isReadOnly: false,
  },
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
  it.each([true, false])('syncs and hydrates group collapse state (%s)', isCollapsed => {
    const group = { ...makeGroup([makeTab('a')]), isCollapsed }
    const payload = prepareTabGroupForSync(group)
    expect(payload.isCollapsed).toBe(isCollapsed)
    expect(hydrateTabGroup(payload, { ...group, isCollapsed: !isCollapsed }).isCollapsed).toBe(
      isCollapsed
    )
    expect(createTabGroupsSyncIntent([group], [{ ...group, isCollapsed: !isCollapsed }])).toEqual(
      expect.objectContaining({ set: { [group.id]: expect.objectContaining({ isCollapsed }) } })
    )
  })

  it('preserves collapse state when an older client sends a group without the field', () => {
    const local = { ...makeGroup([makeTab('a')]), isCollapsed: true }
    const { isCollapsed: _, ...remote } = prepareTabGroupForSync(local)
    expect(hydrateTabGroup(remote, local).isCollapsed).toBe(true)
    expect(prepareTabGroupForSync({ ...local, isDefault: true }).isCollapsed).toBe(false)
  })
  it('omits local-only active tab and preview data from Firestore payloads', () => {
    const group = makeGroup([makeTab('a', previewOf('a')), makeLegacyTab('b'), makeBibleTab()], 1)
    group.tabs[2].previewUri = previewOf('bible-1')

    const synced = prepareTabGroupForSync(group, { updatedAt: 123 })
    const intent = createTabGroupsSyncIntent([group], [])

    expect(synced.updatedAt).toBe(123)
    expect('activeTabIndex' in synced).toBe(false)
    for (const tab of synced.tabs) {
      expect('previewUri' in tab).toBe(false)
      expect('base64Preview' in tab).toBe(false)
    }
    expect(JSON.stringify(intent)).not.toMatch(/previewUri|base64Preview|tab-previews/)
  })

  it('does not write to Firestore when only a preview changed', () => {
    const before = makeGroup([makeTab('a', previewOf('a'))])
    const after = { ...before, tabs: [makeTab('a', previewOf('a-2'))] }

    expect(createTabGroupsSyncIntent([after], [before])).toEqual(
      expect.objectContaining({ set: {}, delete: [] })
    )
  })

  it('never takes a preview from Firestore, even one written by an older client', () => {
    const local = makeGroup([makeTab('a', previewOf('a')), makeTab('b')])
    const remote: FirestoreTabGroup = {
      id: 'group-1',
      name: 'Group',
      isDefault: false,
      tabs: [{ ...makeTab('a'), previewUri: 'file:///other-device/a.jpg' }, makeLegacyTab('b')],
      createdAt: 1,
      updatedAt: 10,
    }

    const hydrated = hydrateTabGroup(remote, local)

    expect(hydrated.tabs[0].previewUri).toBe(previewOf('a'))
    expect(hydrated.tabs[1].previewUri).toBeUndefined()
    expect('base64Preview' in hydrated.tabs[1]).toBe(false)
  })

  it('keeps the local previews when a newer remote group wins the merge', () => {
    const local = makeGroup([makeTab('a', previewOf('a')), makeBibleTab()])
    local.tabs[1].previewUri = previewOf('bible-1')
    const remote = hydrateTabGroup({
      ...prepareTabGroupForSync(local),
      name: 'Renamed',
      updatedAt: 10,
    })

    const [merged] = mergeTabGroups([local], [remote])

    expect(merged.name).toBe('Renamed')
    expect(merged.tabs.map(tab => tab.previewUri)).toEqual([previewOf('a'), previewOf('bible-1')])
  })

  it('omits selected verses from Bible tabs while preserving focus verses', () => {
    const group = makeGroup([makeBibleTab()])

    const synced = prepareTabGroupForSync(group)
    const syncedTab = synced.tabs[0] as BibleTab

    expect(syncedTab.data.selectedVerses).toEqual({})
    expect(syncedTab.data.focusVerses).toEqual([1, 2])
    expect(syncedTab.data.strongBibleSourceVersionId).toBe('DBY')
  })

  it('builds a durable intent containing changed and deleted tab groups', () => {
    const unchanged = { ...makeGroup([makeTab('a')]), id: 'unchanged' }
    const changedBefore = { ...makeGroup([makeTab('b')]), id: 'changed', name: 'Before' }
    const changedAfter = { ...changedBefore, name: 'After', updatedAt: 3 }
    const deleted = { ...makeGroup([makeTab('c')]), id: 'deleted' }

    expect(
      createTabGroupsSyncIntent([unchanged, changedAfter], [unchanged, changedBefore, deleted])
    ).toEqual(
      expect.objectContaining({
        collection: 'tabGroups',
        set: { changed: expect.objectContaining({ name: 'After' }) },
        delete: ['deleted'],
      })
    )
  })

  it('keeps the local active tab by tab id when hydrating reordered remote tabs', () => {
    const local = makeGroup([makeTab('a'), makeTab('b', previewOf('b')), makeTab('c')], 1)
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
    expect(hydrated.tabs[2].previewUri).toBe(previewOf('b'))
  })

  it('preserves local selected verses when hydrating a synced Bible tab', () => {
    const local = makeGroup([makeBibleTab()])
    const remoteBibleTab: BibleTab = {
      ...makeBibleTab(),
      title: 'Genèse 2',
      data: {
        ...makeBibleTab().data,
        selectedChapter: 2,
        selectedVerses: {},
      },
    }
    const remote: FirestoreTabGroup = {
      id: 'group-1',
      name: 'Group',
      isDefault: false,
      tabs: [remoteBibleTab],
      createdAt: 1,
      updatedAt: 10,
    }

    const hydrated = hydrateTabGroup(remote, local)
    const hydratedBibleTab = hydrated.tabs[0] as BibleTab

    expect(hydratedBibleTab.title).toBe('Genèse 2')
    expect(hydratedBibleTab.data.selectedChapter).toBe(2)
    expect(hydratedBibleTab.data.selectedVerses).toEqual({
      '1-1-1': true,
      '1-1-2': true,
    })
  })

  it('keeps what the parallel columns of a tab synced by an older application showed', () => {
    const remoteBibleTab: BibleTab = {
      ...makeBibleTab(),
      data: { ...makeBibleTab().data, strongMode: 'visible', parallelVersions: ['KJV', 'BDS'] },
    }
    const remote: FirestoreTabGroup = {
      id: 'group-1',
      name: 'Group',
      isDefault: false,
      tabs: [remoteBibleTab],
      createdAt: 1,
      updatedAt: 10,
    }

    const hydratedBibleTab = hydrateTabGroup(remote).tabs[0] as BibleTab

    expect(hydratedBibleTab.data.parallelTextModes).toEqual([
      { version: 'KJV', strongMode: 'visible' },
      { version: 'BDS', strongMode: 'hidden' },
    ])
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

  it('preserves local groups when the initial Firestore snapshot is an empty cache snapshot', () => {
    const localGroups = [
      { ...makeGroup([makeTab('a')]), id: 'local-1', createdAt: 1 },
      { ...makeGroup([makeTab('b')]), id: 'local-2', createdAt: 2 },
    ]

    const reconciled = reconcileTabGroupsSnapshot({
      localGroups,
      remoteGroups: [],
      removedIds: [],
      fromCache: true,
    })

    expect(reconciled).toEqual(localGroups)
  })

  it('only removes established local-only groups after an explicit remote deletion', () => {
    const localGroups = [
      { ...makeGroup([makeTab('a')]), id: 'local-only', createdAt: 1 },
      { ...makeGroup([makeTab('b')]), id: 'shared', createdAt: 2 },
    ]
    const remoteGroups = [
      { ...makeGroup([makeTab('b')]), id: 'shared', createdAt: 2, updatedAt: 3 },
    ]

    expect(
      reconcileTabGroupsSnapshot({
        localGroups,
        remoteGroups,
        removedIds: [],
        fromCache: true,
      }).map(group => group.id)
    ).toEqual(['local-only', 'shared'])

    expect(
      reconcileTabGroupsSnapshot({
        localGroups,
        remoteGroups,
        removedIds: [],
        fromCache: false,
      }).map(group => group.id)
    ).toEqual(['local-only', 'shared'])

    expect(
      reconcileTabGroupsSnapshot({
        localGroups,
        remoteGroups,
        removedIds: ['local-only'],
        fromCache: false,
      }).map(group => group.id)
    ).toEqual(['shared'])
  })

  it('requests metadata events only for the tab-groups subscription', () => {
    const onChange = jest.fn()

    subscribeToTabGroupsFirestore('user-1', onChange)

    expect(subscribeToSubcollection).toHaveBeenCalledWith(
      'user-1',
      'tabGroups',
      onChange,
      undefined,
      { includeMetadataChanges: true }
    )
  })
})

it.each([true, false])(
  'restores shared group positions in a fresh session (cache: %s)',
  fromCache => {
    const first = { ...makeGroup([]), id: 'older', createdAt: 100, sortOrder: 1 }
    const second = { ...makeGroup([]), id: 'newer', createdAt: 200, sortOrder: 0 }
    const remoteGroups = [first, second].map(group =>
      hydrateTabGroup(prepareTabGroupForSync(group))
    )
    expect(
      reconcileTabGroupsSnapshot({ localGroups: [], remoteGroups, removedIds: [], fromCache }).map(
        group => group.id
      )
    ).toEqual(['newer', 'older'])
  }
)

it('preserves legacy creation order and appends newly created groups after positioned groups', () => {
  const older = { ...makeGroup([]), id: 'older', createdAt: 100 }
  const newer = { ...makeGroup([]), id: 'newer', createdAt: 200 }
  expect(mergeTabGroups([], [newer, older]).map(group => group.id)).toEqual(['older', 'newer'])
  const positioned = { ...older, sortOrder: 0 }
  expect(mergeTabGroups([], [newer, positioned]).map(group => group.id)).toEqual(['older', 'newer'])
})
