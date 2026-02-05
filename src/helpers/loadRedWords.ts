import * as FileSystem from 'expo-file-system/legacy'
import { requireRedWordsPath, versionHasRedWords } from './redWords'

type RedWordsRange = { start: number; end: number }
type RedWordsData = Record<string, RedWordsRange[]>

const redWordsMemoize: Record<string, RedWordsData> = {}

export async function loadRedWords(versionId: string): Promise<RedWordsData | null> {
  if (!versionHasRedWords(versionId)) return null
  // LSGS/KJVS share Bible data with LSG/KJV - map to the base version
  const baseVersion = versionId === 'LSGS' ? 'LSG' : versionId === 'KJVS' ? 'KJV' : versionId
  if (redWordsMemoize[baseVersion]) return redWordsMemoize[baseVersion]
  const path = requireRedWordsPath(baseVersion)
  const info = await FileSystem.getInfoAsync(path)
  if (!info.exists) return null
  const data = await FileSystem.readAsStringAsync(info.uri)
  redWordsMemoize[baseVersion] = JSON.parse(data)
  return redWordsMemoize[baseVersion]
}

export function clearRedWordsCache(versionId?: string) {
  if (versionId) {
    delete redWordsMemoize[versionId]
  } else {
    Object.keys(redWordsMemoize).forEach(k => delete redWordsMemoize[k])
  }
}
