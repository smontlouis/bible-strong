import type { ResourceLanguage } from '~helpers/databaseTypes'

import type { LegacyResourceEvidence, LegacyResourceIdentity } from './legacyResourceMigration'

export const LEGACY_REFERENCE_EVIDENCE_KEY = 'legacy_resource_reference_evidence_v1'

const LEGACY_IDENTITY_ORDER: LegacyResourceIdentity[] = ['LSGS', 'KJVS', 'INT', 'INT_EN', 'STRONG']
const LEGACY_BIBLE_IDENTITIES = new Set<LegacyResourceIdentity>(['LSGS', 'KJVS', 'INT', 'INT_EN'])
const volatileReferenceEvidence = new Set<LegacyResourceIdentity>()
let referenceEvidenceCaptureFailed = false

export interface LegacyEvidenceStorage {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  remove(key: string): void
}

export interface LegacyResourceFileCandidate {
  identity: LegacyResourceIdentity
  path: string
}

export interface LegacyPublicationCandidate {
  identity: LegacyResourceIdentity
  key: string
}

interface LegacyFileInfo {
  exists: boolean
  size?: number
}

export interface LegacyResourceEvidenceDependencies {
  documentDirectory: string
  rootLanguage: ResourceLanguage
  storage: LegacyEvidenceStorage
  getInstalledBibleVersions(): Promise<string[]>
  getFileInfo(path: string): Promise<LegacyFileInfo>
}

const orderIdentities = (
  identities: Iterable<LegacyResourceIdentity>
): LegacyResourceIdentity[] => {
  const identitySet = new Set(identities)
  return LEGACY_IDENTITY_ORDER.filter(identity => identitySet.has(identity))
}

export const readLegacyReferenceEvidence = (
  backend: LegacyEvidenceStorage
): LegacyResourceIdentity[] => {
  const serialized = backend.getString(LEGACY_REFERENCE_EVIDENCE_KEY)
  if (typeof serialized === 'undefined') return []

  try {
    const value = JSON.parse(serialized) as unknown
    if (
      !Array.isArray(value) ||
      value.some(
        identity =>
          typeof identity !== 'string' ||
          !LEGACY_BIBLE_IDENTITIES.has(identity as LegacyResourceIdentity)
      )
    ) {
      throw new Error('invalid')
    }
    return orderIdentities(value as LegacyResourceIdentity[])
  } catch {
    throw new Error('LEGACY_REFERENCE_EVIDENCE_CORRUPT')
  }
}

export const recordLegacyReferenceEvidence = (
  versionIds: readonly string[],
  backend: LegacyEvidenceStorage
): void => {
  const priorEvidence = readLegacyReferenceEvidence(backend)
  const nextEvidence = orderIdentities([
    ...priorEvidence,
    ...versionIds.filter(versionId =>
      LEGACY_BIBLE_IDENTITIES.has(versionId as LegacyResourceIdentity)
    ),
  ] as LegacyResourceIdentity[])
  if (nextEvidence.length > 0) {
    backend.set(LEGACY_REFERENCE_EVIDENCE_KEY, JSON.stringify(nextEvidence))
  }
}

export const tryRecordLegacyReferenceEvidence = (
  versionIds: readonly string[],
  backend: LegacyEvidenceStorage
): boolean => {
  for (const versionId of versionIds) {
    if (LEGACY_BIBLE_IDENTITIES.has(versionId as LegacyResourceIdentity)) {
      volatileReferenceEvidence.add(versionId as LegacyResourceIdentity)
    }
  }
  try {
    recordLegacyReferenceEvidence([...volatileReferenceEvidence], backend)
    referenceEvidenceCaptureFailed = false
    return true
  } catch {
    referenceEvidenceCaptureFailed = true
    return false
  }
}

export const resetLegacyReferenceEvidenceCaptureState = (): void => {
  volatileReferenceEvidence.clear()
  referenceEvidenceCaptureFailed = false
}

const flushVolatileReferenceEvidence = (backend: LegacyEvidenceStorage): void => {
  if (!referenceEvidenceCaptureFailed) return
  try {
    recordLegacyReferenceEvidence([...volatileReferenceEvidence], backend)
    referenceEvidenceCaptureFailed = false
  } catch {
    throw new Error('LEGACY_REFERENCE_EVIDENCE_CAPTURE_FAILED')
  }
}

