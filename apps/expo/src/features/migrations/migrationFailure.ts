export type MigrationFailureKind = 'network' | 'server' | 'integrity' | 'storage' | 'other'

const networkErrorCodes = new Set([
  'OFFLINE',
  'RESOURCE_OFFLINE',
  'RESOURCE_REQUEST_ABORTED',
  'ERR_FILESYSTEM_CANNOT_DOWNLOAD',
])

const serverErrorCodes = new Set([
  'RESOURCE_TEMPORARY_UNAVAILABLE',
  'RESOURCE_RATE_LIMITED',
  'RESOURCE_INTERNAL_FAILURE',
  'RESOURCE_CATALOG_ENTRY_MISSING',
  'RESOURCE_PUBLICATION_NOT_COMMITTED',
])

/**
 * Explains a failed migration from its error code. A code that proves a response came back wins
 * over the device connection; otherwise a connection that looks lost explains the failure.
 */
export const getMigrationFailureKind = (
  errorCode: string | undefined,
  looksOffline: boolean
): MigrationFailureKind => {
  const code = errorCode?.trim().toUpperCase() ?? ''
  if (code === 'RESOURCE_STORAGE_FULL') return 'storage'
  if (/INTEGRITY|CHECKSUM|SHA256|SCHEMA_MISMATCH/.test(code)) return 'integrity'
  if (
    serverErrorCodes.has(code) ||
    /_HTTP_\d{3}$/.test(code) ||
    code.startsWith('RESOURCE_APP_CHECK') ||
    code.startsWith('RESOURCE_APPCHECK')
  ) {
    return 'server'
  }
  if (looksOffline || networkErrorCodes.has(code) || code.endsWith('_TIMEOUT')) return 'network'
  return 'other'
}

export const migrationFailurePresentation: Record<
  MigrationFailureKind,
  {
    icon: 'wifi-off' | 'cloud-off' | 'shield-off' | 'hard-drive' | 'alert-triangle'
    descriptionKey: string
  }
> = {
  network: { icon: 'wifi-off', descriptionKey: 'migration.failedDescription' },
  server: { icon: 'cloud-off', descriptionKey: 'migration.failedServerDescription' },
  integrity: { icon: 'shield-off', descriptionKey: 'migration.failedIntegrityDescription' },
  storage: { icon: 'hard-drive', descriptionKey: 'migration.failedStorageDescription' },
  other: { icon: 'alert-triangle', descriptionKey: 'migration.failedOtherDescription' },
}
