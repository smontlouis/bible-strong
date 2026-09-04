import {
  mergeRelationsWithSystemBackfill,
  rebuildRelationIndexes,
  rebuildRelationPairs,
  type Relation,
  type RelationsObj,
} from '~features/studyRelations/domain'
import type { RootState } from '~redux/modules/reducer'
import type { ImportDataPayload } from '~redux/modules/user'
import type { TabGroup, TabItem } from '~state/tabs'

export const GUEST_DATA_SNAPSHOT_SCHEMA_VERSION = 1 as const

const PENDING_STORAGE_KEY = 'guestDataAdoption.pending.v1'
const COMPLETED_STORAGE_KEY = 'guestDataAdoption.completed.v1'

type JsonRecord = Record<string, unknown>
type GuestAdoptionCollection =
  | 'bookmarks'
  | 'highlights'
  | 'notes'
  | 'links'
  | 'relations'
  | 'tags'
  | 'strongsHebreu'
  | 'strongsGrec'
  | 'words'
  | 'naves'
  | 'wordAnnotations'

type GuestAdoptionDerivedCollection = 'relationIndex' | 'relationPairs'
type GuestDataSubcollections = Pick<RootState['user']['bible'], GuestAdoptionCollection>
type BibleSettings = RootState['user']['bible']['settings']
type Links = RootState['user']['bible']['links']

const accountSyncedSettingKeys = [
  'defaultStrongBibleVersionId',
  'alignContent',
  'lineHeight',
  'fontSizeScale',
  'textDisplay',
  'preferredColorScheme',
  'preferredLightTheme',
  'preferredDarkTheme',
  'press',
  'notesDisplay',
  'linksDisplay',
  'relationsDisplay',
  'tagsDisplay',
  'commentsDisplay',
  'contextualInformationDisplay',
  'shareVerses',
  'colors',
  'compare',
  'customHighlightColors',
  'defaultColorNames',
  'defaultColorTypes',
] as const satisfies readonly (keyof BibleSettings)[]

export type AccountSyncedBibleSettings = Pick<
  BibleSettings,
  (typeof accountSyncedSettingKeys)[number]
>

type EligibleGuestAdoptionTab = Exclude<TabItem, { type: 'study' }>
type WithoutPreview<T> = T extends unknown ? Omit<T, 'base64Preview'> : never

export type GuestAdoptionTab = WithoutPreview<EligibleGuestAdoptionTab>
export type GuestAdoptionTabGroup = Omit<TabGroup, 'tabs' | 'activeTabIndex'> & {
  tabs: GuestAdoptionTab[]
}

export type GuestDataSnapshot = {
  schemaVersion: typeof GUEST_DATA_SNAPSHOT_SCHEMA_VERSION
  id: string
  createdAt: number
  subcollections: GuestDataSubcollections
  settings: AccountSyncedBibleSettings
  plan: RootState['plan']['ongoingPlans']
  tabGroups: GuestAdoptionTabGroup[]
}

export type GuestAdoptionErrorCode =
  | 'GUEST_ADOPTION_CHECKPOINT_INVALID'
  | 'GUEST_ADOPTION_PENDING_UID_MISMATCH'
  | 'GUEST_ADOPTION_UID_CHANGED'
  | 'GUEST_ADOPTION_CANCELLED'
  | 'GUEST_ADOPTION_TIMEOUT'
  | 'GUEST_ADOPTION_PERMISSION_DENIED'
  | 'GUEST_ADOPTION_UNAVAILABLE'
  | 'GUEST_ADOPTION_WRITE_FAILED'

export type PendingGuestAdoption = {
  status: 'pending'
  userId: string
  adoptionId: string
  snapshot: GuestDataSnapshot
  appliedSnapshot?: GuestDataSnapshot
  inFlightSnapshot?: GuestDataSnapshot
  createdAt: number
  attempts: number
  lastAttemptAt?: number
  lastErrorCode?: GuestAdoptionErrorCode
}

export type CompletedGuestAdoption = {
  status: 'completed'
  userId: string
  snapshotId: string
  completedAt: number
}

export interface GuestAdoptionStorage {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  remove(key: string): void
}

