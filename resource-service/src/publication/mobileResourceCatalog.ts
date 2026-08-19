import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type MobileResourceCatalogEntry = {
  id: string
  file: string
  entry: string
  entries: Partial<
    Record<'canonical' | 'pericope' | 'redWords', { entry: string; sha256: string; bytes: number }>
  >
  archiveSha256: string
  archiveBytes: number
  contentSha256: string
  resourceRevision?: string
  coreRevision?: string
}

export type MobileResourceCatalog = {
  resources: ReadonlyMap<string, MobileResourceCatalogEntry>
}

const decodeEntry = (id: string, value: unknown): MobileResourceCatalogEntry => {
  if (!value || typeof value !== 'object')
    throw new Error(`MOBILE_RESOURCE_CATALOG_ENTRY_INVALID:${id}`)
  const candidate = value as Partial<MobileResourceCatalogEntry>
  const sha256Pattern = /^[a-f0-9]{64}$/
  const normalizedFile =
    typeof candidate.file === 'string' ? path.posix.normalize(candidate.file) : undefined
  const entries = candidate.entries
  if (
    candidate.id !== id ||
    !normalizedFile ||
    normalizedFile !== candidate.file ||
    normalizedFile.startsWith('/') ||
    normalizedFile.startsWith('../') ||
    !normalizedFile.endsWith('.zip') ||
    typeof candidate.entry !== 'string' ||
    !entries ||
    typeof entries !== 'object' ||
    !entries.canonical ||
    !Object.entries(entries).every(
      ([role, declaration]) =>
        (role === 'canonical' || role === 'pericope' || role === 'redWords') &&
        !!declaration &&
        typeof declaration.entry === 'string' &&
        sha256Pattern.test(declaration.sha256) &&
        Number.isSafeInteger(declaration.bytes) &&
        declaration.bytes > 0
    ) ||
    entries.canonical.entry !== candidate.entry ||
    !sha256Pattern.test(candidate.archiveSha256 ?? '') ||
    !Number.isSafeInteger(candidate.archiveBytes) ||
    (candidate.archiveBytes ?? 0) <= 0 ||
    !sha256Pattern.test(candidate.contentSha256 ?? '')
  ) {
    throw new Error(`MOBILE_RESOURCE_CATALOG_ENTRY_INVALID:${id}`)
  }
  return {
    id,
    file: normalizedFile,
    entry: candidate.entry,
    entries,
    archiveSha256: candidate.archiveSha256!,
    archiveBytes: candidate.archiveBytes!,
    contentSha256: candidate.contentSha256!,
    resourceRevision:
      typeof candidate.resourceRevision === 'string' ? candidate.resourceRevision : undefined,
    coreRevision: typeof candidate.coreRevision === 'string' ? candidate.coreRevision : undefined,
  }
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
