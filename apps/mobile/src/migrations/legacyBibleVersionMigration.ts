const LEGACY_BIBLE_IDS = new Set(['LSGS', 'KJVS', 'INT', 'INT_EN'])
const LEGACY_DATABASE_IDS = new Set(['STRONG', 'INTERLINEAIRE'])

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

export const migrateLegacyParallelVersions = (versions: readonly string[]): string[] =>
  versions.map(migrateLegacyBibleVersionId)

export const migrateLegacyBibleTabData = <T extends PersistedBibleTabData>(data: T): T => {
  const legacyVersion = data.selectedVersion
  const selectedVersion = migrateLegacyBibleVersionId(legacyVersion)
  const hasLegacyModeAcquisition = isLegacyBibleVersionId(legacyVersion)
  const migrated = {
    ...data,
    selectedVersion,
    parallelVersions: migrateLegacyParallelVersions(data.parallelVersions ?? []),
  } as PersistedBibleTabData

  if (legacyVersion === 'LSGS' || legacyVersion === 'KJVS') {
    migrated.strongMode = 'hidden'
    migrated.pendingModeAcquisition = {
      kind: 'strong',
      versionId: selectedVersion,
      mode: 'visible',
      planIds: [`bible-strong:${selectedVersion}`],
    }
  }

  if (legacyVersion === 'INT' || legacyVersion === 'INT_EN') {
    migrated.strongMode = 'hidden'
    migrated.interlinearMode = 'hidden'
    migrated.interlinearLocale = legacyVersion === 'INT' ? 'fr' : 'en'
    migrated.pendingModeAcquisition = {
      kind: 'interlinear',
      mode: 'interlinear',
      locale: migrated.interlinearLocale,
      planIds: [`bible-interlinear:BHG:${migrated.interlinearLocale}`],
    }
  }

  if (data.strongBibleSourceVersionId) {
    const sourceVersionId = migrateLegacyBibleVersionId(data.strongBibleSourceVersionId)
    migrated.strongBibleSourceVersionId =
      sourceVersionId === 'LSG' || sourceVersionId === 'KJV'
        ? sourceVersionId
        : data.strongBibleSourceVersionId
  }

  if (
    !hasLegacyModeAcquisition &&
    data.pendingModeAcquisition?.kind === 'strong' &&
    data.pendingModeAcquisition.versionId
  ) {
    const pendingVersionId = migrateLegacyBibleVersionId(data.pendingModeAcquisition.versionId)
    migrated.pendingModeAcquisition = {
      ...data.pendingModeAcquisition,
      versionId: pendingVersionId,
      planIds: [`bible-strong:${pendingVersionId}`],
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
