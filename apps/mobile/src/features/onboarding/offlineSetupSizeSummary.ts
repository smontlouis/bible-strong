import type { DownloadItem } from '~helpers/offlineCopy'
import {
  getOfflineResourceSizeEntry,
  type OfflineResourceSizeManifest,
} from '~helpers/offlineResourceSizeManifest'

export type OfflineSetupSizeSummary = {
  downloadBytes: number
  installedBytes: number
}

export const getOfflineSetupSizeSummary = (
  items: readonly DownloadItem[],
  manifest: OfflineResourceSizeManifest
): OfflineSetupSizeSummary => {
  const uniqueItems = new Map(items.map(item => [item.id, item]))

  return Array.from(uniqueItems.values()).reduce<OfflineSetupSizeSummary>(
    (summary, item) => {
      const size = getOfflineResourceSizeEntry(item.id, item.estimatedSize, manifest)
      return {
        downloadBytes: summary.downloadBytes + size.downloadBytes,
        installedBytes: summary.installedBytes + size.installedBytes,
      }
    },
    { downloadBytes: 0, installedBytes: 0 }
  )
}
