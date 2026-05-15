import * as FileSystem from 'expo-file-system/legacy'
import { AppState, AppStateStatus } from 'react-native'
import { getDefaultStore } from 'jotai/vanilla'

import {
  downloadItemStatesAtom,
  downloadCompletionSignalAtom,
  isQueueProcessingAtom,
  type DownloadItem,
  type DownloadItemState,
  type DownloadStatus,
} from '~state/downloadQueue'
import { installedVersionsSignalAtom, bibleDataRefreshSignalAtom } from '~state/app'
import { storage } from '~helpers/storage'
import { installResourceDatabaseItem } from '~helpers/resourceDatabaseInstallation'

const PERSIST_KEY = 'downloadQueue'
const MAX_RETRIES = 2
const PERSIST_DEBOUNCE_MS = 2000

// ---------------------------------------------------------------------------
// DownloadManager — singleton
// ---------------------------------------------------------------------------

class DownloadManager {
  private jotaiStore = getDefaultStore()
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private currentResumable: FileSystem.DownloadResumable | null = null
  private cancelledIds = new Set<string>()
  private isProcessing = false

  constructor() {
    // Persist immediately when app goes to background
    AppState.addEventListener('change', this.handleAppStateChange)
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Add items to the queue. Deduplicates by id. Starts processing. */
  enqueue(items: DownloadItem[]): void {
    const states = new Map(this.jotaiStore.get(downloadItemStatesAtom))

    for (const item of items) {
      // Skip if already queued/downloading/inserting
      const existing = states.get(item.id)
      if (
        existing &&
        (existing.status === 'queued' ||
          existing.status === 'downloading' ||
          existing.status === 'inserting')
      ) {
        continue
      }

      states.set(item.id, {
        item,
        status: 'queued',
        downloadProgress: 0,
        insertProgress: 0,
      })
    }

    this.jotaiStore.set(downloadItemStatesAtom, states)
    this.schedulePersist()
    this.processQueue()
  }

  /** Cancel a specific download. */
  cancel(itemId: string): void {
    this.cancelledIds.add(itemId)

    // If this is the currently downloading item, pause the resumable
    const states = this.jotaiStore.get(downloadItemStatesAtom)
    const state = states.get(itemId)
    if (state && (state.status === 'downloading' || state.status === 'inserting')) {
      this.currentResumable?.pauseAsync().catch(() => {})
    }

    this.updateItemStatus(itemId, 'cancelled')
    this.schedulePersist()
  }

  /** Cancel all active downloads. */
  cancelAll(): void {
    const states = this.jotaiStore.get(downloadItemStatesAtom)
    for (const [id, state] of states) {
      if (
        state.status === 'queued' ||
        state.status === 'downloading' ||
        state.status === 'inserting'
      ) {
        this.cancelledIds.add(id)
        this.updateItemStatus(id, 'cancelled')
      }
    }
    this.currentResumable?.pauseAsync().catch(() => {})
    this.schedulePersist()
  }

  /** Retry a failed item. */
  retry(itemId: string): void {
    const states = new Map(this.jotaiStore.get(downloadItemStatesAtom))
    const state = states.get(itemId)
    if (!state || state.status !== 'failed') return

    this.cancelledIds.delete(itemId)
    states.set(itemId, {
      ...state,
      status: 'queued',
      downloadProgress: 0,
      insertProgress: 0,
      error: undefined,
    })
    this.jotaiStore.set(downloadItemStatesAtom, states)
    this.schedulePersist()
    this.processQueue()
  }

  /** Retry all failed items. */
  retryAllFailed(): void {
    const states = new Map(this.jotaiStore.get(downloadItemStatesAtom))
    let changed = false

    for (const [id, state] of states) {
      if (state.status === 'failed') {
        this.cancelledIds.delete(id)
        states.set(id, {
          ...state,
          status: 'queued',
          downloadProgress: 0,
          insertProgress: 0,
          error: undefined,
        })
        changed = true
      }
    }

    if (changed) {
      this.jotaiStore.set(downloadItemStatesAtom, states)
      this.schedulePersist()
      this.processQueue()
    }
  }

  /** Restore queue from persisted state (call at app startup). */
  restore(): void {
    try {
      const raw = storage.getString(PERSIST_KEY)
      if (!raw) return

      const persisted: DownloadItemState[] = JSON.parse(raw)
      const states = new Map(this.jotaiStore.get(downloadItemStatesAtom))

      for (const itemState of persisted) {
        // Only restore queued and failed items
        if (itemState.status === 'queued' || itemState.status === 'failed') {
          states.set(itemState.item.id, {
            ...itemState,
            downloadProgress: 0,
            insertProgress: 0,
          })
        }
      }

      if (states.size > 0) {
        this.jotaiStore.set(downloadItemStatesAtom, states)
        this.processQueue()
      }
    } catch (e) {
      console.error('[DownloadManager] Failed to restore queue:', e)
    }
  }

  /** Remove completed and cancelled items from state. */
  clearCompleted(): void {
    const states = new Map(this.jotaiStore.get(downloadItemStatesAtom))

    for (const [id, state] of states) {
      if (state.status === 'completed' || state.status === 'cancelled') {
        states.delete(id)
      }
    }

    this.jotaiStore.set(downloadItemStatesAtom, states)
    this.schedulePersist()
  }

  // -----------------------------------------------------------------------
  // Queue processor — sequential (MAX_CONCURRENT = 1)
  // -----------------------------------------------------------------------

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true
    this.jotaiStore.set(isQueueProcessingAtom, true)

    try {
      while (true) {
        const states = this.jotaiStore.get(downloadItemStatesAtom)
        const next = Array.from(states.values()).find(s => s.status === 'queued')
        if (!next) break

        await this.processItem(next)
      }
    } finally {
      this.isProcessing = false
      this.jotaiStore.set(isQueueProcessingAtom, false)
    }
  }

