import * as FileSystem from 'expo-file-system/legacy'

import { resolveOfflineArchiveSource, type OfflineArchiveSource } from './offlineArchiveSource'
import { publicationFromArtifactResponse, type ResourcePublication } from './resourcePublication'
import { getResourceDownloadAppCheckToken } from './resourceAppCheck'
import { FIREBASE_APP_CHECK_HEADER } from './resourceAppCheckRequest'
import { appLogger } from './agentObservability'

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
  /** How to verify and extract the downloaded file: plain or encrypted (ADR-0065). */
  archive: OfflineArchiveSource
}

export class ResourceDownloadHttpError extends Error {
  readonly code: string

  constructor(
    readonly status: number,
    readonly requestId?: string
  ) {
    const code = `RESOURCE_DOWNLOAD_HTTP_${status}`
    super(code)
    this.name = 'ResourceDownloadHttpError'
    this.code = code
  }
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
  const downloadAttempt = async (
    source: OfflineArchiveSource,
    forceAppCheckRefresh: boolean
  ): Promise<DownloadResourceArtifactResult> => {
    // Encrypted copies are public; only plain archives still need an attestation.
    const appCheckToken =
      source.kind === 'plain'
        ? await getResourceDownloadAppCheckToken(source.url, forceAppCheckRefresh)
        : undefined
    const appCheckHeaders: Record<string, string> = appCheckToken
      ? { [FIREBASE_APP_CHECK_HEADER]: appCheckToken }
      : {}
    const appCheckDiagnostics = {
      appCheckHeaderPresent: Boolean(appCheckToken),
      appCheckProofFormat: appCheckToken
        ? appCheckToken.split('.').length === 3
          ? 'jwt'
          : 'opaque'
        : 'missing',
      appCheckProofLength: appCheckToken?.length,
    }
    resumable = FileSystem.createDownloadResumable(
      source.url,
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
    if (result.status < 200 || result.status >= 300) {
      const getHeader = (name: string) =>
        result.headers[name] ?? result.headers[name.toLowerCase()] ?? undefined
      const requestId = getHeader('x-request-id')
      const error = new ResourceDownloadHttpError(result.status, requestId)
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(cleanupError => {
        appLogger.warn('download', 'resource_artifact.http_body_cleanup_failed', {
          error: cleanupError,
          httpStatus: result.status,
        })
      })
      if (source.kind === 'encrypted' && result.status === 404) {
        // A catalog ahead of the Worker must not block installation: keep the plain archive.
        appLogger.warn('download', 'resource_artifact.encrypted_fallback', {
          httpStatus: result.status,
          requestId,
          artifactUrl: source.url,
        })
        if (isCancelled?.()) throw new Error('CANCELLED')
        return downloadAttempt({ kind: 'plain', url, archiveSha256 }, false)
      }
      if (source.kind === 'plain' && result.status === 401 && !forceAppCheckRefresh) {
        appLogger.warn('download', 'resource_artifact.auth_retry', {
          httpStatus: result.status,
          requestId,
          artifactUrl: source.url,
          ...appCheckDiagnostics,
        })
        if (isCancelled?.()) throw new Error('CANCELLED')
        return downloadAttempt(source, true)
      }
      appLogger.captureError('download', 'resource_artifact.http_failed', error, {
        errorCode: error.code,
        httpStatus: result.status,
        requestId,
        contentType: getHeader('content-type') ?? result.mimeType ?? undefined,
        contentLength: getHeader('content-length'),
        artifactUrl: source.url,
        archiveKind: source.kind,
        appCheckRefreshAttempted: forceAppCheckRefresh,
        ...appCheckDiagnostics,
      })
      throw error
    }
    if (isCancelled?.()) throw new Error('CANCELLED')
    return {
      result,
      sourceUrl: source.url,
      archive: source,
      publication: publicationFromArtifactResponse(
        {
          get: name => result.headers[name] ?? result.headers[name.toLowerCase()] ?? null,
        },
        archiveSha256
      ),
    }
  }
  const download = () => downloadAttempt(resolveOfflineArchiveSource(url, archiveSha256), false)
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
