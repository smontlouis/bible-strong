import * as FileSystem from 'expo-file-system/legacy'

import { publicationFromArtifactResponse, type ResourcePublication } from './resourcePublication'
import { getResourceDownloadHeaders } from './resourceAppCheck'

type DownloadResourceArtifactOptions = {
  url: string
  archiveSha256: string
  destinationPath: string
  downloadOptions?: FileSystem.DownloadOptions
  onDownloadProgress?: FileSystem.DownloadProgressCallback
  onResumable?: (resumable: FileSystem.DownloadResumable | null) => void
  isCancelled?: () => boolean
  timeoutMs?: number
}

export interface DownloadResourceArtifactResult {
  result: FileSystem.FileSystemDownloadResult
  sourceUrl: string
  publication: ResourcePublication
}

export const downloadResourceArtifact = async ({
  url,
  archiveSha256,
  destinationPath,
  downloadOptions,
  onDownloadProgress,
  onResumable,
  isCancelled,
  timeoutMs = 5 * 60 * 1000,
}: DownloadResourceArtifactOptions): Promise<DownloadResourceArtifactResult> => {
  let resumable: FileSystem.DownloadResumable | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  const download = async () => {
    const appCheckHeaders = await getResourceDownloadHeaders(url)
    resumable = FileSystem.createDownloadResumable(
      url,
      destinationPath,
      {
        ...downloadOptions,
        headers: { ...downloadOptions?.headers, ...appCheckHeaders },
      },
      onDownloadProgress
    )

    onResumable?.(resumable)
    const result = await resumable.downloadAsync()
    if (!result) throw new Error('RESOURCE_DOWNLOAD_RESULT_MISSING')
    if (isCancelled?.()) throw new Error('CANCELLED')
    return {
      result,
      sourceUrl: url,
      publication: publicationFromArtifactResponse(
        {
          get: name => result.headers[name] ?? result.headers[name.toLowerCase()] ?? null,
        },
        archiveSha256
      ),
    }
  }
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      resumable?.cancelAsync().catch(() => undefined)
      reject(new Error('RESOURCE_DOWNLOAD_TIMEOUT'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([download(), deadline])
  } finally {
    if (timeout) clearTimeout(timeout)
    onResumable?.(null)
  }
}
