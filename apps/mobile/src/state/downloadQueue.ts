import { atom } from 'jotai/vanilla'
import type { Atom } from 'jotai/vanilla'
import type { DownloadItem } from '~helpers/offlineCopy'

export type { DownloadItem, DownloadItemType } from '~helpers/offlineCopy'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'inserting'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface DownloadItemState {
  item: DownloadItem
  status: DownloadStatus
  downloadProgress: number // 0..1
  insertProgress: number // 0..1 (bible type only)
  error?: string
}

export const getDownloadItemProgress = (state: DownloadItemState): number => {
  if (state.status === 'completed') return 1
  if (state.status === 'downloading') return state.downloadProgress * 0.8
  if (state.status === 'inserting') return 0.8 + state.insertProgress * 0.2
  return 0
}

// ---------------------------------------------------------------------------
// Atoms — runtime source of truth
// ---------------------------------------------------------------------------

/** Map of itemId -> DownloadItemState. Main source of truth at runtime. */
export const downloadItemStatesAtom = atom<Map<string, DownloadItemState>>(new Map())

/** Whether the queue processor is currently running */
export const isQueueProcessingAtom = atom(false)

// ---------------------------------------------------------------------------
// Derived atoms (read-only)
// ---------------------------------------------------------------------------

/** All items currently in the active queue (queued, downloading, inserting) */
export const activeQueueAtom = atom(get => {
  const states = get(downloadItemStatesAtom)
  return Array.from(states.values()).filter(
    s => s.status === 'queued' || s.status === 'downloading' || s.status === 'inserting'
  )
})

/** Items waiting to be processed */
export const queuedItemsAtom = atom(get => {
  const states = get(downloadItemStatesAtom)
  return Array.from(states.values()).filter(s => s.status === 'queued')
})

/** Items that have failed */
export const failedItemsAtom = atom(get => {
  const states = get(downloadItemStatesAtom)
  return Array.from(states.values()).filter(s => s.status === 'failed')
})

/** Overall progress across all active downloads: { completed, total, progress } */
export const overallProgressAtom = atom(get => {
  const states = get(downloadItemStatesAtom)
  const all = Array.from(states.values())

  const active = all.filter(
    s =>
      s.status === 'queued' ||
      s.status === 'downloading' ||
      s.status === 'inserting' ||
      s.status === 'completed'
  )

  if (active.length === 0) return { completed: 0, total: 0, progress: 0 }

  const completed = active.filter(s => s.status === 'completed').length
  const total = active.length

  // Weight: downloading items contribute their downloadProgress, inserting items add insert progress
  const progressSum = active.reduce((sum, s) => {
    return sum + getDownloadItemProgress(s)
  }, 0)

  return {
    completed,
    total,
    progress: total > 0 ? progressSum / total : 0,
  }
})

const itemStatusCache = new Map<string, Atom<DownloadItemState | undefined>>()
const missingItemStatusAtom = atom<DownloadItemState | undefined>(undefined)

/** O(1) lookup atom for a single item's download status. */
export const downloadStatusForIdAtom = (itemId?: string): Atom<DownloadItemState | undefined> => {
  if (!itemId) return missingItemStatusAtom
  if (!itemStatusCache.has(itemId)) {
    itemStatusCache.set(
      itemId,
      atom(get => {
        const states = get(downloadItemStatesAtom)
        return states.get(itemId)
      })
    )
  }
  return itemStatusCache.get(itemId)!
}
