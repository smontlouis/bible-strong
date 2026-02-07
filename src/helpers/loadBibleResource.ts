import * as FileSystem from 'expo-file-system/legacy'

/**
 * Maps Strong's interlinear versions to their base Bible version,
 * since LSGS/KJVS share Bible data files with LSG/KJV.
 */
export function getBaseVersion(versionId: string): string {
  if (versionId === 'LSGS') return 'LSG'
  if (versionId === 'KJVS') return 'KJV'
  return versionId
}

export interface BibleResourceLoaderConfig<T> {
  versionSupported: (versionId: string) => boolean
  getFilePath: (versionId: string) => string
}

export interface BibleResourceLoader<T> {
  load: (versionId: string) => Promise<T | null>
  clearCache: (versionId?: string) => void
}

export function createBibleResourceLoader<T>(
  config: BibleResourceLoaderConfig<T>
): BibleResourceLoader<T> {
  const cache: Record<string, T> = {}

  async function load(versionId: string): Promise<T | null> {
    const baseVersion = getBaseVersion(versionId)
    if (!config.versionSupported(baseVersion)) return null
    if (cache[baseVersion]) return cache[baseVersion]

    const path = config.getFilePath(baseVersion)
    const info = await FileSystem.getInfoAsync(path)
    if (!info.exists) return null

    const data = await FileSystem.readAsStringAsync(info.uri)
    cache[baseVersion] = JSON.parse(data)
    return cache[baseVersion]
  }

  function clearCache(versionId?: string): void {
    if (versionId) {
      delete cache[versionId]
    } else {
      for (const key of Object.keys(cache)) {
        delete cache[key]
      }
    }
  }

  return { load, clearCache }
}
