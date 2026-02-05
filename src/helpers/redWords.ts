import * as FileSystem from 'expo-file-system/legacy'

import { cdnUrl } from '~helpers/firebase'
import { versions } from '~helpers/bibleVersions'

export const requireRedWordsPath = (versionId: string) =>
  `${FileSystem.documentDirectory}red-words-${versionId}.json`

export const getRedWordsUrl = (versionId: string) =>
  cdnUrl(`bibles/red-words-${versionId.toLowerCase()}.json`)

export const versionHasRedWords = (versionId: string): boolean =>
  !!(versions as Record<string, { hasRedWords?: boolean }>)[versionId]?.hasRedWords

export const hasRedWordsFile = async (versionId: string): Promise<boolean> => {
  const path = requireRedWordsPath(versionId)
  const info = await FileSystem.getInfoAsync(path)
  return info.exists
}

export const downloadRedWordsFile = async (versionId: string): Promise<boolean> => {
  try {
    const url = getRedWordsUrl(versionId)
    const path = requireRedWordsPath(versionId)
    console.log(`[RedWords] Downloading ${url} to ${path}`)
    await FileSystem.downloadAsync(url, path)
    console.log(`[RedWords] Downloaded ${versionId}`)
    return true
  } catch (e) {
    console.log(`[RedWords] Failed to download ${versionId}:`, e)
    return false
  }
}

export const deleteRedWordsFile = async (versionId: string): Promise<void> => {
  try {
    const path = requireRedWordsPath(versionId)
    const info = await FileSystem.getInfoAsync(path)
    if (info.exists) {
      await FileSystem.deleteAsync(info.uri)
      console.log(`[RedWords] Deleted ${versionId}`)
    }
  } catch (e) {
    console.log(`[RedWords] Failed to delete ${versionId}:`, e)
  }
}
