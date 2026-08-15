import type { RootState } from '~redux/modules/reducer'
import type { TabGroup } from '~state/tabs'
import {
  createGuestDataSnapshot,
  createGuestSnapshotImportData,
  createGuestAdoptionRepository,
  runPendingGuestAdoption,
  type GuestAdoptionRemote,
  type GuestAdoptionStorage,
} from '~helpers/guestDataAdoption'

jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}))

const createState = (): RootState =>
  ({
    user: {
      id: '',
      notifications: { verseOfTheDay: '08:00', notificationId: 'device-token' },
      changelog: { isLoading: false, lastSeen: 123, data: [] },
      bible: {
        changelog: { '2026-01-01': true },
        bookmarks: {
          bookmark: { id: 'bookmark', book: 1, chapter: 1, date: 1 },
        },
        highlights: {
          '1-1-1': { color: 'yellow', date: 2 },
        },
        notes: {
          '1-1-1': { title: 'A note', description: 'guest text', date: 3 },
        },
        links: {
          '1-1-1': {
            url: 'https://example.com',
            linkType: 'website',
            date: 4,
            ogData: {
              title: 'Fetched preview',
              description: 'Must remain device-owned',
              fetchedAt: 4,
            },
          },
        },
        relations: {
          manual: {
            id: 'manual',
            kind: 'manual',
            type: 'linked',
            direction: 'none',
            endpoints: [
              { type: 'note', noteId: '1-1-1' },
              { type: 'verse', verseKeys: ['1-1-1'] },
            ],
            endpointKeys: ['note:1-1-1', 'verse:1-1-1'],
            endpointTypes: ['note', 'verse'],
            pairKey: 'note:1-1-1|verse:1-1-1',
            duplicateKey: 'linked:none:note:1-1-1|verse:1-1-1',
            createdAt: 5,
            updatedAt: 5,
          },
          system: {
            id: 'system',
            kind: 'system',
            type: 'annotates',
            direction: 'none',
            endpoints: [
              { type: 'note', noteId: '1-1-1' },
              { type: 'verse', verseKeys: ['1-1-1'] },
            ],
            endpointKeys: ['note:1-1-1', 'verse:1-1-1'],
            endpointTypes: ['note', 'verse'],
            pairKey: 'note:1-1-1|verse:1-1-1',
            duplicateKey: 'annotates:none:note:1-1-1|verse:1-1-1',
            createdAt: 5,
            updatedAt: 5,
          },
          invalidStudyRelation: {
            id: 'invalidStudyRelation',
            kind: 'manual',
            type: 'linked',
            direction: 'none',
            endpoints: [
              { type: 'study', studyId: 'guest-study' },
              { type: 'verse', verseKeys: ['1-1-1'] },
            ],
            endpointKeys: ['study:guest-study', 'verse:1-1-1'],
            endpointTypes: ['study', 'verse'],
            pairKey: 'study:guest-study|verse:1-1-1',
            duplicateKey: 'linked:none:study:guest-study|verse:1-1-1',
            createdAt: 5,
            updatedAt: 5,
          },
        },
        relationIndex: { stale: { entityKey: 'stale', totalCount: 99, updatedAt: 1 } },
        relationPairs: {
          stale: { duplicateKey: 'stale', relationId: 'stale', createdAt: 1 },
        },
        studies: {
          'guest-study': { id: 'guest-study', title: 'Must not be adopted' },
        },
        tags: {
          tag: {
            id: 'tag',
            name: 'Grace',
            date: 6,
            notes: { '1-1-1': true },
            studies: { 'guest-study': true },
          },
        },
        strongsHebreu: { H1: { id: 'H1', tags: { tag: { id: 'tag', name: 'Grace' } } } },
        strongsGrec: {},
        words: { grace: { id: 'grace', tags: { tag: { id: 'tag', name: 'Grace' } } } },
        naves: {},
        wordAnnotations: {
          annotation: {
            id: 'annotation',
            version: 'LSG',
            ranges: [{ verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 0, text: 'Au' }],
            color: 'yellow',
            type: 'background',
            date: 7,
            noteId: 'annotation:annotation',
          },
        },
        settings: {
          defaultBibleVersion: 'LSG',
          alignContent: 'left',
          lineHeight: 'normal',
          fontSizeScale: 1,
          textDisplay: 'inline',
          preferredColorScheme: 'auto',
          preferredLightTheme: 'default',
          preferredDarkTheme: 'dark',
          press: 'longPress',
          notesDisplay: 'inline',
          linksDisplay: 'inline',
          tagsDisplay: 'inline',
          commentsDisplay: false,
          redWordsDisplay: true,
          shareVerses: {
            hasVerseNumbers: true,
            hasInlineVerses: true,
            hasQuotes: true,
            hasAppName: true,
          },
          theme: 'default',
          fontFamily: 'Avenir',
          colors: {},
          compare: { LSG: true },
          customHighlightColors: [{ id: 'guest-color', color: '#123456', name: 'Guest' }],
        },
      },
    },
    plan: {
      ongoingPlans: [{ id: 'plan', readingSlices: { first: { isRead: true } } }],
      myPlans: [{ id: 'downloaded-plan' }],
      onlinePlans: [],
      images: { cached: 'base64' },
    },
  }) as unknown as RootState