const REFERENCE_VERSION_FIELDS = new Set([
  'version',
  'versionId',
  'selectedVersion',
  'defaultBibleVersion',
  'defaultStrongBibleVersionId',
  'strongBibleVersionId',
  'strongBibleSourceVersionId',
  'bibleVersion',
  'preferredVersion',
  'parallelVersions',
])

export const getLegacyReferenceVersionIdsFromReduxState = (value: unknown): string[] => {
  const identities: string[] = []
  const visit = (current: unknown, field?: string): void => {
    if (typeof current === 'string') {
      if (field && REFERENCE_VERSION_FIELDS.has(field)) identities.push(current)
      return
    }
    if (Array.isArray(current)) {
      current.forEach(item => visit(item, field))
      return
    }
    if (!current || typeof current !== 'object') return

    for (const [key, nested] of Object.entries(current)) {
      if (key === 'compare' && nested && typeof nested === 'object' && !Array.isArray(nested)) {
        identities.push(...Object.keys(nested))
      } else {
        visit(nested, key)
      }
    }
  }
  visit(value)
  return identities
}

export const captureLegacyReferenceEvidenceFromReduxState = (
  state: unknown,
  backend: LegacyEvidenceStorage
): void => {
  recordLegacyReferenceEvidence(getLegacyReferenceVersionIdsFromReduxState(state), backend)
}

export const tryCaptureLegacyReferenceEvidenceFromReduxState = (
  state: unknown,
  backend: LegacyEvidenceStorage
): boolean =>
  tryRecordLegacyReferenceEvidence(getLegacyReferenceVersionIdsFromReduxState(state), backend)

const JOTAI_REFERENCE_KEYS = ['tabGroupsAtom', 'tabsAtom', 'savedParallelVersions'] as const

export const getLegacyReferenceVersionIdsFromJotaiStorage = (
  backend: LegacyEvidenceStorage
): string[] =>
  JOTAI_REFERENCE_KEYS.flatMap(key => {
    const serialized = backend.getString(key)
    if (typeof serialized === 'undefined') return []
    try {
      const value = JSON.parse(serialized) as unknown
      if (key === 'savedParallelVersions' && Array.isArray(value)) {
        return value.filter((versionId): versionId is string => typeof versionId === 'string')
      }
      return getLegacyReferenceVersionIdsFromReduxState(value)
    } catch {
      return []
    }
  })

const withTemporaryFiles = (path: string): string[] => [path, `${path}.download`, `${path}.backup`]

const withSqliteCompanionFiles = (path: string): string[] => [
  ...withTemporaryFiles(path),
  `${path}-wal`,
  `${path}-shm`,
  `${path}-journal`,
]

export const getLegacyResourceFileCandidates = (
  documentDirectory: string,
  rootLanguage: ResourceLanguage
): LegacyResourceFileCandidate[] => {
  const candidates: LegacyResourceFileCandidate[] = []
  for (const identity of ['LSGS', 'KJVS'] as const) {
    const lower = identity.toLowerCase()
    const paths = [
      ...withTemporaryFiles(`${documentDirectory}bible-${identity}.json`),
      ...withTemporaryFiles(`${documentDirectory}bible-${lower}.json`),
      ...withTemporaryFiles(`${documentDirectory}bible-${identity}-pericope.json`),
      ...withTemporaryFiles(`${documentDirectory}bible-${lower}-pericope.json`),
      ...withTemporaryFiles(`${documentDirectory}red-words-${identity}.json`),
      ...withTemporaryFiles(`${documentDirectory}red-words-${lower}.json`),
    ]
    candidates.push(...paths.map(path => ({ identity, path })))
  }

  const sqliteDirectory = `${documentDirectory}SQLite`
  const rootInterlinear = withSqliteCompanionFiles(`${sqliteDirectory}/interlineaire.sqlite`)
  candidates.push(
    ...rootInterlinear.map(path => ({
      identity: rootLanguage === 'fr' ? ('INT' as const) : ('INT_EN' as const),
      path,
    })),
    ...withSqliteCompanionFiles(`${sqliteDirectory}/fr/interlineaire.sqlite`).map(path => ({
      identity: 'INT' as const,
      path,
    })),
    ...withSqliteCompanionFiles(`${sqliteDirectory}/en/interlineaire.sqlite`).map(path => ({
      identity: 'INT_EN' as const,
      path,
    }))
  )

  for (const directory of [sqliteDirectory, `${sqliteDirectory}/fr`, `${sqliteDirectory}/en`]) {
    candidates.push(
      ...withSqliteCompanionFiles(`${directory}/strong.sqlite`).map(path => ({
        identity: 'STRONG' as const,
        path,
      }))
    )
  }

  return [...new Map(candidates.map(candidate => [candidate.path, candidate] as const)).values()]
}

