const LEGACY_BIBLE_IDS = new Set(['LSGS', 'KJVS', 'INT', 'INT_EN'])
const LEGACY_DATABASE_IDS = new Set(['STRONG', 'INTERLINEAIRE'])

type PersistedBibleTabData = {
  selectedVersion: string
  strongMode?: string
  strongBibleSourceVersionId?: string
  interlinearMode?: string
  interlinearLocale?: string
  parallelVersions?: string[]
  /** A mode download the reader asked for: no longer used, dropped on load. */
  pendingModeAcquisition?: unknown
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

export const migrateLegacyParallelVersions = (versions: readonly string[]): string[] =>
  versions.map(migrateLegacyBibleVersionId)

export const migrateLegacyBibleTabData = <T extends PersistedBibleTabData>(data: T): T => {
  const legacyVersion = data.selectedVersion
  const selectedVersion = migrateLegacyBibleVersionId(legacyVersion)
  // Strong and interlinear modes read their resources online or from an Offline copy: nothing
  // is downloaded to turn one on, so a pending download is dropped.
  const { pendingModeAcquisition: _pendingModeAcquisition, ...current } = data
  const migrated = {
    ...current,
    selectedVersion,
    parallelVersions: migrateLegacyParallelVersions(data.parallelVersions ?? []),
  } as PersistedBibleTabData

  // A legacy Strong or interlinear Bible keeps its presentation on the version that replaces it
  if (legacyVersion === 'LSGS' || legacyVersion === 'KJVS') {
    migrated.strongMode = 'visible'
  }

  if (legacyVersion === 'INT' || legacyVersion === 'INT_EN') {
    migrated.strongMode = 'hidden'
    migrated.interlinearMode = 'interlinear'
    migrated.interlinearLocale = legacyVersion === 'INT' ? 'fr' : 'en'
  }

  if (data.strongBibleSourceVersionId) {
    const sourceVersionId = migrateLegacyBibleVersionId(data.strongBibleSourceVersionId)
    migrated.strongBibleSourceVersionId =
      sourceVersionId === 'LSG' || sourceVersionId === 'KJV'
        ? sourceVersionId
        : data.strongBibleSourceVersionId
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
  const databaseId =
    'databaseId' in item && typeof item.databaseId === 'string' ? item.databaseId : ''
  if (LEGACY_DATABASE_IDS.has(databaseId)) return true
  const id = 'id' in item && typeof item.id === 'string' ? item.id : ''
  const idParts = id.split(':')
  return [...LEGACY_BIBLE_IDS, ...LEGACY_DATABASE_IDS].some(legacyId => idParts.includes(legacyId))
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