const tabGroups: TabGroup[] = [
  {
    id: 'group',
    name: 'Workspace',
    createdAt: 1,
    updatedAt: 2,
    isDefault: false,
    activeTabIndex: 1,
    tabs: [
      {
        id: 'tab',
        type: 'bible',
        title: 'Genèse 1',
        data: {
          selectedVersion: 'LSG',
          selectedBook: { Numero: 1, Nom: 'Genèse', Chapitres: 50 },
          selectedChapter: 1,
          selectedVerse: 1,
          parallelVersions: [],
          temp: {
            selectedBook: { Numero: 2, Nom: 'Exode', Chapitres: 40 },
            selectedChapter: 2,
            selectedVerse: 2,
          },
          selectedVerses: { '1-1-1': true },
          selectionMode: 'grid',
          isSelectionMode: 'study',
          focusVerses: ['1-1-1'],
          pendingModeAcquisition: { kind: 'strong', versionId: 'LSG', mode: 'visible' },
        },
        base64Preview: 'device-preview',
      },
      {
        id: 'compare-tab',
        type: 'compare',
        title: 'Comparaison',
        isRemovable: true,
        data: { selectedVerses: { '1-1-1': true }, strongMode: true },
      },
      {
        id: 'study-tab',
        type: 'study',
        title: 'Étude locale',
        isRemovable: true,
        data: { studyId: 'guest-study' },
      },
      {
        id: 'timeline-tab',
        type: 'timeline',
        title: 'Chronologie',
        isRemovable: true,
        data: {
          sectionIndex: 1,
          eventSlug: 'creation',
          event: {
            slug: 'creation',
            title: 'Création',
            titleEn: 'Creation',
            image: 'https://example.com/preview.jpg',
            start: -4000,
            end: -4000,
          },
        },
      },
    ],
  },
  {
    id: 'study-only-group',
    name: 'Local studies',
    createdAt: 1,
    updatedAt: 2,
    isDefault: false,
    activeTabIndex: 0,
    tabs: [
      {
        id: 'study-only-tab',
        type: 'study',
        title: 'Étude locale',
        isRemovable: true,
        data: { studyId: 'guest-study' },
      },
    ],
  },
] as unknown as TabGroup[]

class MemoryStorage implements GuestAdoptionStorage {
  values = new Map<string, string>()

  getString(key: string) {
    return this.values.get(key)
  }

  set(key: string, value: string) {
    this.values.set(key, value)
  }

  remove(key: string) {
    this.values.delete(key)
  }
}

class MemoryRemote implements GuestAdoptionRemote {
  userDocuments = new Map<string, Record<string, unknown>>()
  subcollections = new Map<string, Map<string, Record<string, unknown>>>()
  failOnceAt?: string
  failOnceAtCall?: { collection: string; call: number }
  writeCounts = new Map<string, number>()

