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
  /** Text the archive carries (a Bible) or was built for (an interlinear index); ADR-0079. */
  textRevision?: string
  textSha256?: string
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
  const declaresText = candidate.textRevision !== undefined || candidate.textSha256 !== undefined
  if (
    declaresText &&
    (typeof candidate.textRevision !== 'string' ||
      candidate.textRevision.length === 0 ||
      !sha256Pattern.test(candidate.textSha256 ?? ''))
  ) {
    throw new Error(`MOBILE_RESOURCE_CATALOG_TEXT_IDENTITY_INVALID:${id}`)
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
    ...(declaresText
      ? { textRevision: candidate.textRevision, textSha256: candidate.textSha256 }
      : {}),
  }
}

/**
 * Interlinear indexes cataloged for another text than the catalog publishes. A reader applies
 * an index to the text it was built for and to no other: both are published together.
 */
export const findInterlinearTextMismatches = (
  resources: ReadonlyMap<string, MobileResourceCatalogEntry>
): string[] =>
  [...resources.entries()]
    .filter(([id, index]) => {
      const versionId = /^bible-interlinear:([^:]+):[^:]+$/u.exec(id)?.[1]
      const text = versionId ? resources.get(`bible:${versionId}`) : undefined
      return (
        text !== undefined &&
        (index.textRevision !== text.textRevision || index.textSha256 !== text.textSha256)
      )
    })
    .map(([id]) => id)
    .sort()

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
  const files = new Set<string>()
  for (const entry of resources.values()) {
    if (files.has(entry.file)) {
      throw new Error(`MOBILE_RESOURCE_CATALOG_DUPLICATE_FILE:${entry.file}`)
    }
    files.add(entry.file)
  }
  const textMismatches = findInterlinearTextMismatches(resources)
  if (textMismatches.length > 0) {
    throw new Error(`MOBILE_RESOURCE_CATALOG_INTERLINEAR_TEXT_MISMATCH:${textMismatches.join(',')}`)
  }
  return { resources }
}
