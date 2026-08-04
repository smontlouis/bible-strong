const LEGACY_BIBLE_IDS = new Set(['LSGS', 'KJVS', 'INT', 'INT_EN'])

type PersistedBibleTabData = {
  selectedVersion: string
  strongMode?: string
  strongBibleSourceVersionId?: string
  interlinearMode?: string
  interlinearLocale?: string
  parallelVersions?: string[]
  pendingModeAcquisition?: {
    kind: string
    versionId?: string
    [key: string]: unknown
  }
  entityReference?: {
    preferredVersion?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export const isLegacyBibleVersionId = (versionId: string): boolean =>
  LEGACY_BIBLE_IDS.has(versionId)

export const migrateLegacyBibleVersionId = (versionId: string): string => {
  if (versionId === 'LSGS') return 'LSG'
  if (versionId === 'KJVS') return 'KJV'
  if (versionId === 'INT' || versionId === 'INT_EN') return 'BHG'
  return versionId
}

export const migrateLegacyParallelVersions = (
  versions: readonly string[],
  selectedVersion?: string
): string[] => [
  ...new Set(
    versions.map(migrateLegacyBibleVersionId).filter(versionId => versionId !== selectedVersion)
  ),
]

export const migrateLegacyBibleTabData = <T extends PersistedBibleTabData>(data: T): T => {
  const legacyVersion = data.selectedVersion
  const selectedVersion = migrateLegacyBibleVersionId(legacyVersion)
  const migrated = {
    ...data,
    selectedVersion,
    parallelVersions: migrateLegacyParallelVersions(data.parallelVersions ?? [], selectedVersion),
  } as PersistedBibleTabData

  if (legacyVersion === 'LSGS' || legacyVersion === 'KJVS') {
    migrated.strongMode = 'visible'
  }

  if (legacyVersion === 'INT' || legacyVersion === 'INT_EN') {
    migrated.strongMode = 'hidden'
    migrated.interlinearMode = 'hidden'
    migrated.interlinearLocale = legacyVersion === 'INT' ? 'fr' : 'en'
  }

  if (data.strongBibleSourceVersionId) {
    const sourceVersionId = migrateLegacyBibleVersionId(data.strongBibleSourceVersionId)
    migrated.strongBibleSourceVersionId =
      sourceVersionId === 'LSG' || sourceVersionId === 'KJV'
        ? sourceVersionId
        : data.strongBibleSourceVersionId
  }

  if (data.pendingModeAcquisition?.kind === 'strong' && data.pendingModeAcquisition.versionId) {
    migrated.pendingModeAcquisition = {
      ...data.pendingModeAcquisition,
      versionId: migrateLegacyBibleVersionId(data.pendingModeAcquisition.versionId),
    }
  }

  if (data.entityReference?.preferredVersion) {
    migrated.entityReference = {
      ...data.entityReference,
      preferredVersion: migrateLegacyBibleVersionId(data.entityReference.preferredVersion),
    }
  }

  return migrated as T
}

const isLegacyDownload = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  const item = 'item' in value ? value.item : undefined
  if (!item || typeof item !== 'object') return false
  const versionId = 'versionId' in item && typeof item.versionId === 'string' ? item.versionId : ''
  if (isLegacyBibleVersionId(versionId)) return true
  const id = 'id' in item && typeof item.id === 'string' ? item.id : ''
  return [...LEGACY_BIBLE_IDS].some(legacyId => id.split(':').includes(legacyId))
}

export const migrateLegacyDownloadQueue = (raw: string): string => {
  try {
    const queue = JSON.parse(raw) as unknown
    if (!Array.isArray(queue)) return raw
    return JSON.stringify(queue.filter(item => !isLegacyDownload(item)))
  } catch {
    return raw
  }
}
