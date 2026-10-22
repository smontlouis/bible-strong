/* eslint-disable import/first */
import type { DownloadItem, DownloadItemState, DownloadStatus } from '~state/downloadQueue'

const mockInstallManagedResource = jest.fn((_item: unknown, _callbacks: unknown) =>
  Promise.resolve()
)
const mockCaptureError = jest.fn()
const mockCompleteDownloadPlan = jest.fn((items: unknown, _readers: unknown) => items)
const mockWarn = jest.fn()

jest.mock('expo-file-system/legacy', () => ({}))
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }))
jest.mock('@tanstack/react-query', () => ({
  onlineManager: { subscribe: jest.fn(), isOnline: () => true },
}))
jest.mock('~state/app', () => ({
  bibleDataRefreshSignalAtom: jest.requireActual('jotai/vanilla').atom(0),
}))
jest.mock('~helpers/storage', () => ({
  storage: { getString: jest.fn(), set: jest.fn() },
}))
jest.mock('~helpers/resourceInstallationJournal', () => ({
  reconcileResourceInstallationJournal: jest.fn(() => Promise.resolve()),
}))
jest.mock('~helpers/managedResourceInstallation', () => ({
  installManagedResource: (item: unknown, callbacks: unknown) =>
    mockInstallManagedResource(item, callbacks),
}))
jest.mock('~helpers/persistedDownloadItem', () => ({
  refreshPersistedDownloadItem: (item: unknown) => item,
}))
jest.mock('~helpers/downloadItemFactory', () => ({
  completeDownloadPlan: (items: unknown, readers: unknown) =>
    mockCompleteDownloadPlan(items, readers),
}))
jest.mock('~helpers/agentObservability', () => ({
  appLogger: {
    captureError: (...args: unknown[]) => mockCaptureError(...args),
    warn: (...args: unknown[]) => mockWarn(...args),
  },
}))
jest.mock('~features/resources/resourceAvailability', () => ({
  offlineResourceRegistry: { markInstalled: jest.fn(), invalidate: jest.fn() },
}))
jest.mock('~helpers/interlinearBiblePublications', () => ({
  isInterlinearCapableBibleVersion: () => false,
}))
jest.mock('~helpers/strongBiblePublications', () => ({
  isStrongCapableBibleVersion: () => false,
}))

import { getDefaultStore } from 'jotai/vanilla'

import { downloadItemStatesAtom } from '~state/downloadQueue'
import { downloadManager } from '../downloadManager'

const createItem = (id: string, dependsOnId?: string) =>
  ({
    id,
    type: 'bible',
    versionId: id,
    name: id,
    url: `https://example.com/${id}`,
    estimatedSize: 1,
    dependsOnId,
    addedAt: 0,
    retryCount: 0,
  }) as DownloadItem

const createState = (
  item: DownloadItem,
  status: DownloadStatus,
  error?: string
): DownloadItemState => ({ item, status, downloadProgress: 0, insertProgress: 0, error })

const store = getDefaultStore()
const statusOf = (id: string) => store.get(downloadItemStatesAtom).get(id)

const flushQueue = async () => {
  for (let index = 0; index < 10; index += 1) await Promise.resolve()
}