  private async processItem(itemState: DownloadItemState): Promise<void> {
    const { item } = itemState

    // Check if cancelled before starting
    if (this.cancelledIds.has(item.id)) {
      this.cancelledIds.delete(item.id)
      return
    }

    try {
      this.updateItemStatus(item.id, 'downloading')

      await installResourceDatabaseItem(item, {
        onDownloadProgress: progress => this.updateItemProgress(item.id, progress, 0),
        onInsertProgress: progress => this.updateItemProgress(item.id, 1, progress),
        onStatusInserting: () => this.updateItemStatus(item.id, 'inserting'),
        onResumable: resumable => {
          this.currentResumable = resumable
        },
        isCancelled: () => this.cancelledIds.has(item.id),
      })

      this.updateItemStatus(item.id, 'completed')

      // Signal to VersionSelectorItem instances
      this.jotaiStore.set(installedVersionsSignalAtom, (c: number) => c + 1)
      this.jotaiStore.set(downloadCompletionSignalAtom, (c: number) => c + 1)

      // Signal to BibleViewer instances to reload verses (a version they
      // were trying to display may now be available).
      if (item.type === 'bible' || item.type === 'bible-strong') {
        this.jotaiStore.set(bibleDataRefreshSignalAtom, (c: number) => c + 1)
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)

      if (errorMessage === 'CANCELLED' || this.cancelledIds.has(item.id)) {
        this.cancelledIds.delete(item.id)
        this.updateItemStatus(item.id, 'cancelled')
        return
      }

      console.error(`[DownloadManager] Failed ${item.id}:`, e)

      // Auto-retry up to MAX_RETRIES
      const states = new Map(this.jotaiStore.get(downloadItemStatesAtom))
      const current = states.get(item.id)
      if (current && current.item.retryCount < MAX_RETRIES) {
        states.set(item.id, {
          ...current,
          item: { ...current.item, retryCount: current.item.retryCount + 1 },
          status: 'queued',
          downloadProgress: 0,
          insertProgress: 0,
          error: undefined,
        })
        this.jotaiStore.set(downloadItemStatesAtom, states)
      } else {
        this.updateItemStatus(item.id, 'failed', errorMessage || 'Unknown error')
      }
    }

    this.schedulePersist()
  }

  // -----------------------------------------------------------------------
  // State helpers
  // -----------------------------------------------------------------------

  private updateItemStatus(itemId: string, status: DownloadStatus, error?: string): void {
    const states = new Map(this.jotaiStore.get(downloadItemStatesAtom))
    const current = states.get(itemId)
    if (!current) return

    states.set(itemId, { ...current, status, error })
    this.jotaiStore.set(downloadItemStatesAtom, states)
  }

  private updateItemProgress(
    itemId: string,
    downloadProgress: number,
    insertProgress: number
  ): void {
    const states = new Map(this.jotaiStore.get(downloadItemStatesAtom))
    const current = states.get(itemId)
    if (!current) return

    states.set(itemId, { ...current, downloadProgress, insertProgress })
    this.jotaiStore.set(downloadItemStatesAtom, states)
  }

  // -----------------------------------------------------------------------
  // Persistence (MMKV) — debounced
  // -----------------------------------------------------------------------

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => this.persistNow(), PERSIST_DEBOUNCE_MS)
  }

  private persistNow(): void {
    try {
      const states = this.jotaiStore.get(downloadItemStatesAtom)
      // Only persist queued and failed items
      const toPersist = Array.from(states.values()).filter(
        s => s.status === 'queued' || s.status === 'failed'
      )
      storage.set(PERSIST_KEY, JSON.stringify(toPersist))
    } catch (e) {
      console.error('[DownloadManager] Persist failed:', e)
    }
  }

  private handleAppStateChange = (state: AppStateStatus): void => {
    if (state === 'background') {
      // Persist immediately on background
      if (this.persistTimer) {
        clearTimeout(this.persistTimer)
        this.persistTimer = null
      }
      this.persistNow()
    }
  }
}

// ---------------------------------------------------------------------------
// Export singleton
// ---------------------------------------------------------------------------

export const downloadManager = new DownloadManager()