export interface GuestAdoptionRepository {
  getPending(): PendingGuestAdoption | undefined
  getPendingForUser(userId: string): PendingGuestAdoption | undefined
  getCompleted(userId: string): CompletedGuestAdoption | undefined
  begin(userId: string, snapshot: GuestDataSnapshot, now?: number): PendingGuestAdoption
  updateSnapshot(
    userId: string,
    adoptionId: string,
    snapshot: GuestDataSnapshot
  ): PendingGuestAdoption
  recordWriteStarted(
    userId: string,
    adoptionId: string,
    snapshot: GuestDataSnapshot
  ): PendingGuestAdoption
  recordWriteCompleted(userId: string, adoptionId: string, snapshotId: string): PendingGuestAdoption
  recordAttempt(userId: string, adoptionId: string, now?: number): PendingGuestAdoption
  recordFailure(
    userId: string,
    adoptionId: string,
    errorCode: GuestAdoptionErrorCode
  ): PendingGuestAdoption
  complete(userId: string, adoptionId: string, now?: number): CompletedGuestAdoption
}

export interface GuestAdoptionRemote {
  writeSubcollection(
    userId: string,
    collection: GuestAdoptionCollection | GuestAdoptionDerivedCollection | 'tabGroups',
    documents: Record<string, JsonRecord>,
    deleteIds?: string[]
  ): Promise<void>
  writeAccountDocument(userId: string, document: JsonRecord): Promise<void>
  waitForPendingWrites(): Promise<void>
}

type GuestAdoptionCounts = Record<
  GuestAdoptionCollection | GuestAdoptionDerivedCollection | 'tabGroups',
  number
>

export type GuestAdoptionRunResult =
  | {
      status: 'completed'
      snapshotId: string
      counts: GuestAdoptionCounts
    }
  | {
      status: 'pending'
      snapshotId?: string
      errorCode: GuestAdoptionErrorCode
    }

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const removeUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(removeUndefined).filter(item => item !== undefined) as T
  }
  if (!value || typeof value !== 'object') return value

  const result: JsonRecord = {}
  Object.entries(value as JsonRecord).forEach(([key, child]) => {
    if (child !== undefined) result[key] = removeUndefined(child)
  })
  return result as T
}

