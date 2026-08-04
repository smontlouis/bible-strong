import * as FileSystem from 'expo-file-system/legacy'

import {
  getBibleVersionMetadata,
  getInstalledVersions,
  removeBibleVersion,
} from '~helpers/biblesDb'
import { getLanguage } from '~i18n'
import {
  createInterlinearSidecarDownloadPlan,
  createOfflineCopyDownloadItem,
  createStrongSidecarDownloadPlan,
} from '~helpers/downloadItemFactory'
import { installManagedResource } from '~helpers/managedResourceInstallation'
import { getDownloadItemIdentity, type DownloadItem } from '~helpers/offlineCopy'
import type { OfflineCopyIdentity } from '~helpers/offlineCopyId'
import { BHG_INTERLINEAR_PUBLICATION } from '~helpers/interlinearBiblePublications'
import { getInterlinearSidecarAvailability } from '~helpers/interlinearBibleSidecar'
import { migrateLegacyDownloadQueue } from '~helpers/legacyBibleVersionMigration'
import { storage } from '~helpers/storage'
import { getStrongBiblePublication } from '~helpers/strongBiblePublications'
import { getStrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import { createStrongLexiconModuleDownloadItem } from '~helpers/strongLexiconDownloadItems'
import { getStrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'

import {
  createLegacyResourceMigration,
  type LegacyReplacementResource,
  type LegacyResourceIdentity,
} from './legacyResourceMigration'
import {
  LEGACY_PUBLICATION_CANDIDATES,
  LEGACY_REFERENCE_EVIDENCE_KEY,
  getLegacyResourceFileCandidates,
  inspectLegacyResourceEvidence,
  resetLegacyReferenceEvidenceCaptureState,
} from './legacyResourceEvidence'
import {
  isPersistedCanonicalTabWorkspace,
  migrateLegacyPersistedReferences,
} from './legacyPersistedReferences'

const CLEANUP_MARKER_KEY = 'hasCleanedLegacyBibleResourcesV1'

const toReplacementResource = (item: DownloadItem): LegacyReplacementResource => ({
  identity: getDownloadItemIdentity(item),
  estimatedSize: item.estimatedSize,
  label: item.name,
})

const resolveReplacementPlan = async (
  request: OfflineCopyIdentity
): Promise<LegacyReplacementResource[]> => {
  switch (request.kind) {
    case 'strong-bible-index': {
      const [availability, isCanonicalReady] = await Promise.all([
        getStrongBibleSidecarAvailability(request.versionId),
        isCanonicalBibleReady(request.versionId),
      ])
      if (availability.status === 'available' && isCanonicalReady) return []
      return createStrongSidecarDownloadPlan(
        request.versionId,
        isCanonicalReady ? availability.status : 'base-incompatible'
      ).map(toReplacementResource)
    }
    case 'interlinear-index': {
      const [availability, isCanonicalReady] = await Promise.all([
        getInterlinearSidecarAvailability(request.language),
        isCanonicalBibleReady('BHG'),
      ])
      if (availability.status === 'available' && isCanonicalReady) return []
      return createInterlinearSidecarDownloadPlan(
        request.language,
        isCanonicalReady ? availability.status : 'base-incompatible'
      ).map(toReplacementResource)
    }
    case 'strong-lexicon-module': {
      const availability = await getStrongLexiconModuleAvailability(request.moduleId)
      return availability.status === 'available'
        ? []
        : [toReplacementResource(createStrongLexiconModuleDownloadItem(request.moduleId))]
    }
    default:
      throw new Error(`LEGACY_REPLACEMENT_REQUEST_UNSUPPORTED:${request.kind}`)
  }
}

const isCanonicalBibleReady = async (versionId: string): Promise<boolean> => {
  const metadata = await getBibleVersionMetadata(versionId)
  if (!metadata) return false
  if (versionId === 'BHG') {
    return (
      metadata.textRevision === BHG_INTERLINEAR_PUBLICATION.canonical.textRevision &&
      metadata.textSha256 === BHG_INTERLINEAR_PUBLICATION.canonical.textSha256
    )
  }
  if (versionId === 'LSG' || versionId === 'KJV') {
    const publication = getStrongBiblePublication(versionId)
    return (
      metadata.textRevision === publication.canonical.textRevision &&
      metadata.textSha256 === publication.canonical.textSha256
    )
  }
  return false
}

const isReplacementReady = async (identity: OfflineCopyIdentity): Promise<boolean> => {
  switch (identity.kind) {
    case 'bible':
      return isCanonicalBibleReady(identity.versionId)
    case 'strong-bible-index':
      return (await getStrongBibleSidecarAvailability(identity.versionId)).status === 'available'
    case 'interlinear-index':
      return (await getInterlinearSidecarAvailability(identity.language)).status === 'available'
    case 'strong-lexicon-module':
      return (await getStrongLexiconModuleAvailability(identity.moduleId)).status === 'available'
    default:
      return false
  }
}

const installReplacement = async (
  identity: OfflineCopyIdentity,
  reportProgress: (update: { progress: number; message?: string }) => void
): Promise<void> => {
  const item = createOfflineCopyDownloadItem(identity)
  await installManagedResource(item, {
    onDownloadProgress: progress =>
      reportProgress({ progress: progress * 0.8, message: 'migration.download' }),
    onInsertProgress: progress =>
      reportProgress({ progress: 0.8 + progress * 0.2, message: 'migration.install' }),
    onStatusInserting: () => reportProgress({ progress: 0.8, message: 'migration.install' }),
    onResumable: () => {},
    isCancelled: () => false,
  })
}

const cleanupPathsForIdentity = async (identity: LegacyResourceIdentity): Promise<void> => {
  const documentDirectory = FileSystem.documentDirectory ?? ''
  const candidates = [
    ...getLegacyResourceFileCandidates(documentDirectory, 'fr'),
    ...getLegacyResourceFileCandidates(documentDirectory, 'en'),
  ].filter(candidate => candidate.identity === identity)
  const paths = [...new Set(candidates.map(candidate => candidate.path))]
  await Promise.all(paths.map(path => FileSystem.deleteAsync(path, { idempotent: true })))
}

const cleanupLegacyIdentity = async (identity: LegacyResourceIdentity): Promise<void> => {
  await cleanupPathsForIdentity(identity)
  if (identity !== 'STRONG') {
    const installedVersions = await getInstalledVersions()
    if (installedVersions.includes(identity)) await removeBibleVersion(identity)
  }
}

const finalizeCleanup = async (): Promise<void> => {
  const persistedQueue = storage.getString('downloadQueue')
  if (typeof persistedQueue !== 'undefined') {
    storage.set('downloadQueue', migrateLegacyDownloadQueue(persistedQueue))
  }
  for (const publication of LEGACY_PUBLICATION_CANDIDATES) {
    storage.remove(publication.key)
  }
  storage.remove(LEGACY_REFERENCE_EVIDENCE_KEY)
  const persistedTabGroups = storage.getString('tabGroupsAtom')
  if (persistedTabGroups) {
    try {
      if (isPersistedCanonicalTabWorkspace(JSON.parse(persistedTabGroups) as unknown)) {
        storage.remove('tabsAtom')
        storage.remove('activeTabIndexAtomOriginal')
      }
    } catch {
      // Preserve historical tab state until the canonical workspace is safely persisted.
    }
  }
  resetLegacyReferenceEvidenceCaptureState()
  storage.set(CLEANUP_MARKER_KEY, true)
}

export const legacyResourceMigration = createLegacyResourceMigration({
  inspectEvidence: () =>
    inspectLegacyResourceEvidence({
      documentDirectory: FileSystem.documentDirectory ?? '',
      rootLanguage: getLanguage(),
      storage,
      getInstalledBibleVersions: getInstalledVersions,
      getFileInfo: async path => {
        const info = await FileSystem.getInfoAsync(path)
        return { exists: info.exists, ...(info.exists ? { size: info.size } : {}) }
      },
    }),
  resolveReplacementPlan,
  isReplacementReady,
  installReplacement,
  migratePersistedReferences: async () => migrateLegacyPersistedReferences(storage),
  cleanupLegacyIdentity,
  finalizeCleanup,
})