describe('download manager', () => {
  beforeAll(() => {
    // The queue persists itself after a debounce; the test never needs that write.
    jest.useFakeTimers()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterAll(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    store.set(downloadItemStatesAtom, new Map())
    mockInstallManagedResource.mockReset()
    mockInstallManagedResource.mockResolvedValue(undefined)
    mockCaptureError.mockClear()
    mockWarn.mockClear()
    mockCompleteDownloadPlan.mockReset()
    mockCompleteDownloadPlan.mockImplementation(items => items)
  })

  it('does not report again the dependent of a failed download', async () => {
    const bible = createItem('bible:BHG')
    store.set(
      downloadItemStatesAtom,
      new Map([[bible.id, createState(bible, 'failed', 'RESOURCE_OFFLINE (Connection reset)')]])
    )

    downloadManager.enqueue([createItem('bible-interlinear:BHG:fr', bible.id)])
    await flushQueue()

    expect(statusOf('bible-interlinear:BHG:fr')).toMatchObject({
      status: 'failed',
      error: 'RESOURCE_OFFLINE (Connection reset)',
    })
    expect(mockCaptureError).not.toHaveBeenCalled()
    expect(mockWarn).toHaveBeenCalledWith(
      'download',
      'queue.dependency_failed',
      expect.objectContaining({ dependencyStatus: 'failed' })
    )
  })

  it('cancels the dependent of a cancelled download', async () => {
    const bible = createItem('bible:BHG')
    store.set(downloadItemStatesAtom, new Map([[bible.id, createState(bible, 'cancelled')]]))

    downloadManager.enqueue([createItem('bible-interlinear:BHG:fr', bible.id)])
    await flushQueue()

    expect(statusOf('bible-interlinear:BHG:fr')?.status).toBe('cancelled')
    expect(mockInstallManagedResource).not.toHaveBeenCalled()
  })

  it('retries the failed dependency with its dependent', async () => {
    const bible = createItem('bible:BHG')
    const sidecar = createItem('bible-interlinear:BHG:fr', bible.id)
    store.set(
      downloadItemStatesAtom,
      new Map([
        [bible.id, createState(bible, 'failed', 'RESOURCE_OFFLINE')],
        [sidecar.id, createState(sidecar, 'failed', 'RESOURCE_OFFLINE')],
      ])
    )

    downloadManager.retry(sidecar.id)
    await flushQueue()

    expect(
      mockInstallManagedResource.mock.calls.map(([item]) => (item as DownloadItem).id)
    ).toEqual([bible.id, sidecar.id])
    expect(statusOf(sidecar.id)?.status).toBe('completed')
  })

  it('does not download again when the disk is full', async () => {
    mockInstallManagedResource.mockRejectedValue(
      Object.assign(new Error('RESOURCE_STORAGE_FULL (write failed: ENOSPC)'), {
        code: 'RESOURCE_STORAGE_FULL',
      })
    )

    downloadManager.enqueue([createItem('bible:LSG')])
    await flushQueue()

    expect(mockInstallManagedResource).toHaveBeenCalledTimes(1)
    expect(statusOf('bible:LSG')?.status).toBe('failed')
    expect(mockCaptureError).toHaveBeenCalledWith(
      'download',
      'resource.install_failed',
      expect.anything(),
      expect.objectContaining({ resourceId: 'bible:LSG' })
    )
  })

  it('retries a refused Strong index with the Bible it needs', async () => {
    const bible = createItem('bible:LSG')
    const index = {
      ...createItem('bible-strong:LSG'),
      type: 'bible-strong-sidecar',
    } as DownloadItem
    mockCompleteDownloadPlan.mockImplementation(items =>
      (items as DownloadItem[]).some(item => item.id === index.id)
        ? [bible, { ...index, dependsOnId: bible.id }]
        : items
    )
    store.set(
      downloadItemStatesAtom,
      new Map([
        [index.id, createState(index, 'failed', 'STRONG_BIBLE_BASE_REVISION_INCOMPATIBLE:LSG')],
      ])
    )

    downloadManager.retry(index.id)
    await flushQueue()

    expect(
      mockInstallManagedResource.mock.calls.map(([item]) => (item as DownloadItem).id)
    ).toEqual([bible.id, index.id])
    expect(statusOf(index.id)?.status).toBe('completed')
  })

  it('reports a refused combination once, with its revisions, without retrying it', async () => {
    mockInstallManagedResource.mockRejectedValue(
      Object.assign(new Error('STRONG_BIBLE_BASE_REVISION_INCOMPATIBLE:LSG'), {
        diagnostic: { installedTextRevision: 'unknown', indexTextRevision: 'lsg-2026-10' },
      })
    )

    downloadManager.enqueue([createItem('bible-strong:LSG')])
    await flushQueue()

    expect(mockInstallManagedResource).toHaveBeenCalledTimes(1)
    expect(mockCaptureError).toHaveBeenCalledWith(
      'download',
      'resource.install_failed',
      expect.anything(),
      expect.objectContaining({
        installedTextRevision: 'unknown',
        indexTextRevision: 'lsg-2026-10',
      })
    )
  })
})
