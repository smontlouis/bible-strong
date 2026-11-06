/**
 * What coding agents can ask the running app in development: open a passage, read the sync
 * state, count the user's study data, list the Offline copies. Each function returns plain
 * JSON and none of them writes user data. `AgentTools.tsx` exposes them on
 * `globalThis.__BIBLE_STRONG_AGENT__`, which agents call through the JS debugger.
 */
import type { BcvLanguage } from '~helpers/bcvParser'
import { parseBibleReferenceSegments } from '~helpers/bcvParser'
import { createPassageTab } from '~features/app-switcher/tabOpenRequest'
import { resourceNeedsUpdate } from '~features/resources/availableUpdates'
import type { OfflineResourceRegistrySnapshot } from '~features/resources/resourceAvailability'
import { getAgentLogEvents } from '~helpers/agentObservability'
import type { FirestoreSyncOutboxEntry } from '~helpers/firestoreSyncOutbox'
import type { MobileResourceCatalog } from '~helpers/mobileResourceCatalog'
import { getOfflineCopyCatalogId } from '~helpers/offlineCopyId'
import type { RootState } from '~redux/store'
import type { TabItem } from '~state/tabs'

export type OpenPassageArgs = {
  /** A reference as a reader writes it: « Jean 3:16 », « Rom 8 », « John 3:16-18 ». */
  reference: string
  /** A Bible version code; LSG when absent. */
  bibleVersion?: string
  /** The language the reference is written in; French when absent. */
  language?: BcvLanguage
}

export type OpenPassagePlan =
  | {
      tab: TabItem
      passage: {
        title: string
        book: number
        chapter: number
        startVerse: number
        endVerse: number
        bibleVersion: string
      }
    }
  | { error: string }

/** The tab that shows a reference, ready for `openInNewTab`. */
export const planPassageTab = ({
  reference,
  bibleVersion = 'LSG',
  language = 'fr',
}: OpenPassageArgs): OpenPassagePlan => {
  const [segment] = parseBibleReferenceSegments(reference, language)
  if (!segment) return { error: `No Bible reference found in "${reference}".` }

  const tab = createPassageTab({ tabType: 'bible', version: bibleVersion, ...segment })
  if (!tab) return { error: `Cannot open "${reference}" in ${bibleVersion}.` }

  return {
    tab,
    passage: {
      title: tab.title,
      book: segment.book,
      chapter: segment.chapter,
      startVerse: segment.startVerse,
      endVerse: segment.endVerse,
      bibleVersion,
    },
  }
}

const count = (collection: object | undefined) => Object.keys(collection ?? {}).length

/** The study data of the user, counted as the Profile screen counts it. */
export const countUserData = (state: RootState) => {
  const { bible } = state.user
  return {
    highlights: count(bible.highlights),
    wordAnnotations: count(bible.wordAnnotations),
    notes: count(bible.notes),
    bookmarks: count(bible.bookmarks),
    tags: count(bible.tags),
    studies: count(bible.studies),
    links: count(bible.links),
    relations: count(bible.relations),
  }
}

export type SyncStateSources = {
  state: RootState
  pending: FirestoreSyncOutboxEntry[]
  migration: { inProgress: boolean; writeAllowed: boolean | null; outgoingOnly: boolean | null }
}

/** Who is signed in, where the initial load stands, and what still waits to reach Firestore. */
export const describeSyncState = ({ state, pending, migration }: SyncStateSources) => {
  const userId = state.user.id || null
  const byKind: Record<string, number> = {}
  for (const entry of pending) byKind[entry.intent.kind] = (byKind[entry.intent.kind] ?? 0) + 1
  const oldest = pending.reduce<number | null>(
    (min, entry) => (min === null || entry.createdAt < min ? entry.createdAt : min),
    null
  )

  return {
    signedIn: userId !== null,
    userId,
    email: state.user.email || null,
    initialLoad: state.user.sync,
    outbox: {
      pending: pending.length,
      parked: pending.filter(entry => entry.parkedAt !== undefined).length,
      byKind,
      oldestCreatedAt: oldest === null ? null : new Date(oldest).toISOString(),
    },
    migration,
    recentSyncEvents: getAgentLogEvents()
      .filter(event => event.area === 'sync')
      .slice(-10),
  }
}

/** The Downloads screen counts these statuses as downloaded. */
const DOWNLOADED_STATUSES = new Set([
  'available',
  'corrupt',
  'outdated',
  'incompatible',
  'core-missing',
])

/** The Offline copies on the device, with their state and the size the catalog gives them. */
export const describeOfflineResources = (
  snapshot: OfflineResourceRegistrySnapshot,
  catalog: MobileResourceCatalog
) => {
  const resources = [...snapshot.resources.values()]
    .filter(entry => DOWNLOADED_STATUSES.has(entry.availability.status))
    .map(entry => ({
      id: entry.id,
      status: entry.availability.status,
      updateAvailable: resourceNeedsUpdate(entry),
      installedBytes:
        catalog.resources[getOfflineCopyCatalogId(entry.resource)]?.installedBytes ?? null,
    }))

  return {
    phase: snapshot.phase,
    known: snapshot.resources.size,
    installed: resources.length,
    installedBytes: resources.reduce(
      (total, resource) => total + (resource.installedBytes ?? 0),
      0
    ),
    resources,
  }
}
