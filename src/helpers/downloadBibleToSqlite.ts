import * as FileSystem from 'expo-file-system/legacy'

import { insertBibleVersion, openBiblesDb } from '~helpers/biblesDb'

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
  onProgress?: FileSystem.DownloadProgressCallback
): Promise<void> {
  // Ensure DB is open
  await openBiblesDb()

  const tempPath = `${FileSystem.cacheDirectory}bible-${versionId}-temp.json`

  try {
    // 1. Download to temp file
    console.log(`[DownloadBible] Downloading ${versionId} from ${downloadUrl}`)
    await FileSystem.createDownloadResumable(
      downloadUrl,
      tempPath,
      undefined,
      onProgress
    ).downloadAsync()

    // 2. Parse JSON
    const data = await FileSystem.readAsStringAsync(tempPath)
    const jsonData = JSON.parse(data)

    // 3. Insert into SQLite
    console.log(`[DownloadBible] Inserting ${versionId} into bibles.sqlite`)
    await insertBibleVersion(versionId, jsonData)

    console.log(`[DownloadBible] ${versionId} ready`)
  } finally {
    // 4. Clean up temp file
    const tempInfo = await FileSystem.getInfoAsync(tempPath)
    if (tempInfo.exists) {
      await FileSystem.deleteAsync(tempPath, { idempotent: true })
    }
  }
}
