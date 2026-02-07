import * as FileSystem from 'expo-file-system/legacy'

import { insertBibleVersion, openBiblesDb } from '~helpers/biblesDb'
import type { InsertBibleOptions } from '~helpers/biblesDb'

export interface DownloadAndInsertOptions extends InsertBibleOptions {
  onDownloadProgress?: FileSystem.DownloadProgressCallback
  /** Return the DownloadResumable so the caller can pause/cancel it */
  onResumable?: (resumable: FileSystem.DownloadResumable) => void
}

/**
 * Downloads a Bible JSON from a remote URL and inserts it into bibles.sqlite.
 *
 * Flow:
 * 1. Download JSON to cacheDirectory (temp file)
 * 2. Parse JSON
 * 3. insertBibleVersion() into SQLite
 * 4. Delete temp file
 */
export async function downloadAndInsertBible(
  versionId: string,
  downloadUrl: string,
  onProgressOrOptions?: FileSystem.DownloadProgressCallback | DownloadAndInsertOptions
): Promise<void> {
  // Normalize arguments: support both legacy callback and new options object
  const opts: DownloadAndInsertOptions =
    typeof onProgressOrOptions === 'function'
      ? { onDownloadProgress: onProgressOrOptions }
      : (onProgressOrOptions ?? {})

  // Ensure DB is open
  await openBiblesDb()

  const tempPath = `${FileSystem.cacheDirectory}bible-${versionId}-temp.json`

  try {
    // 1. Download to temp file
    console.log(`[DownloadBible] Downloading ${versionId} from ${downloadUrl}`)
    const resumable = FileSystem.createDownloadResumable(
      downloadUrl,
      tempPath,
      undefined,
      opts.onDownloadProgress
    )

    opts.onResumable?.(resumable)

    await resumable.downloadAsync()

    // Check cancellation after download
    if (opts.isCancelled?.()) {
      throw new Error('CANCELLED')
    }

    // 2. Parse JSON
    const data = await FileSystem.readAsStringAsync(tempPath)
    const jsonData = JSON.parse(data)

    // 3. Insert into SQLite
    console.log(`[DownloadBible] Inserting ${versionId} into bibles.sqlite`)
    await insertBibleVersion(versionId, jsonData, {
      onInsertProgress: opts.onInsertProgress,
      isCancelled: opts.isCancelled,
    })

    console.log(`[DownloadBible] ${versionId} ready`)
  } finally {
    // 4. Clean up temp file
    const tempInfo = await FileSystem.getInfoAsync(tempPath)
    if (tempInfo.exists) {
      await FileSystem.deleteAsync(tempPath, { idempotent: true })
    }
  }
}