  async writeSubcollection(
    userId: string,
    collection: string,
    documents: Record<string, Record<string, unknown>>,
    deleteIds: string[] = []
  ) {
    const call = (this.writeCounts.get(collection) ?? 0) + 1
    this.writeCounts.set(collection, call)
    if (this.failOnceAt === collection) {
      this.failOnceAt = undefined
      throw Object.assign(new Error('offline'), { code: 'unavailable' })
    }
    if (this.failOnceAtCall?.collection === collection && this.failOnceAtCall.call === call) {
      this.failOnceAtCall = undefined
      throw Object.assign(new Error('offline'), { code: 'unavailable' })
    }
    const key = `${userId}/${collection}`
    const stored = this.subcollections.get(key) ?? new Map()
    deleteIds.forEach(id => stored.delete(id))
    Object.entries(documents).forEach(([id, document]) => stored.set(id, document))
    this.subcollections.set(key, stored)
  }

  async writeAccountDocument(userId: string, document: Record<string, unknown>) {
    this.userDocuments.set(userId, document)
  }

  async waitForPendingWrites() {}
}

describe('guest data snapshot', () => {
  it('allowlists account-owned guest data and strips device-owned or derived state', () => {
    const snapshot = createGuestDataSnapshot({ state: createState(), tabGroups, now: 100 })

    expect(snapshot.schemaVersion).toBe(1)
    expect(snapshot.subcollections.bookmarks).toHaveProperty('bookmark')
    expect(snapshot.subcollections.relations).toEqual({ manual: expect.any(Object) })
    expect(snapshot.subcollections).not.toHaveProperty('relationIndex')
    expect(snapshot.subcollections).not.toHaveProperty('relationPairs')
    expect(snapshot).not.toHaveProperty('studies')
    expect(snapshot.plan).toEqual([{ id: 'plan', readingSlices: { first: { isRead: true } } }])
    expect(snapshot.settings.customHighlightColors).toHaveLength(1)
    expect(snapshot.settings).not.toHaveProperty('defaultBibleVersion')
    expect(snapshot.settings).not.toHaveProperty('redWordsDisplay')
    expect(snapshot.settings).not.toHaveProperty('theme')
    expect(snapshot.settings).not.toHaveProperty('fontFamily')
    expect(snapshot.subcollections.tags.tag).not.toHaveProperty('studies')
    expect(snapshot.subcollections.links['1-1-1']).not.toHaveProperty('ogData')
    expect(snapshot.tabGroups[0]).not.toHaveProperty('activeTabIndex')
    expect(snapshot.tabGroups[0].tabs[0]).not.toHaveProperty('base64Preview')
    expect(
      (
        snapshot.tabGroups[0].tabs[0] as Extract<
          (typeof tabGroups)[number]['tabs'][number],
          { type: 'bible' }
        >
      ).data.selectedVerses
    ).toEqual({})
    expect(snapshot.tabGroups[0].tabs[0]).not.toHaveProperty('data.pendingModeAcquisition')
    expect(snapshot.tabGroups[0].tabs[0]).not.toHaveProperty('data.focusVerses')
    expect(snapshot.tabGroups[0].tabs[0]).not.toHaveProperty('data.isSelectionMode')
    expect(snapshot.tabGroups[0].tabs[0]).toHaveProperty('data.temp.selectedChapter', 1)
    expect(snapshot.tabGroups[0].tabs).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'study' })])
    )
    expect(snapshot.tabGroups[0].tabs[1]).toHaveProperty('data.selectedVerses', {})
    expect(snapshot.tabGroups[0].tabs[2]).not.toHaveProperty('data.event')
    expect(snapshot.tabGroups).toHaveLength(1)
  })

  it('can restore the durable snapshot to visible Redux and Jotai account state', () => {
    const state = createState()
    const snapshot = createGuestDataSnapshot({ state, tabGroups, now: 100 })

    const restored = createGuestSnapshotImportData(snapshot, state.user.bible.settings)

    expect(restored.bible.bookmarks).toHaveProperty('bookmark')
    expect(restored.bible.relations).toEqual({ manual: expect.any(Object) })
    expect(restored.studies).toEqual({})
    expect(restored.plan).toEqual(snapshot.plan)
    expect(restored.bible.settings?.defaultBibleVersion).toBe('LSG')
    expect(restored.bible.settings?.redWordsDisplay).toBe(true)
    expect(restored.tabGroups?.[0]).toMatchObject({ id: 'group', activeTabIndex: 0 })
  })
})

