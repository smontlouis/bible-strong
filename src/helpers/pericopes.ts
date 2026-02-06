import * as FileSystem from 'expo-file-system/legacy'

import { cdnUrl } from '~helpers/firebase'
import { versions } from '~helpers/bibleVersions'

export const requirePericopePath = (versionId: string) =>
  `${FileSystem.documentDirectory}bible-${versionId.toLowerCase()}-pericope.json`

export const getPericopeUrl = (versionId: string) =>
  cdnUrl(`bibles/bible-${versionId.toLowerCase()}-pericope.json`)

export const versionHasPericope = (versionId: string): boolean =>
  !!(versions as Record<string, { hasPericope?: boolean }>)[versionId]?.hasPericope

export const hasPericopeFile = async (versionId: string): Promise<boolean> => {
  const path = requirePericopePath(versionId)
  const info = await FileSystem.getInfoAsync(path)
  return info.exists
}

export const downloadPericopeFile = async (versionId: string): Promise<boolean> => {
  try {
    const url = getPericopeUrl(versionId)
    const path = requirePericopePath(versionId)
    console.log(`[Pericope] Downloading ${url} to ${path}`)
    await FileSystem.downloadAsync(url, path)
    console.log(`[Pericope] Downloaded ${versionId}`)
    return true
  } catch (e) {
    console.log(`[Pericope] Failed to download ${versionId}:`, e)
    return false
  }
}

export const deletePericopeFile = async (versionId: string): Promise<void> => {
  try {
    const path = requirePericopePath(versionId)
    const info = await FileSystem.getInfoAsync(path)
    if (info.exists) {
      await FileSystem.deleteAsync(info.uri)
      console.log(`[Pericope] Deleted ${versionId}`)
    }
  } catch (e) {
    console.log(`[Pericope] Failed to delete ${versionId}:`, e)
  }
}
