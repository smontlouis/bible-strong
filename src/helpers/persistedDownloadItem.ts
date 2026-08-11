import type { DownloadItem } from '~state/downloadQueue'

import { createOfflineCopyDownloadItem } from './downloadItemFactory'
import { parseOfflineCopyId } from './offlineCopy'

export const refreshPersistedDownloadItem = (item: DownloadItem): DownloadItem => {
  const identity = parseOfflineCopyId(item.id)
  if (!identity) return item
  try {
    const refreshed = createOfflineCopyDownloadItem(identity)
    return {
      ...refreshed,
      addedAt: item.addedAt,
      retryCount: item.retryCount,
      ...('dependsOnId' in item && item.dependsOnId ? { dependsOnId: item.dependsOnId } : {}),
    }
  } catch {
    return item
  }
}