describe('guest adoption checkpoint and replay', () => {
  it('keeps a pending snapshot permanently bound to its destination UID', () => {
    const repository = createGuestAdoptionRepository(new MemoryStorage())
    const snapshot = createGuestDataSnapshot({ state: createState(), tabGroups, now: 100 })

    repository.begin('user-a', snapshot, 101)

    expect(() => repository.begin('user-b', snapshot, 102)).toThrow(
      'GUEST_ADOPTION_PENDING_UID_MISMATCH'
    )
    expect(repository.getPendingForUser('user-b')).toBeUndefined()
    expect(repository.getPendingForUser('user-a')).toMatchObject({
      userId: 'user-a',
      snapshot: { id: snapshot.id },
    })
  })

  it('rejects an unsupported persisted snapshot schema', () => {
    const storage = new MemoryStorage()
    const repository = createGuestAdoptionRepository(storage)
    const snapshot = createGuestDataSnapshot({ state: createState(), tabGroups, now: 100 })
    repository.begin('user-a', snapshot, 101)
    const [pendingKey] = storage.values.keys()
    const persisted = JSON.parse(storage.values.get(pendingKey)!)
    persisted.snapshot.schemaVersion = 99
    storage.values.set(pendingKey, JSON.stringify(persisted))

    expect(() => repository.getPending()).toThrow('GUEST_ADOPTION_CHECKPOINT_INVALID')
  })

  it('rejects persisted data outside the versioned allowlist', () => {
    const storage = new MemoryStorage()
    const repository = createGuestAdoptionRepository(storage)
    const snapshot = createGuestDataSnapshot({ state: createState(), tabGroups, now: 100 })
    repository.begin('user-a', snapshot, 101)
    const [pendingKey] = storage.values.keys()
    const persisted = JSON.parse(storage.values.get(pendingKey)!)
    persisted.snapshot.settings.defaultBibleVersion = 'LSG'
    storage.values.set(pendingKey, JSON.stringify(persisted))

    expect(() => repository.getPending()).toThrow('GUEST_ADOPTION_CHECKPOINT_INVALID')
  })

  it('replays a partially failed snapshot without duplicates and completes once', async () => {
    const storage = new MemoryStorage()
    let repository = createGuestAdoptionRepository(storage)
    const remote = new MemoryRemote()
    const snapshot = createGuestDataSnapshot({ state: createState(), tabGroups, now: 100 })
    repository.begin('user-a', snapshot, 101)
    remote.failOnceAt = 'notes'

    await expect(
      runPendingGuestAdoption({
        userId: 'user-a',
        repository,
        remote,
        getAuthenticatedUserId: () => 'user-a',
        now: () => 102,
      })
    ).resolves.toMatchObject({ status: 'pending', errorCode: 'GUEST_ADOPTION_UNAVAILABLE' })

    repository = createGuestAdoptionRepository(storage)

    await expect(
      runPendingGuestAdoption({
        userId: 'user-a',
        repository,
        remote,
        getAuthenticatedUserId: () => 'user-a',
        now: () => 103,
      })
    ).resolves.toMatchObject({ status: 'completed', snapshotId: snapshot.id })

    expect(remote.subcollections.get('user-a/bookmarks')?.size).toBe(1)
    expect(remote.subcollections.get('user-a/relations')?.has('manual')).toBe(true)
    expect(remote.subcollections.get('user-a/relations')?.has('system')).toBe(false)
    expect(remote.subcollections.get('user-a/relationIndex')?.size).toBeGreaterThan(0)
    expect(remote.subcollections.get('user-a/relationPairs')?.size).toBeGreaterThan(0)
    expect(remote.userDocuments.get('user-a')).toMatchObject({ id: 'user-a' })
    expect(repository.getPendingForUser('user-a')).toBeUndefined()
    expect(repository.getCompleted('user-a')).toMatchObject({ snapshotId: snapshot.id })
  })

  it('reuses the first durable snapshot when authentication callbacks repeat', () => {
    const repository = createGuestAdoptionRepository(new MemoryStorage())
    const first = createGuestDataSnapshot({ state: createState(), tabGroups, now: 100 })
    const later = createGuestDataSnapshot({ state: createState(), tabGroups, now: 200 })

    repository.begin('user-a', first, 101)

    expect(repository.begin('user-a', later, 201).snapshot).toEqual(first)
  })

  it('catches up edits and deletions made while the durable snapshot is pending', async () => {
    const repository = createGuestAdoptionRepository(new MemoryStorage())
    const remote = new MemoryRemote()
    const initialState = createState()
    const initial = createGuestDataSnapshot({ state: initialState, tabGroups, now: 100 })
    repository.begin('user-a', initial, 101)

    const currentState = createState()
    currentState.user.bible.bookmarks = {
      later: { id: 'later', book: 2, chapter: 2, date: 20, name: 'Later', color: 'yellow' },
    }
    const latest = createGuestDataSnapshot({ state: currentState, tabGroups, now: 102 })

    await expect(
      runPendingGuestAdoption({
        userId: 'user-a',
        repository,
        remote,
        getAuthenticatedUserId: () => 'user-a',
        getLatestSnapshot: () => latest,
        now: () => 103,
      })
    ).resolves.toMatchObject({ status: 'completed' })

    expect([...remote.subcollections.get('user-a/bookmarks')!.keys()]).toEqual(['later'])
  })

  it('resumes an interrupted catch-up pass with its deletion baseline after restart', async () => {
    const storage = new MemoryStorage()
    let repository = createGuestAdoptionRepository(storage)
    const remote = new MemoryRemote()
    const initial = createGuestDataSnapshot({ state: createState(), tabGroups, now: 100 })
    repository.begin('user-a', initial, 101)

    const currentState = createState()
    currentState.user.bible.bookmarks = {
      later: { id: 'later', book: 2, chapter: 2, date: 20, name: 'Later', color: 'yellow' },
    }
    const latest = createGuestDataSnapshot({ state: currentState, tabGroups, now: 102 })
    let snapshotReadCount = 0
    remote.failOnceAtCall = { collection: 'notes', call: 2 }

    await expect(
      runPendingGuestAdoption({
        userId: 'user-a',
        repository,
        remote,
        getAuthenticatedUserId: () => 'user-a',
        getLatestSnapshot: () => (snapshotReadCount++ === 0 ? initial : latest),
        now: () => 103,
      })
    ).resolves.toMatchObject({ status: 'pending', errorCode: 'GUEST_ADOPTION_UNAVAILABLE' })

    repository = createGuestAdoptionRepository(storage)
    expect(repository.getPendingForUser('user-a')).toMatchObject({
      snapshot: { id: latest.id },
      appliedSnapshot: { id: initial.id },
      inFlightSnapshot: { id: latest.id },
    })

    await expect(
      runPendingGuestAdoption({
        userId: 'user-a',
        repository,
        remote,
        getAuthenticatedUserId: () => 'user-a',
        getLatestSnapshot: () => latest,
        now: () => 104,
      })
    ).resolves.toMatchObject({ status: 'completed', snapshotId: initial.id })

    expect([...remote.subcollections.get('user-a/bookmarks')!.keys()]).toEqual(['later'])
  })

  it('aborts before writing when the authenticated UID changed', async () => {
    const repository = createGuestAdoptionRepository(new MemoryStorage())
    const remote = new MemoryRemote()
    const snapshot = createGuestDataSnapshot({ state: createState(), tabGroups, now: 100 })
    repository.begin('user-a', snapshot, 101)

    await expect(
      runPendingGuestAdoption({
        userId: 'user-a',
        repository,
        remote,
        getAuthenticatedUserId: () => 'user-b',
        now: () => 102,
      })
    ).resolves.toMatchObject({ status: 'pending', errorCode: 'GUEST_ADOPTION_UID_CHANGED' })

    expect(remote.subcollections.size).toBe(0)
    expect(repository.getPendingForUser('user-a')).toBeDefined()
  })
})
