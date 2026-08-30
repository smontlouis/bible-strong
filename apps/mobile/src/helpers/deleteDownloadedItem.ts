import * as FileSystem from 'expo-file-system/legacy'

import { isVersionInstalled, removeBibleVersion } from './biblesDb'
import { type DatabaseId, type ResourceLanguage } from './databaseTypes'
import { deletePericopeFile } from './pericopes'
import { deleteRedWordsFile } from './redWords'
import { dbManager } from './sqlite'
import { isStrongCapableBibleVersion, type StrongBibleVersionId } from './strongBiblePublications'
import { removeStrongBibleSidecar } from './strongBibleSidecar'
import { removeInterlinearSidecar } from './interlinearBibleSidecar'
import { resourcePublicationStore } from './resourcePublication'
import { removeStrongLexiconModule } from './strongLexiconModules'
import type { StrongLexiconModuleId } from './strongLexiconPublications'
import { invalidateOfflineCopyQueries } from './offlineCopyQueries'
import { createOfflineCopyId, parseOfflineCopyId, type OfflineCopyIdentity } from './offlineCopy'
import { getDictionaryDbPath } from './databases'

interface DeleteDownloadedItemOptions {
  bibleMode?: 'remove' | 'replace'
}

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
  | { kind: 'strong-lexicon-module'; moduleId: StrongLexiconModuleId }
  | {
      kind: 'dictionary'
      work: string
      resourceId: string
      language: ResourceLanguage
    }
  | { kind: 'database'; databaseId: DatabaseId; language: ResourceLanguage }
  | { kind: 'unknown'; itemId: string }

export const createDownloadedItemDeletionPlan = (
  itemId: string,
  { bibleMode = 'remove' }: DeleteDownloadedItemOptions = {}
): DownloadedItemDeletionPlan => {
  const identity = parseOfflineCopyId(itemId)
  if (!identity) return { kind: 'unknown', itemId }

  switch (identity.kind) {
    case 'strong-lexicon-module':
      return { kind: 'strong-lexicon-module', moduleId: identity.moduleId }
    case 'strong-bible-index':
      return { kind: 'strong-sidecar', versionId: identity.versionId }
    case 'interlinear-index':
      return { kind: 'interlinear-sidecar', language: identity.language }
    case 'database':
      return {
        kind: 'database',
        databaseId: identity.databaseId,
        language: identity.language,
      }
    case 'dictionary':
      return identity
    case 'bible-pericope':
    case 'bible-red-words':
      return createDownloadedItemDeletionPlan(
        createOfflineCopyId({ kind: 'bible', versionId: identity.versionId }),
        { bibleMode }
      )
    case 'bible': {
      const { versionId } = identity
      return {
        kind: 'bible',
        versionId,
        bibleMode,
        strongSidecar:
          bibleMode === 'remove' && isStrongCapableBibleVersion(versionId)
            ? {
                itemId: createOfflineCopyId({
                  kind: 'strong-bible-index',
                  versionId,
                }),
                versionId,
              }
            : undefined,
        interlinearSidecars:
          bibleMode === 'remove' && versionId === 'BHG'
            ? (['fr', 'en'] as ResourceLanguage[]).map(language => ({
                itemId: createOfflineCopyId({
                  kind: 'interlinear-index',
                  versionId: 'BHG',
                  language,
                }),
                language,
              }))
            : undefined,
      }
    }
  }
}

const invalidateAndForgetPublication = async (identity: OfflineCopyIdentity): Promise<void> => {
  resourcePublicationStore.remove(createOfflineCopyId(identity))
  await invalidateOfflineCopyQueries(identity)
}

export const deleteDownloadedItem = async (plan: DownloadedItemDeletionPlan): Promise<void> => {
  if (plan.kind === 'strong-lexicon-module') {
    await removeStrongLexiconModule(plan.moduleId)
    await invalidateAndForgetPublication({
      kind: 'strong-lexicon-module',
      moduleId: plan.moduleId,
    })
    return
  }
  if (plan.kind === 'strong-sidecar') {
    await removeStrongBibleSidecar(plan.versionId)
    await invalidateAndForgetPublication({
      kind: 'strong-bible-index',
      versionId: plan.versionId,
    })
    return
  }

  if (plan.kind === 'interlinear-sidecar') {
    await removeInterlinearSidecar(plan.language)
    await invalidateAndForgetPublication({
      kind: 'interlinear-index',
      versionId: 'BHG',
      language: plan.language,
    })
    return
  }

  if (plan.kind === 'bible') {
    if (plan.strongSidecar) {
      await removeStrongBibleSidecar(plan.strongSidecar.versionId)
      await invalidateAndForgetPublication({
        kind: 'strong-bible-index',
        versionId: plan.strongSidecar.versionId,
      })
    }
    if (plan.interlinearSidecars) {
      await Promise.all(
        plan.interlinearSidecars.map(sidecar => removeInterlinearSidecar(sidecar.language))
      )
      await Promise.all(
        plan.interlinearSidecars.map(sidecar =>
          invalidateAndForgetPublication({
            kind: 'interlinear-index',
            versionId: 'BHG',
            language: sidecar.language,
          })
        )
      )
    }

    const { versionId } = plan
    const installed = await isVersionInstalled(versionId)
    if (installed) {
      await removeBibleVersion(versionId)
    }

    const legacyPath = `${FileSystem.documentDirectory}bible-${versionId}.json`
    const legacyFile = await FileSystem.getInfoAsync(legacyPath)
    if (legacyFile.exists) {
      await FileSystem.deleteAsync(legacyFile.uri)
    }

    await Promise.all([deleteRedWordsFile(versionId), deletePericopeFile(versionId)])
    await Promise.all([
      invalidateAndForgetPublication({ kind: 'bible-red-words', versionId }),
      invalidateAndForgetPublication({ kind: 'bible-pericope', versionId }),
    ])
    await invalidateAndForgetPublication({ kind: 'bible', versionId })
    return
  }

  if (plan.kind === 'database') {
    await dbManager.getDB(plan.databaseId, plan.language).delete()
    await invalidateAndForgetPublication({
      kind: 'database',
      databaseId: plan.databaseId as Exclude<DatabaseId, 'BIBLES'>,
      language: plan.language,
    })
    return
  }

  if (plan.kind === 'dictionary') {
    await FileSystem.deleteAsync(getDictionaryDbPath(plan.work, plan.language), {
      idempotent: true,
    })
    await invalidateAndForgetPublication(plan)
    return
  }

  throw new Error(`UNKNOWN_DOWNLOADED_ITEM:${plan.itemId}`)
}
