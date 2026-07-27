import * as FileSystem from 'expo-file-system/legacy'

import { isVersionInstalled, removeBibleVersion } from './biblesDb'
import { isStrongVersion, versions } from './bibleVersions'
import {
  LANGUAGE_SPECIFIC_DBS,
  SHARED_DBS,
  type DatabaseId,
  type ResourceLanguage,
} from './databaseTypes'
import { deletePericopeFile } from './pericopes'
import { deleteRedWordsFile } from './redWords'
import { requireBiblePath } from './requireBiblePath'
import { dbManager } from './sqlite'
import { isStrongCapableBibleVersion, type StrongBibleVersionId } from './strongBiblePublications'
import { removeStrongBibleSidecar } from './strongBibleSidecar'
import { removeInterlinearSidecar } from './interlinearBibleSidecar'
import { resourcePublicationStore } from './resourcePublication'

interface DeleteDownloadedItemOptions {
  bibleMode?: 'remove' | 'replace'
}

const DATABASE_IDS = new Set<DatabaseId>([...LANGUAGE_SPECIFIC_DBS, ...SHARED_DBS])

export type DownloadedItemDeletionPlan =
  | {
      kind: 'bible'
      versionId: string
      bibleMode: 'remove' | 'replace'
      strongSidecar?: {
        itemId: string
        versionId: StrongBibleVersionId
      }
      interlinearSidecars?: {
        itemId: string
        language: ResourceLanguage
      }[]
    }
  | { kind: 'strong-sidecar'; versionId: StrongBibleVersionId }
  | { kind: 'interlinear-sidecar'; language: ResourceLanguage }
  | { kind: 'database'; databaseId: DatabaseId; language: ResourceLanguage }
  | { kind: 'unknown'; itemId: string }

export const createDownloadedItemDeletionPlan = (
  itemId: string,
  { bibleMode = 'remove' }: DeleteDownloadedItemOptions = {}
): DownloadedItemDeletionPlan => {
  if (itemId.startsWith('bible-strong:')) {
    const versionId = itemId.replace('bible-strong:', '')
    if (!isStrongCapableBibleVersion(versionId)) {
      return { kind: 'unknown', itemId }
    }
    return {
      kind: 'strong-sidecar',
      versionId,
    }
  }

  if (itemId.startsWith('bible-interlinear:')) {
    const [, versionId, language] = itemId.split(':')
    if (versionId !== 'BHG' || (language !== 'fr' && language !== 'en')) {
      return { kind: 'unknown', itemId }
    }
    return { kind: 'interlinear-sidecar', language }
  }

  if (itemId.startsWith('bible:')) {
    const versionId = itemId.replace('bible:', '')
    if (!Object.prototype.hasOwnProperty.call(versions, versionId)) {
      return { kind: 'unknown', itemId }
    }
    return {
      kind: 'bible',
      versionId,
      bibleMode,
      strongSidecar:
        bibleMode === 'remove' && isStrongCapableBibleVersion(versionId)
          ? { itemId: `bible-strong:${versionId}`, versionId }
          : undefined,
      interlinearSidecars:
        bibleMode === 'remove' && versionId === 'BHG'
          ? (['fr', 'en'] as ResourceLanguage[]).map(language => ({
              itemId: `bible-interlinear:BHG:${language}`,
              language,
            }))
          : undefined,
    }
  }

  if (itemId.startsWith('database:')) {
    const parts = itemId.split(':')
    const databaseId = parts[1] as DatabaseId
    const language = parts[2] || 'fr'
    if (!DATABASE_IDS.has(databaseId) || (language !== 'fr' && language !== 'en')) {
      return { kind: 'unknown', itemId }
    }
    return {
      kind: 'database',
      databaseId,
      language,
    }
  }

  return { kind: 'unknown', itemId }
}

export const deleteDownloadedItem = async (plan: DownloadedItemDeletionPlan): Promise<void> => {
  if (plan.kind === 'strong-sidecar') {
    await removeStrongBibleSidecar(plan.versionId)
    resourcePublicationStore.remove(`bible-strong:${plan.versionId}`)
    return
  }

  if (plan.kind === 'interlinear-sidecar') {
    await removeInterlinearSidecar(plan.language)
    resourcePublicationStore.remove(`bible-interlinear:BHG:${plan.language}`)
    return
  }

  if (plan.kind === 'bible') {
    if (plan.strongSidecar) {
      await removeStrongBibleSidecar(plan.strongSidecar.versionId)
      resourcePublicationStore.remove(plan.strongSidecar.itemId)
    }
    if (plan.interlinearSidecars) {
      await Promise.all(
        plan.interlinearSidecars.map(sidecar => removeInterlinearSidecar(sidecar.language))
      )
      plan.interlinearSidecars.forEach(sidecar => resourcePublicationStore.remove(sidecar.itemId))
    }

    const { versionId } = plan
    if (isStrongVersion(versionId)) {
      const path = requireBiblePath(versionId)
      const file = await FileSystem.getInfoAsync(path)
      if (file.exists) {
        await FileSystem.deleteAsync(file.uri)
      }
      if (versionId === 'INT' || versionId === 'INT_EN') {
        const lang = versionId === 'INT' ? 'fr' : 'en'
        await dbManager.getDB('INTERLINEAIRE', lang).delete()
      }
    } else {
      const installed = await isVersionInstalled(versionId)
      if (installed) {
        await removeBibleVersion(versionId)
      }

      const legacyPath = `${FileSystem.documentDirectory}bible-${versionId}.json`
      const legacyFile = await FileSystem.getInfoAsync(legacyPath)
      if (legacyFile.exists) {
        await FileSystem.deleteAsync(legacyFile.uri)
      }
    }

    await Promise.all([deleteRedWordsFile(versionId), deletePericopeFile(versionId)])
    resourcePublicationStore.remove(`bible:${versionId}`)
    return
  }

  if (plan.kind === 'database') {
    await dbManager.getDB(plan.databaseId, plan.language).delete()
    resourcePublicationStore.remove(`database:${plan.databaseId}:${plan.language}`)
    return
  }

  throw new Error(`UNKNOWN_DOWNLOADED_ITEM:${plan.itemId}`)
}
