import * as FileSystem from 'expo-file-system/legacy'

import { getCdnFallbackUrl } from './firebase'

type DownloadWithCdnFallbackOptions = {
  url: string
  destinationPath: string
  downloadOptions?: FileSystem.DownloadOptions
  onDownloadProgress?: FileSystem.DownloadProgressCallback
  onResumable?: (resumable: FileSystem.DownloadResumable | null) => void
  isCancelled?: () => boolean
  logTag: string
}

export const downloadWithCdnFallback = async ({
  url,
  destinationPath,
  downloadOptions,
  onDownloadProgress,
  onResumable,
  isCancelled,
  logTag,
}: DownloadWithCdnFallbackOptions) => {
  const fallbackUrl = getCdnFallbackUrl(url)
  const urls = fallbackUrl && fallbackUrl !== url ? [url, fallbackUrl] : [url]
  let lastError: unknown

  for (const downloadUrl of urls) {
    const resumable = FileSystem.createDownloadResumable(
      downloadUrl,
      destinationPath,
      downloadOptions,
      onDownloadProgress
    )

    onResumable?.(resumable)

    try {
      await resumable.downloadAsync()
      onResumable?.(null)
      return
    } catch (error) {
      onResumable?.(null)
      lastError = error

      if (isCancelled?.() || downloadUrl === urls[urls.length - 1]) {
        throw error
      }

      console.warn(`[${logTag}] Primary CDN download failed, retrying fallback URL`, error)
    }
  }

  throw lastError
}
