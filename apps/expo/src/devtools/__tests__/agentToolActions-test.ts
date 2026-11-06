import type {
  OfflineResourceRegistryEntry,
  OfflineResourceRegistrySnapshot,
} from '~features/resources/resourceAvailability'
import type { FirestoreSyncOutboxEntry } from '~helpers/firestoreSyncOutbox'
import type { MobileResourceCatalog } from '~helpers/mobileResourceCatalog'
import type { RootState } from '~redux/store'
import {
  countUserData,
  describeOfflineResources,
  describeSyncState,
  planPassageTab,
} from '../agentToolActions'

jest.mock('~helpers/bibleVersions', () => ({ versions: { LSG: {}, KJV: {} } }))
jest.mock('~helpers/generateUUID', () => ({ __esModule: true, default: () => 'new-tab' }))
jest.mock('~state/tabs', () => ({
  getDefaultBibleTab: (version: string) => ({ type: 'bible', data: { selectedVersion: version } }),
}))
jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  getLanguage: () => 'fr',
  t: (key: string) => key,
}))

const bibleEntry = (versionId: string, status: string): OfflineResourceRegistryEntry =>
  ({
    id: `bible:${versionId}`,
    resource: { kind: 'bible', versionId },
    availability: { status, resource: { kind: 'bible', versionId } },
    verified: true,
    updateAvailable: false,
  }) as OfflineResourceRegistryEntry

const stateWith = (user: Record<string, unknown>) => ({ user }) as unknown as RootState

describe('agent tool actions', () => {
  it('plans a tab on the passage a reader writes', () => {
    const plan = planPassageTab({ reference: 'Jean 3:16' })

    expect(plan).toMatchObject({
      tab: { type: 'bible' },
      passage: { book: 43, chapter: 3, startVerse: 16, endVerse: 16, bibleVersion: 'LSG' },
    })
  })

  it('reports a reference it cannot read or a version it does not know', () => {
    expect(planPassageTab({ reference: 'Livre inconnu 99' })).toEqual({
      error: 'No Bible reference found in "Livre inconnu 99".',
    })
    expect(planPassageTab({ reference: 'Jean 3:16', bibleVersion: 'NOPE' })).toEqual({
      error: 'Cannot open "Jean 3:16" in NOPE.',
    })
  })

  it('counts the study data of the user, missing collections as zero', () => {
    const state = stateWith({
      bible: {
        highlights: { '43-3-16': {}, '43-3-17': {} },
        notes: { a: {} },
        tags: {},
        studies: {},
      },
    })

    expect(countUserData(state)).toEqual({
      highlights: 2,
      wordAnnotations: 0,
      notes: 1,
      bookmarks: 0,
      tags: 0,
      studies: 0,
      links: 0,
      relations: 0,
    })
  })

  it('lists the Offline copies the Downloads screen counts as downloaded', () => {
    const snapshot: OfflineResourceRegistrySnapshot = {
      revision: 3,
      phase: 'ready',
      resources: new Map(
        [
          bibleEntry('LSG', 'available'),
          bibleEntry('KJV', 'missing'),
          bibleEntry('DBY', 'corrupt'),
        ].map(entry => [entry.id, entry])
      ),
    }
    const catalog = {
      resources: { 'bible:LSG': { installedBytes: 4_000_000 } },
    } as unknown as MobileResourceCatalog

    expect(describeOfflineResources(snapshot, catalog)).toEqual({
      phase: 'ready',
      known: 3,
      installed: 2,
      installedBytes: 4_000_000,
      resources: [
        { id: 'bible:LSG', status: 'available', updateAvailable: false, installedBytes: 4_000_000 },
        { id: 'bible:DBY', status: 'corrupt', updateAvailable: false, installedBytes: null },
      ],
    })
  })

  it('sums the writes waiting in the outbox', () => {
    const pending = [
      { intent: { kind: 'subcollection' }, createdAt: 2_000 },
      { intent: { kind: 'subcollection' }, createdAt: 1_000, parkedAt: 3_000 },
      { intent: { kind: 'document-set' }, createdAt: 5_000 },
    ] as FirestoreSyncOutboxEntry[]
    const migration = { inProgress: false, writeAllowed: true, outgoingOnly: false }

    const description = describeSyncState({
      state: stateWith({ id: 'user-1', email: 'reader@example.com', sync: { isLoading: false } }),
      pending,
      migration,
    })

    expect(description).toMatchObject({
      signedIn: true,
      userId: 'user-1',
      outbox: {
        pending: 3,
        parked: 1,
        byKind: { subcollection: 2, 'document-set': 1 },
        oldestCreatedAt: new Date(1_000).toISOString(),
      },
      migration,
    })
  })
})
