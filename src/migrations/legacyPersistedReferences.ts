import {
  isLegacyBibleVersionId,
  migrateLegacyBibleTabData,
  migrateLegacyBibleVersionId,
  migrateLegacyParallelVersions,
} from './legacyBibleVersionMigration'

export interface LegacyPersistedReferenceStorage {
  getString(key: string): string | undefined
  set(key: string, value: string): void
}

export const isPersistedCanonicalTabWorkspace = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    group =>
      Boolean(group) &&
      typeof group === 'object' &&
      typeof (group as Record<string, unknown>).id === 'string' &&
      Array.isArray((group as Record<string, unknown>).tabs) &&
      typeof (group as Record<string, unknown>).activeTabIndex === 'number'
  )

const VERSION_FIELDS = new Set([
  'version',
  'versionId',
  'selectedVersion',
  'defaultBibleVersion',
  'defaultStrongBibleVersionId',
  'strongBibleVersionId',
  'strongBibleSourceVersionId',
  'bibleVersion',
  'preferredVersion',
])

const migrateCompare = (value: Record<string, unknown>): Record<string, unknown> => {
  const migrated: Record<string, unknown> = {}
  for (const [versionId, selection] of Object.entries(value)) {
    const canonicalVersionId = migrateLegacyBibleVersionId(versionId)
    const previous = migrated[canonicalVersionId]
    migrated[canonicalVersionId] =
      typeof previous === 'boolean' && typeof selection === 'boolean'
        ? previous || selection
        : previous === undefined
          ? selection
          : previous
  }
  return migrated
}

const migrateValue = (value: unknown, field?: string): unknown => {
  if (typeof value === 'string') {
    return field && VERSION_FIELDS.has(field) ? migrateLegacyBibleVersionId(value) : value
  }
  if (Array.isArray(value)) {
    if (field === 'parallelVersions' && value.every(item => typeof item === 'string')) {
      return migrateLegacyParallelVersions(value)
    }
    return value.map(item => migrateValue(item))
  }
  if (!value || typeof value !== 'object') return value
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return value

  const source = value as Record<string, unknown>
  const selectedVersion = source.selectedVersion
  const prepared =
    typeof selectedVersion === 'string' && isLegacyBibleVersionId(selectedVersion)
      ? (migrateLegacyBibleTabData(
          source as Record<string, unknown> & { selectedVersion: string }
        ) as Record<string, unknown>)
      : source
  const migrated: Record<string, unknown> = {}

  for (const [key, nested] of Object.entries(prepared)) {
    if (key === 'compare' && nested && typeof nested === 'object' && !Array.isArray(nested)) {
      migrated[key] = migrateCompare(nested as Record<string, unknown>)
    } else if (
      key === 'parallelVersions' &&
      Array.isArray(nested) &&
      nested.every(item => typeof item === 'string')
    ) {
      migrated[key] = migrateLegacyParallelVersions(
        nested,
        typeof prepared.selectedVersion === 'string' ? prepared.selectedVersion : undefined
      )
    } else {
      migrated[key] = migrateValue(nested, key)
    }
  }
  return migrated
}

export const migrateLegacyPersistedValue = (value: unknown): unknown => migrateValue(value)

const migrateJsonStorageKey = (
  backend: LegacyPersistedReferenceStorage,
  key: string,
  migrate: (value: unknown) => unknown = migrateValue
): void => {
  const serialized = backend.getString(key)
  if (typeof serialized === 'undefined') return
  try {
    const nextSerialized = JSON.stringify(migrate(JSON.parse(serialized) as unknown))
    if (nextSerialized !== serialized) backend.set(key, nextSerialized)
  } catch {
    // Preserve malformed state so the owning persistence layer can apply its recovery policy.
  }
}

const migrateReduxPersistRoot = (backend: LegacyPersistedReferenceStorage): void => {
  const serialized = backend.getString('root')
  if (typeof serialized === 'undefined') return

  try {
    const root = JSON.parse(serialized) as unknown
    if (!root || typeof root !== 'object' || Array.isArray(root)) return

    const migratedRoot: Record<string, unknown> = {}
    for (const [key, persistedSlice] of Object.entries(root)) {
      if (typeof persistedSlice !== 'string') {
        migratedRoot[key] = migrateValue(persistedSlice)
        continue
      }
      try {
        migratedRoot[key] = JSON.stringify(migrateValue(JSON.parse(persistedSlice) as unknown))
      } catch {
        migratedRoot[key] = persistedSlice
      }
    }

    const nextSerialized = JSON.stringify(migratedRoot)
    if (nextSerialized !== serialized) backend.set('root', nextSerialized)
  } catch {
    // Preserve malformed state so redux-persist can fall back or recover it.
  }
}

export const migrateLegacyPersistedReferences = (
  backend: LegacyPersistedReferenceStorage
): void => {
  migrateReduxPersistRoot(backend)
  migrateJsonStorageKey(backend, 'tabGroupsAtom')
  migrateJsonStorageKey(backend, 'tabsAtom')
  migrateJsonStorageKey(backend, 'savedParallelVersions', value =>
    Array.isArray(value) && value.every(item => typeof item === 'string')
      ? migrateLegacyParallelVersions(value)
      : value
  )
}
