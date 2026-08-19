import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type MobileResourceCatalogEntry = {
  id: string
  file: string
  archiveSha256: string
  archiveBytes: number
  contentSha256: string
  entries: Readonly<Record<string, { entry: string; sha256: string; bytes: number }>>
}

export type MobileResourceCatalog = {
  resources: ReadonlyMap<string, MobileResourceCatalogEntry>
}

const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)

const decodeEntry = (id: string, value: unknown): MobileResourceCatalogEntry => {
  if (!value || typeof value !== 'object')
    throw new Error(`MOBILE_RESOURCE_CATALOG_ENTRY_INVALID:${id}`)
  const candidate = value as Partial<MobileResourceCatalogEntry>
  const normalizedFile =
    typeof candidate.file === 'string' ? path.posix.normalize(candidate.file) : undefined
  if (
    candidate.id !== id ||
    !normalizedFile ||
    normalizedFile !== candidate.file ||
    normalizedFile.startsWith('/') ||
    normalizedFile.startsWith('../') ||
    !normalizedFile.endsWith('.zip') ||
    !isSha256(candidate.archiveSha256) ||
    !Number.isSafeInteger(candidate.archiveBytes) ||
    candidate.archiveBytes! <= 0 ||
    !isSha256(candidate.contentSha256) ||
    !candidate.entries ||
    typeof candidate.entries !== 'object' ||
    Array.isArray(candidate.entries)
  ) {
    throw new Error(`MOBILE_RESOURCE_CATALOG_ENTRY_INVALID:${id}`)
  }
  const entries = Object.fromEntries(
    Object.entries(candidate.entries).map(([role, entry]) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        typeof entry.entry !== 'string' ||
        !entry.entry ||
        !isSha256(entry.sha256) ||
        !Number.isSafeInteger(entry.bytes) ||
        entry.bytes <= 0
      ) {
        throw new Error(`MOBILE_RESOURCE_CATALOG_ENTRY_ROLE_INVALID:${id}:${role}`)
      }
      return [role, entry]
    })
  )
  if (!entries.canonical) {
    throw new Error(`MOBILE_RESOURCE_CATALOG_ENTRY_ROLE_INVALID:${id}:canonical`)
  }
  return { ...(candidate as MobileResourceCatalogEntry), entries }
}

export const readMobileResourceCatalog = async (
  catalogPath: string
): Promise<MobileResourceCatalog> => {
  const decoded = JSON.parse(await readFile(path.resolve(catalogPath), 'utf8')) as {
    format?: unknown
    schemaVersion?: unknown
    resourceCount?: unknown
    resources?: unknown
  }
  if (
    decoded.format !== 'bible-strong-mobile-resource-catalog' ||
    decoded.schemaVersion !== 1 ||
    !Number.isSafeInteger(decoded.resourceCount) ||
    !decoded.resources ||
    typeof decoded.resources !== 'object' ||
    Array.isArray(decoded.resources)
  ) {
    throw new Error('MOBILE_RESOURCE_CATALOG_INVALID')
  }
  const resources = new Map(
    Object.entries(decoded.resources).map(([id, entry]) => [id, decodeEntry(id, entry)])
  )
  if (resources.size !== decoded.resourceCount) {
    throw new Error('MOBILE_RESOURCE_CATALOG_RESOURCE_COUNT_MISMATCH')
  }
  return { resources }
}
