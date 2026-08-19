import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type MobileResourceCatalogEntry = {
  id: string
  file: string
}

export type MobileResourceCatalog = {
  resources: ReadonlyMap<string, MobileResourceCatalogEntry>
}

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
    !normalizedFile.endsWith('.zip')
  ) {
    throw new Error(`MOBILE_RESOURCE_CATALOG_ENTRY_INVALID:${id}`)
  }
  return { id, file: normalizedFile }
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
