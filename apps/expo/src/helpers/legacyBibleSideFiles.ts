import { clearPericopeCache } from './loadPericope'
import { clearRedWordsCache } from './loadRedWords'
import { deletePericopeFile, requirePericopePath } from './pericopes'
import { deleteRedWordsFile, requireRedWordsPath } from './redWords'

export const clearLegacyBibleSideFileCaches = (versionId: string): void => {
  clearPericopeCache(versionId)
  clearRedWordsCache(versionId)
}

/**
 * Deletes the legacy pericope and red-word side files of a Bible, with their publication
 * records, except the paths an archive has just installed.
 */
export const removeLegacyBibleSideFiles = async (
  versionId: string,
  keptPaths: readonly string[] = []
): Promise<void> => {
  const kept = new Set(keptPaths)
  await Promise.all([
    kept.has(requirePericopePath(versionId)) ? undefined : deletePericopeFile(versionId),
    kept.has(requireRedWordsPath(versionId)) ? undefined : deleteRedWordsFile(versionId),
  ])
  clearLegacyBibleSideFileCaches(versionId)
}
