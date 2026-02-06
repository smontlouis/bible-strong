import * as FileSystem from 'expo-file-system/legacy'

import { Pericope } from '~common/types'
import { requirePericopePath, versionHasPericope } from './pericopes'

const pericopeMemoize: Record<string, Pericope> = {}

export async function loadPericope(versionId: string): Promise<Pericope | null> {
  // LSGS/KJVS share Bible data with LSG/KJV - map to the base version
  const baseVersion = versionId === 'LSGS' ? 'LSG' : versionId === 'KJVS' ? 'KJV' : versionId
  if (!versionHasPericope(baseVersion)) return null
  if (pericopeMemoize[baseVersion]) return pericopeMemoize[baseVersion]
  const path = requirePericopePath(baseVersion)
  const info = await FileSystem.getInfoAsync(path)
  if (!info.exists) return null
  const data = await FileSystem.readAsStringAsync(info.uri)
  pericopeMemoize[baseVersion] = JSON.parse(data)
  return pericopeMemoize[baseVersion]
}

export function clearPericopeCache(versionId?: string) {
  if (versionId) {
    delete pericopeMemoize[versionId]
  } else {
    Object.keys(pericopeMemoize).forEach(k => delete pericopeMemoize[k])
  }
}
