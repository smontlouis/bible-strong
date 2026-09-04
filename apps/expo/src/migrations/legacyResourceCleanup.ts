import type { LegacyResourceIdentity } from './legacyResourceMigration'
import {
  LEGACY_PUBLICATION_CANDIDATES,
  LEGACY_REFERENCE_EVIDENCE_KEY,
  getLegacyResourceFileCandidates,
} from './legacyResourceEvidence'
import { migrateLegacyDownloadQueue } from './legacyBibleVersionMigration'
import { isPersistedCanonicalTabWorkspace } from './legacyPersistedReferences'

interface LegacyResourceCleanupStorage {
  getString(key: string): string | undefined
  set(key: string, value: string | boolean): void
  remove(key: string): void
}

interface LegacyResourceCleanupDependencies {
  documentDirectory: string
  deleteFile(path: string): Promise<void>
  getInstalledBibleVersions(): Promise<string[]>
  removeInstalledBibleVersion(versionId: string): Promise<void>
  storage: LegacyResourceCleanupStorage
  resetReferenceEvidenceCapture(): void
}

const CLEANUP_MARKER_KEY = 'hasCleanedLegacyBibleResourcesV1'

export const createLegacyResourceCleanup = ({
  documentDirectory,
  deleteFile,
  getInstalledBibleVersions,
  removeInstalledBibleVersion,
  storage,
  resetReferenceEvidenceCapture,
}: LegacyResourceCleanupDependencies) => {
  const cleanupLegacyIdentity = async (identity: LegacyResourceIdentity): Promise<void> => {
    const candidates = [
      ...getLegacyResourceFileCandidates(documentDirectory, 'fr'),
      ...getLegacyResourceFileCandidates(documentDirectory, 'en'),
    ].filter(candidate => candidate.identity === identity)
    const paths = [...new Set(candidates.map(candidate => candidate.path))]
    await Promise.all(paths.map(deleteFile))

    if (identity !== 'STRONG') {
      const installedVersions = await getInstalledBibleVersions()
      if (installedVersions.includes(identity)) await removeInstalledBibleVersion(identity)
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
    resetReferenceEvidenceCapture()
    storage.set(CLEANUP_MARKER_KEY, true)
  }

  return { cleanupLegacyIdentity, finalizeCleanup }
}
