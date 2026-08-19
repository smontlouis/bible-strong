import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { readMobileResourceCatalog, type MobileResourceCatalogEntry } from './mobileResourceCatalog'
import {
  isStrongLexiconPublicationBundleManifest,
  type PublicationBundleManifest,
  validatePublicationBundle,
} from './publicationBundle'
import { getPublicationIdentityProjection } from './publicationIdentity'

export type R2ArtifactStore = {
  get(key: string): Promise<Buffer | undefined>
  putFile(key: string, filePath: string, mediaType: string): Promise<void>
  putBytes(key: string, bytes: Buffer, mediaType: string): Promise<void>
}

export type R2ArtifactPublicationResult = {
  resourceIdentity: string
  revision: string
} & (
  | {
      status: 'uploaded' | 'unchanged'
      key: string
      bytes: number
      sha256: string
    }
  | {
      status: 'skipped'
      reason: 'offline-download-not-authorized'
    }
)

type ValidatedPublicationBundle = Awaited<ReturnType<typeof validatePublicationBundle>>

export type ValidatedR2PublicationCandidate = {
  validated: ValidatedPublicationBundle
  catalogId: string
  stableKey: string
}

export const immutableR2ArtifactKey = (stableKey: string, archiveSha256: string) =>
  `revisions/${archiveSha256}/${stableKey}`

const catalogMatchesOfflineArtifact = (
  manifest: PublicationBundleManifest,
  catalogEntry: MobileResourceCatalogEntry
): boolean => {
  const artifact = manifest.offlineArtifact
  if (isStrongLexiconPublicationBundleManifest(manifest)) {
    const coreDependency = manifest.dependencies.find(
      dependency => dependency.resourceIdentity === 'strong-lexicon:core'
    )
    if (
      catalogEntry.resourceRevision !== manifest.revision ||
      (manifest.identity.moduleId === 'core'
        ? catalogEntry.coreRevision !== undefined
        : catalogEntry.coreRevision !== coreDependency?.revision)
    ) {
      return false
    }
  }
  if (
    catalogEntry.archiveSha256 !== artifact.sha256 ||
    catalogEntry.archiveBytes !== artifact.bytes ||
    catalogEntry.entry !== artifact.entry
  ) {
    return false
  }

  const declarations = artifact.entries
  if (!declarations) {
    return (
      Object.keys(catalogEntry.entries).length === 1 &&
      catalogEntry.contentSha256 === artifact.contentSha256 &&
      catalogEntry.entries.canonical?.entry === artifact.entry &&
      catalogEntry.entries.canonical.sha256 === artifact.contentSha256
    )
  }

  const roles = ['canonical', 'pericope', 'redWords'] as const
  return roles.every(role => {
    const manifestEntry = declarations[role]
    const catalogArtifactEntry = catalogEntry.entries[role]
    return manifestEntry
      ? !!catalogArtifactEntry &&
          catalogArtifactEntry.entry === manifestEntry.entry &&
          catalogArtifactEntry.sha256 === manifestEntry.sha256 &&
          catalogArtifactEntry.bytes === manifestEntry.bytes
      : catalogArtifactEntry === undefined
  })
}

export const assertCatalogMatchesOfflineArtifact = (
  manifest: PublicationBundleManifest,
  catalogEntry: MobileResourceCatalogEntry,
  catalogId: string
) => {
  if (!catalogMatchesOfflineArtifact(manifest, catalogEntry)) {
    throw new Error(`R2_PUBLICATION_CATALOG_INTEGRITY_MISMATCH:${catalogId}`)
  }
}

const publishValidatedR2PublicationBundle = async (
  validated: ValidatedPublicationBundle,
  store: R2ArtifactStore,
  stableKey: string
): Promise<R2ArtifactPublicationResult> => {
  const { manifest, offlineArtifactPath } = validated
  const { resourceIdentity } = getPublicationIdentityProjection(manifest)
  if (!manifest.rights.offline || !manifest.deliveryCapabilities.offlineDownload) {
    return {
      status: 'skipped',
      resourceIdentity,
      revision: manifest.revision,
      reason: 'offline-download-not-authorized',
    }
  }
  const bytes = await readFile(offlineArtifactPath)
  const key = stableKey
  const metadata = {
    format: 'bible-strong-r2-artifact-metadata',
    schemaVersion: 1,
    resourceIdentity,
    revision: manifest.revision,
    key,
    mediaType: manifest.offlineArtifact.mediaType,
    bytes: manifest.offlineArtifact.bytes,
    sha256: manifest.offlineArtifact.sha256,
    contentSha256: manifest.offlineArtifact.contentSha256,
    md5Base64: createHash('md5').update(bytes).digest('base64'),
  } as const
  const metadataKey = `${key}.metadata.json`
  const metadataBytes = Buffer.from(`${JSON.stringify(metadata)}\n`)

  const existingMetadata = await store.get(metadataKey)
  if (existingMetadata?.equals(metadataBytes)) {
    const existingArtifact = await store.get(key)
    if (
      existingArtifact &&
      existingArtifact.byteLength === metadata.bytes &&
      createHash('sha256').update(existingArtifact).digest('hex') === metadata.sha256
    ) {
      return {
        status: 'unchanged',
        resourceIdentity,
        revision: manifest.revision,
        key,
        bytes: manifest.offlineArtifact.bytes,
        sha256: manifest.offlineArtifact.sha256,
      }
    }
  }

  await store.putFile(key, offlineArtifactPath, manifest.offlineArtifact.mediaType)
  const uploaded = await store.get(key)
  if (
    !uploaded ||
    uploaded.byteLength !== metadata.bytes ||
    createHash('sha256').update(uploaded).digest('hex') !== metadata.sha256
  ) {
    throw new Error(`R2_ARTIFACT_VERIFICATION_FAILED:${key}`)
  }

  await store.putBytes(metadataKey, metadataBytes, 'application/json')
  const uploadedMetadata = await store.get(metadataKey)
  if (!uploadedMetadata || !uploadedMetadata.equals(metadataBytes)) {
    throw new Error(`R2_ARTIFACT_METADATA_VERIFICATION_FAILED:${metadataKey}`)
  }

  return {
    status: 'uploaded',
    resourceIdentity,
    revision: manifest.revision,
    key,
    bytes: manifest.offlineArtifact.bytes,
    sha256: manifest.offlineArtifact.sha256,
  }
}