const hashSnapshotPayload = (payload: unknown): string => {
  const json = JSON.stringify(payload)
  let hash = 2166136261
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${json.length}-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

const sanitizeTags = (
  tags: RootState['user']['bible']['tags']
): RootState['user']['bible']['tags'] =>
  Object.entries(tags).reduce<RootState['user']['bible']['tags']>((result, [tagId, tag]) => {
    const { studies: _studies, ...eligibleTag } = tag
    result[tagId] = cloneJson(eligibleTag) as typeof tag
    return result
  }, {})

const isEligibleManualRelation = (relation: Relation): boolean =>
  relation.kind === 'manual' && relation.endpoints.every(endpoint => endpoint.type !== 'study')

const sanitizeManualRelations = (relations: RelationsObj): RelationsObj =>
  Object.values(relations).reduce<RelationsObj>((result, relation) => {
    if (isEligibleManualRelation(relation)) result[relation.id] = cloneJson(relation)
    return result
  }, {})

const sanitizeLinks = (links: Links): Links =>
  Object.entries(links).reduce<Links>((result, [linkId, link]) => {
    const { ogData: _ogData, ...accountOwnedLink } = link
    result[linkId] = cloneJson(accountOwnedLink)
    return result
  }, {})

const sanitizeTab = (tab: EligibleGuestAdoptionTab): GuestAdoptionTab => {
  const { base64Preview: _base64Preview, ...accountOwnedTab } = tab

  if (accountOwnedTab.type === 'bible') {
    const {
      pendingModeAcquisition: _pendingModeAcquisition,
      focusVerses: _focusVerses,
      isSelectionMode: _isSelectionMode,
      entityReference: _entityReference,
      temp: _temp,
      ...accountOwnedData
    } = accountOwnedTab.data

    return removeUndefined({
      ...accountOwnedTab,
      data: {
        ...accountOwnedData,
        temp: {
          selectedBook: accountOwnedData.selectedBook,
          selectedChapter: accountOwnedData.selectedChapter,
          selectedVerse: accountOwnedData.selectedVerse,
        },
        selectedVerses: {},
      },
    }) as GuestAdoptionTab
  }

  if (accountOwnedTab.type === 'compare') {
    return {
      ...accountOwnedTab,
      data: { ...accountOwnedTab.data, selectedVerses: {} },
    }
  }

  if (accountOwnedTab.type === 'timeline') {
    const { event: _event, ...accountOwnedData } = accountOwnedTab.data
    return removeUndefined({ ...accountOwnedTab, data: accountOwnedData }) as GuestAdoptionTab
  }

  return accountOwnedTab
}

const sanitizeTabGroups = (groups: TabGroup[]): GuestAdoptionTabGroup[] =>
  groups.flatMap(group => {
    const { activeTabIndex: _activeTabIndex, tabs, ...accountOwnedGroup } = group
    const accountOwnedTabs = tabs
      .filter((tab): tab is EligibleGuestAdoptionTab => tab.type !== 'study')
      .map(sanitizeTab)
    if (accountOwnedTabs.length === 0) return []

    return [
      removeUndefined({
        ...accountOwnedGroup,
        tabs: accountOwnedTabs,
      }) as GuestAdoptionTabGroup,
    ]
  })

const pickAccountSyncedSettings = (settings: BibleSettings): AccountSyncedBibleSettings =>
  accountSyncedSettingKeys.reduce((result, key) => {
    if (settings[key] !== undefined) {
      ;(result as Record<keyof BibleSettings, unknown>)[key] = cloneJson(settings[key])
    }
    return result
  }, {} as AccountSyncedBibleSettings)

export const createGuestDataSnapshot = ({
  state,
  tabGroups,
  now = Date.now(),
}: {
  state: RootState
  tabGroups: TabGroup[]
  now?: number
}): GuestDataSnapshot => {
  const { bible } = state.user
  const payload = removeUndefined({
    subcollections: {
      bookmarks: cloneJson(bible.bookmarks),
      highlights: cloneJson(bible.highlights),
      notes: cloneJson(bible.notes),
      links: sanitizeLinks(bible.links),
      relations: sanitizeManualRelations(bible.relations),
      tags: sanitizeTags(bible.tags),
      strongsHebreu: cloneJson(bible.strongsHebreu),
      strongsGrec: cloneJson(bible.strongsGrec),
      words: cloneJson(bible.words),
      naves: cloneJson(bible.naves),
      wordAnnotations: cloneJson(bible.wordAnnotations),
    },
    settings: pickAccountSyncedSettings(bible.settings),
    plan: cloneJson(state.plan.ongoingPlans),
    tabGroups: sanitizeTabGroups(tabGroups),
  })

  return {
    schemaVersion: GUEST_DATA_SNAPSHOT_SCHEMA_VERSION,
    id: `guest-v${GUEST_DATA_SNAPSHOT_SCHEMA_VERSION}-${hashSnapshotPayload(payload)}`,
    createdAt: now,
    ...payload,
  }
}

export const createGuestSnapshotImportData = (
  snapshot: GuestDataSnapshot,
  deviceSettings: BibleSettings
): ImportDataPayload => ({
  bible: {
    ...cloneJson(snapshot.subcollections),
    settings: {
      ...cloneJson(deviceSettings),
      ...cloneJson(snapshot.settings),
    },
  },
  studies: {},
  plan: cloneJson(snapshot.plan),
  tabGroups: snapshot.tabGroups.map(group => ({
    ...cloneJson(group),
    activeTabIndex: 0,
    tabs: group.tabs.map(tab => ({ ...cloneJson(tab), base64Preview: undefined })) as TabItem[],
  })),
})

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const hasOnlyKeys = (value: JsonRecord, allowedKeys: readonly string[]): boolean => {
  const allowed = new Set(allowedKeys)
  return Object.keys(value).every(key => allowed.has(key))
}

const snapshotCollectionNames: GuestAdoptionCollection[] = [
  'bookmarks',
  'highlights',
  'notes',
  'links',
  'relations',
  'tags',
  'strongsHebreu',
  'strongsGrec',
  'words',
  'naves',
  'wordAnnotations',
]

const isGuestDataSnapshot = (value: unknown): value is GuestDataSnapshot => {
  if (!isRecord(value)) return false
  if (
    !hasOnlyKeys(value, [
      'schemaVersion',
      'id',
      'createdAt',
      'subcollections',
      'settings',
      'plan',
      'tabGroups',
    ]) ||
    value.schemaVersion !== GUEST_DATA_SNAPSHOT_SCHEMA_VERSION ||
    typeof value.id !== 'string' ||
    typeof value.createdAt !== 'number' ||
    !isRecord(value.subcollections) ||
    !isRecord(value.settings) ||
    !Array.isArray(value.plan) ||
    !Array.isArray(value.tabGroups)
  ) {
    return false
  }

  const subcollections = value.subcollections
  if (!hasOnlyKeys(subcollections, snapshotCollectionNames)) return false
  if (!snapshotCollectionNames.every(collection => isRecord(subcollections[collection]))) {
    return false
  }
  if (!hasOnlyKeys(value.settings, accountSyncedSettingKeys)) return false
  if (
    Object.values(subcollections.links as JsonRecord).some(
      link => !isRecord(link) || 'ogData' in link
    )
  ) {
    return false
  }
  if (
    Object.values(subcollections.tags as JsonRecord).some(tag => !isRecord(tag) || 'studies' in tag)
  ) {
    return false
  }

  return value.tabGroups.every(group => {
    if (!isRecord(group) || !Array.isArray(group.tabs) || 'activeTabIndex' in group) return false
    return group.tabs.every(
      tab =>
        isRecord(tab) &&
        tab.type !== 'study' &&
        !('base64Preview' in tab) &&
        isRecord(tab.data) &&
        !('pendingModeAcquisition' in tab.data) &&
        !('focusVerses' in tab.data) &&
        !('isSelectionMode' in tab.data) &&
        !('entityReference' in tab.data) &&
        !('event' in tab.data)
    )
  })
}

const isPendingGuestAdoption = (value: unknown): value is PendingGuestAdoption =>
  isRecord(value) &&
  value.status === 'pending' &&
  typeof value.userId === 'string' &&
  typeof value.adoptionId === 'string' &&
  typeof value.createdAt === 'number' &&
  typeof value.attempts === 'number' &&
  isGuestDataSnapshot(value.snapshot) &&
  (value.appliedSnapshot === undefined || isGuestDataSnapshot(value.appliedSnapshot)) &&
  (value.inFlightSnapshot === undefined || isGuestDataSnapshot(value.inFlightSnapshot))

const isCompletedGuestAdoption = (value: unknown): value is CompletedGuestAdoption =>
  isRecord(value) &&
  value.status === 'completed' &&
  typeof value.userId === 'string' &&
  typeof value.snapshotId === 'string' &&
  typeof value.completedAt === 'number'

const parseCheckpoint = <T>(
  raw: string | undefined,
  validate: (value: unknown) => value is T
): T | undefined => {
  if (!raw) return undefined
  try {
    const value = JSON.parse(raw) as unknown
    if (!validate(value)) {
      throw new Error('invalid checkpoint')
    }
    return value
  } catch {
    throw new Error('GUEST_ADOPTION_CHECKPOINT_INVALID')
  }
}

const assertPendingIdentity = (
  pending: PendingGuestAdoption | undefined,
  userId: string,
  adoptionId: string
): PendingGuestAdoption => {
  if (!pending || pending.userId !== userId || pending.adoptionId !== adoptionId) {
    throw new Error('GUEST_ADOPTION_PENDING_UID_MISMATCH')
  }
  return pending
}

export const createGuestAdoptionRepository = (
  storage: GuestAdoptionStorage
): GuestAdoptionRepository => ({
  getPending: () => parseCheckpoint(storage.getString(PENDING_STORAGE_KEY), isPendingGuestAdoption),
  getPendingForUser(userId) {
    const pending = this.getPending()
    return pending?.userId === userId ? pending : undefined
  },
  getCompleted(userId) {
    const completed = parseCheckpoint(
      storage.getString(COMPLETED_STORAGE_KEY),
      isCompletedGuestAdoption
    )
    return completed?.userId === userId ? completed : undefined
  },
  begin(userId, snapshot, now = Date.now()) {
    const existing = this.getPending()
    if (existing) {
      if (existing.userId !== userId) {
        throw new Error('GUEST_ADOPTION_PENDING_UID_MISMATCH')
      }
      return existing
    }

    const pending: PendingGuestAdoption = {
      status: 'pending',
      userId,
      adoptionId: snapshot.id,
      snapshot,
      createdAt: now,
      attempts: 0,
    }
    storage.set(PENDING_STORAGE_KEY, JSON.stringify(pending))
    return pending
  },
  updateSnapshot(userId, adoptionId, snapshot) {
    const pending = assertPendingIdentity(this.getPending(), userId, adoptionId)
    const next = { ...pending, snapshot }
    storage.set(PENDING_STORAGE_KEY, JSON.stringify(next))
    return next
  },
  recordWriteStarted(userId, adoptionId, snapshot) {
    const pending = assertPendingIdentity(this.getPending(), userId, adoptionId)
    if (pending.inFlightSnapshot && pending.inFlightSnapshot.id !== snapshot.id) {
      throw new Error('GUEST_ADOPTION_CHECKPOINT_INVALID')
    }
    const next = { ...pending, inFlightSnapshot: snapshot }
    storage.set(PENDING_STORAGE_KEY, JSON.stringify(next))
    return next
  },
  recordWriteCompleted(userId, adoptionId, snapshotId) {
    const pending = assertPendingIdentity(this.getPending(), userId, adoptionId)
    if (!pending.inFlightSnapshot || pending.inFlightSnapshot.id !== snapshotId) {
      throw new Error('GUEST_ADOPTION_CHECKPOINT_INVALID')
    }
    const next = {
      ...pending,
      appliedSnapshot: pending.inFlightSnapshot,
      inFlightSnapshot: undefined,
    }
    storage.set(PENDING_STORAGE_KEY, JSON.stringify(next))
    return next
  },
  recordAttempt(userId, adoptionId, now = Date.now()) {
    const pending = assertPendingIdentity(this.getPending(), userId, adoptionId)
    const next: PendingGuestAdoption = {
      ...pending,
      attempts: pending.attempts + 1,
      lastAttemptAt: now,
      lastErrorCode: undefined,
    }
    storage.set(PENDING_STORAGE_KEY, JSON.stringify(next))
    return next
  },
  recordFailure(userId, adoptionId, errorCode) {
    const pending = assertPendingIdentity(this.getPending(), userId, adoptionId)
    const next = { ...pending, lastErrorCode: errorCode }
    storage.set(PENDING_STORAGE_KEY, JSON.stringify(next))
    return next
  },
  complete(userId, adoptionId, now = Date.now()) {
    const pending = assertPendingIdentity(this.getPending(), userId, adoptionId)
    if (pending.inFlightSnapshot || pending.appliedSnapshot?.id !== pending.snapshot.id) {
      throw new Error('GUEST_ADOPTION_CHECKPOINT_INVALID')
    }
    const completed: CompletedGuestAdoption = {
      status: 'completed',
      userId,
      snapshotId: adoptionId,
      completedAt: now,
    }
    storage.set(COMPLETED_STORAGE_KEY, JSON.stringify(completed))
    storage.remove(PENDING_STORAGE_KEY)
    return completed
  },
})

const sourceCollectionOrder: GuestAdoptionCollection[] = [
  'bookmarks',
  'highlights',
  'notes',
  'links',
  'tags',
  'strongsHebreu',
  'strongsGrec',
  'words',
  'naves',
  'wordAnnotations',
]

const asRemoteDocuments = (documents: object): Record<string, JsonRecord> =>
  documents as Record<string, JsonRecord>

const getDeletedDocumentIds = (previous: object | undefined, current: object): string[] =>
  previous ? Object.keys(previous).filter(documentId => !(documentId in current)) : []

const buildDerivedRelationCollections = (snapshot: GuestDataSnapshot) => {
  const relations = mergeRelationsWithSystemBackfill({
    relations: snapshot.subcollections.relations,
    notes: snapshot.subcollections.notes,
    links: snapshot.subcollections.links,
    wordAnnotations: snapshot.subcollections.wordAnnotations,
  })
  return {
    relations,
    relationIndex: rebuildRelationIndexes(relations),
    relationPairs: rebuildRelationPairs(relations),
  }
}

const assertAuthenticatedUser = (
  expectedUserId: string,
  getAuthenticatedUserId: () => string | undefined
) => {
  if (getAuthenticatedUserId() !== expectedUserId) {
    throw new Error('GUEST_ADOPTION_UID_CHANGED')
  }
}

const classifyAdoptionError = (error: unknown): GuestAdoptionErrorCode => {
  if (error instanceof Error) {
    if (error.message === 'GUEST_ADOPTION_CHECKPOINT_INVALID') {
      return 'GUEST_ADOPTION_CHECKPOINT_INVALID'
    }
    if (error.message === 'GUEST_ADOPTION_UID_CHANGED') return 'GUEST_ADOPTION_UID_CHANGED'
    if (error.message === 'GUEST_ADOPTION_CANCELLED') return 'GUEST_ADOPTION_CANCELLED'
    if (error.message === 'GUEST_ADOPTION_TIMEOUT') return 'GUEST_ADOPTION_TIMEOUT'
    if (error.message === 'GUEST_ADOPTION_PENDING_UID_MISMATCH') {
      return 'GUEST_ADOPTION_PENDING_UID_MISMATCH'
    }
  }

  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined
  if (code?.includes('permission-denied')) return 'GUEST_ADOPTION_PERMISSION_DENIED'
  if (
    code?.includes('unavailable') ||
    code?.includes('network-request-failed') ||
    code?.includes('deadline-exceeded')
  ) {
    return 'GUEST_ADOPTION_UNAVAILABLE'
  }
  return 'GUEST_ADOPTION_WRITE_FAILED'
}

const withGuestAdoptionDeadline = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> => {
  if (signal?.aborted) throw new Error('GUEST_ADOPTION_CANCELLED')

  let timeout: ReturnType<typeof setTimeout> | undefined
  let rejectCancellation: ((error: Error) => void) | undefined
  const deadline = new Promise<never>((_, reject) => {
    rejectCancellation = reject
    timeout = setTimeout(() => reject(new Error('GUEST_ADOPTION_TIMEOUT')), timeoutMs)
  })
  const cancel = () => rejectCancellation?.(new Error('GUEST_ADOPTION_CANCELLED'))
  signal?.addEventListener('abort', cancel, { once: true })

  try {
    return await Promise.race([operation, deadline])
  } finally {
    if (timeout) clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}

const writeSnapshot = async ({
  userId,
  snapshot,
  previousSnapshot,
  remote,
  getAuthenticatedUserId,
}: {
  userId: string
  snapshot: GuestDataSnapshot
  previousSnapshot?: GuestDataSnapshot
  remote: GuestAdoptionRemote
  getAuthenticatedUserId: () => string | undefined
}): Promise<GuestAdoptionCounts> => {
  const counts = {} as GuestAdoptionCounts

  for (const collection of sourceCollectionOrder) {
    assertAuthenticatedUser(userId, getAuthenticatedUserId)
    const documents = snapshot.subcollections[collection]
    const deleteIds = getDeletedDocumentIds(previousSnapshot?.subcollections[collection], documents)
    counts[collection] = Object.keys(documents).length
    if (counts[collection] > 0 || deleteIds.length > 0) {
      await remote.writeSubcollection(userId, collection, asRemoteDocuments(documents), deleteIds)
    }
  }

  const derivedCollections = buildDerivedRelationCollections(snapshot)
  const previousDerivedCollections = previousSnapshot
    ? buildDerivedRelationCollections(previousSnapshot)
    : undefined

  for (const [collection, documents] of Object.entries(derivedCollections) as [
    'relations' | GuestAdoptionDerivedCollection,
    JsonRecord,
  ][]) {
    assertAuthenticatedUser(userId, getAuthenticatedUserId)
    const deleteIds = getDeletedDocumentIds(previousDerivedCollections?.[collection], documents)
    counts[collection] = Object.keys(documents).length
    if (counts[collection] > 0 || deleteIds.length > 0) {
      await remote.writeSubcollection(userId, collection, asRemoteDocuments(documents), deleteIds)
    }
  }

  assertAuthenticatedUser(userId, getAuthenticatedUserId)
  await remote.writeAccountDocument(userId, {
    id: userId,
    bible: { settings: snapshot.settings },
    plan: snapshot.plan,
  })

  const tabGroupDocuments = snapshot.tabGroups.reduce<JsonRecord>((result, group) => {
    result[group.id] = group
    return result
  }, {})
  const previousTabGroupDocuments = previousSnapshot?.tabGroups.reduce<JsonRecord>(
    (result, group) => {
      result[group.id] = group
      return result
    },
    {}
  )
  const deletedTabGroupIds = getDeletedDocumentIds(previousTabGroupDocuments, tabGroupDocuments)
  counts.tabGroups = Object.keys(tabGroupDocuments).length
  if (counts.tabGroups > 0 || deletedTabGroupIds.length > 0) {
    assertAuthenticatedUser(userId, getAuthenticatedUserId)
    await remote.writeSubcollection(
      userId,
      'tabGroups',
      asRemoteDocuments(tabGroupDocuments),
      deletedTabGroupIds
    )
  }

  await remote.waitForPendingWrites()
  assertAuthenticatedUser(userId, getAuthenticatedUserId)
  return counts
}

export const runPendingGuestAdoption = async ({
  userId,
  repository,
  remote,
  getAuthenticatedUserId,
  getLatestSnapshot,
  now = Date.now,
  timeoutMs = 15000,
  signal,
}: {
  userId: string
  repository: GuestAdoptionRepository
  remote: GuestAdoptionRemote
  getAuthenticatedUserId: () => string | undefined
  getLatestSnapshot?: () => GuestDataSnapshot | undefined
  now?: () => number
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<GuestAdoptionRunResult> => {
  const pending = repository.getPendingForUser(userId)
  if (!pending) {
    return { status: 'pending', errorCode: 'GUEST_ADOPTION_PENDING_UID_MISMATCH' }
  }

  try {
    const adoptionId = pending.adoptionId
    let currentPending = pending
    let counts: GuestAdoptionCounts

    const latestBeforeAttempt = getLatestSnapshot?.()
    if (latestBeforeAttempt && latestBeforeAttempt.id !== currentPending.snapshot.id) {
      currentPending = repository.updateSnapshot(userId, adoptionId, latestBeforeAttempt)
    }
    repository.recordAttempt(userId, adoptionId, now())

    while (true) {
      currentPending = repository.getPendingForUser(userId)!
      const snapshotToWrite = currentPending.inFlightSnapshot ?? currentPending.snapshot
      if (!currentPending.inFlightSnapshot) {
        currentPending = repository.recordWriteStarted(userId, adoptionId, snapshotToWrite)
      }
      counts = await withGuestAdoptionDeadline(
        writeSnapshot({
          userId,
          snapshot: snapshotToWrite,
          previousSnapshot: currentPending.appliedSnapshot,
          remote,
          getAuthenticatedUserId,
        }),
        timeoutMs,
        signal
      )
      currentPending = repository.recordWriteCompleted(userId, adoptionId, snapshotToWrite.id)
      const latestSnapshot = getLatestSnapshot?.()
      if (latestSnapshot && latestSnapshot.id !== currentPending.snapshot.id) {
        currentPending = repository.updateSnapshot(userId, adoptionId, latestSnapshot)
      }
      if (currentPending.snapshot.id === snapshotToWrite.id) break
    }
    repository.complete(userId, adoptionId, now())
    return { status: 'completed', snapshotId: adoptionId, counts }
  } catch (error) {
    const errorCode = classifyAdoptionError(error)
    try {
      repository.recordFailure(userId, pending.adoptionId, errorCode)
    } catch {
      // The checkpoint may have been completed or replaced while the async write was running.
    }
    return { status: 'pending', snapshotId: pending.adoptionId, errorCode }
  }
}
