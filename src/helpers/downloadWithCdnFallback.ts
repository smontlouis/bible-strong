import * as FileSystem from 'expo-file-system/legacy'

import { getCdnFallbackUrl } from './firebase'
import {
  assertResourceChecksum,
  publicationFromHeaders,
  type ResourcePublication,
} from './resourcePublication'

type DownloadWithCdnFallbackOptions = {
  url: string
  destinationPath: string
  downloadOptions?: FileSystem.DownloadOptions
  onDownloadProgress?: FileSystem.DownloadProgressCallback
  onResumable?: (resumable: FileSystem.DownloadResumable | null) => void
  isCancelled?: () => boolean
  logTag: string
}

export interface DownloadWithCdnFallbackResult {
  result: FileSystem.FileSystemDownloadResult
  sourceUrl: string
  publication: ResourcePublication
}

export const downloadWithCdnFallback = async ({
  url,
  destinationPath,
  downloadOptions,
  onDownloadProgress,
  onResumable,
  isCancelled,
  logTag,
}: DownloadWithCdnFallbackOptions): Promise<DownloadWithCdnFallbackResult> => {
  const fallbackUrl = getCdnFallbackUrl(url)
  const urls = fallbackUrl && fallbackUrl !== url ? [url, fallbackUrl] : [url]
  let lastError: unknown

  for (const downloadUrl of urls) {
    const resumable = FileSystem.createDownloadResumable(
      downloadUrl,
      destinationPath,
      { ...downloadOptions, md5: true },
      onDownloadProgress
    )

    onResumable?.(resumable)

    try {
      const result = await resumable.downloadAsync()
      if (!result) throw new Error('RESOURCE_DOWNLOAD_RESULT_MISSING')
      onResumable?.(null)
      const publication = publicationFromHeaders({
        get: name => result.headers[name] ?? result.headers[name.toLowerCase()] ?? null,
      })
      assertResourceChecksum(publication, result.md5)
      return {
        result,
        sourceUrl: downloadUrl,
        publication,
      }
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