export const LEGACY_PUBLICATION_CANDIDATES: LegacyPublicationCandidate[] = [
  { identity: 'LSGS', key: 'resource-publication:bible:LSGS' },
  { identity: 'KJVS', key: 'resource-publication:bible:KJVS' },
  { identity: 'INT', key: 'resource-publication:bible:INT' },
  { identity: 'INT_EN', key: 'resource-publication:bible:INT_EN' },
  { identity: 'LSGS', key: 'resource-publication:bible-pericope:LSGS' },
  { identity: 'KJVS', key: 'resource-publication:bible-pericope:KJVS' },
  { identity: 'LSGS', key: 'resource-publication:bible-red-words:LSGS' },
  { identity: 'KJVS', key: 'resource-publication:bible-red-words:KJVS' },
  { identity: 'INT', key: 'resource-publication:database:INTERLINEAIRE:fr' },
  { identity: 'INT_EN', key: 'resource-publication:database:INTERLINEAIRE:en' },
  { identity: 'STRONG', key: 'resource-publication:database:STRONG:fr' },
  { identity: 'STRONG', key: 'resource-publication:database:STRONG:en' },
]

const getLegacyQueueIdentities = (serialized: string | undefined): LegacyResourceIdentity[] => {
  if (typeof serialized === 'undefined') return []
  try {
    const queue = JSON.parse(serialized) as unknown
    if (!Array.isArray(queue)) return []
    const identities: LegacyResourceIdentity[] = []
    for (const state of queue) {
      if (!state || typeof state !== 'object' || !('item' in state)) continue
      const item = state.item
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      if (
        typeof record.versionId === 'string' &&
        LEGACY_BIBLE_IDENTITIES.has(record.versionId as LegacyResourceIdentity)
      ) {
        identities.push(record.versionId as LegacyResourceIdentity)
      }
      if (record.databaseId === 'STRONG') identities.push('STRONG')
      if (record.databaseId === 'INTERLINEAIRE') {
        identities.push(record.lang === 'en' ? 'INT_EN' : 'INT')
      }
      if (typeof record.id === 'string') {
        const parts = record.id.split(':')
        for (const identity of LEGACY_IDENTITY_ORDER) {
          if (parts.includes(identity)) identities.push(identity)
        }
        if (parts.includes('INTERLINEAIRE')) {
          identities.push(parts.includes('en') ? 'INT_EN' : 'INT')
        }
      }
    }
    return orderIdentities(identities)
  } catch {
    throw new Error('LEGACY_DOWNLOAD_QUEUE_CORRUPT')
  }
}

export const inspectLegacyResourceEvidence = async ({
  documentDirectory,
  rootLanguage,
  storage,
  getInstalledBibleVersions,
  getFileInfo,
}: LegacyResourceEvidenceDependencies): Promise<LegacyResourceEvidence> => {
  flushVolatileReferenceEvidence(storage)
  const identities = new Set<LegacyResourceIdentity>([
    ...readLegacyReferenceEvidence(storage),
    ...volatileReferenceEvidence,
    ...getLegacyReferenceVersionIdsFromJotaiStorage(storage).filter(versionId =>
      LEGACY_BIBLE_IDENTITIES.has(versionId as LegacyResourceIdentity)
    ),
  ] as LegacyResourceIdentity[])
  let reclaimedBytes = 0

  const installedVersions = await getInstalledBibleVersions()
  for (const versionId of installedVersions) {
    if (LEGACY_BIBLE_IDENTITIES.has(versionId as LegacyResourceIdentity)) {
      identities.add(versionId as LegacyResourceIdentity)
    }
  }

  for (const publication of LEGACY_PUBLICATION_CANDIDATES) {
    if (typeof storage.getString(publication.key) !== 'undefined') {
      identities.add(publication.identity)
    }
  }
  for (const identity of getLegacyQueueIdentities(storage.getString('downloadQueue'))) {
    identities.add(identity)
  }

  const candidates = getLegacyResourceFileCandidates(documentDirectory, rootLanguage)
  const results = await Promise.all(
    candidates.map(async candidate => ({ candidate, info: await getFileInfo(candidate.path) }))
  )
  for (const { candidate, info } of results) {
    if (!info.exists) continue
    identities.add(candidate.identity)
    reclaimedBytes += info.size ?? 0
  }

  return {
    legacyIdentities: orderIdentities(identities),
    reclaimedBytes,
  }
}
