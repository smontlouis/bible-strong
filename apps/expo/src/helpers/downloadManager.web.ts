import type { DownloadItem } from '~state/downloadQueue'

class WebDownloadManager {
  enqueue(_items: DownloadItem[]): void {}
  cancel(_itemId: string): void {}
  cancelAll(): void {}
  retry(_itemId: string): void {}
  retryAllFailed(): void {}
  clearCompleted(): void {}
  async restore(): Promise<void> {}
}

export const downloadManager = new WebDownloadManager()