export const publishR2PublicationBundle = async (
  bundlePath: string,
  stableKey: string,
  store: R2ArtifactStore
): Promise<R2ArtifactPublicationResult> =>
  publishValidatedR2PublicationBundle(await validatePublicationBundle(bundlePath), store, stableKey)

export const validateR2PublicationCatalog = async (
  bundlePaths: readonly string[],
  mobileCatalogPath: string,
  options: {
    expectedCatalogResourceCount?: number
  } = {}
): Promise<ValidatedR2PublicationCandidate[]> => {
  const [validatedBundles, mobileCatalog] = await Promise.all([
    Promise.all(bundlePaths.map(validatePublicationBundle)),
    readMobileResourceCatalog(mobileCatalogPath),
  ])
  if (
    options.expectedCatalogResourceCount !== undefined &&
    mobileCatalog.resources.size !== options.expectedCatalogResourceCount
  ) {
    throw new Error(
      `R2_PUBLICATION_CATALOG_EXPECTED_COUNT_MISMATCH:${mobileCatalog.resources.size}:${options.expectedCatalogResourceCount}`
    )
  }
  const candidates = validatedBundles.map(validated => {
    const { mobileCatalogId: catalogId } = getPublicationIdentityProjection(validated.manifest)
    const catalogEntry = mobileCatalog.resources.get(catalogId)
    if (!catalogEntry) throw new Error(`R2_PUBLICATION_CATALOG_RESOURCE_MISSING:${catalogId}`)
    if (
      !validated.manifest.rights.offline ||
      !validated.manifest.deliveryCapabilities.offlineDownload
    ) {
      throw new Error(`R2_PUBLICATION_CATALOG_OFFLINE_NOT_AUTHORIZED:${catalogId}`)
    }
    assertCatalogMatchesOfflineArtifact(validated.manifest, catalogEntry, catalogId)
    return { validated, catalogId, stableKey: catalogEntry.file }
  })
  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()
  for (const candidate of candidates) {
    if (seenIds.has(candidate.catalogId)) {
      throw new Error(`R2_PUBLICATION_CATALOG_DUPLICATE_RESOURCE:${candidate.catalogId}`)
    }
    if (seenKeys.has(candidate.stableKey)) {
      throw new Error(`R2_PUBLICATION_CATALOG_DUPLICATE_KEY:${candidate.stableKey}`)
    }
    seenIds.add(candidate.catalogId)
    seenKeys.add(candidate.stableKey)
  }
  const missingIds = [...mobileCatalog.resources.keys()].filter(id => !seenIds.has(id))
  if (missingIds.length > 0) {
    throw new Error(`R2_PUBLICATION_CATALOG_INCOMPLETE:${missingIds.join(',')}`)
  }
  return candidates
}

export const publishR2PublicationCatalog = async (
  bundlePaths: readonly string[],
  mobileCatalogPath: string,
  store: R2ArtifactStore,
  options: {
    onResult?: (result: R2ArtifactPublicationResult, index: number, total: number) => void
    expectedCatalogResourceCount?: number
  } = {}
): Promise<R2ArtifactPublicationResult[]> => {
  const candidates = await validateR2PublicationCatalog(bundlePaths, mobileCatalogPath, options)
  const results: R2ArtifactPublicationResult[] = []
  for (const candidate of candidates) {
    const result = await publishValidatedR2PublicationBundle(
      candidate.validated,
      store,
      immutableR2ArtifactKey(
        candidate.stableKey,
        candidate.validated.manifest.offlineArtifact.sha256
      )
    )
    results.push(result)
    options.onResult?.(result, results.length, candidates.length)
  }
  return results
}
