import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { createDevelopmentArtifact } from '../runtime/developmentArtifacts'
import { readMobileResourceCatalog } from './mobileResourceCatalog'
import { validatePublicationBundle } from './publicationBundle'
import { getMobileResourceCatalogId, getPublicationResourceIdentity } from './publicationIdentity'

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

const publishValidatedR2PublicationBundle = async (
  validated: ValidatedPublicationBundle,
  store: R2ArtifactStore,
  stableKey?: string
): Promise<R2ArtifactPublicationResult> => {
  const { manifest, offlineArtifactPath } = validated
  const resourceIdentity = getPublicationResourceIdentity(manifest)
  if (!manifest.rights.offline || !manifest.deliveryCapabilities.offlineDownload) {
    return {
      status: 'skipped',
      resourceIdentity,
      revision: manifest.revision,
      reason: 'offline-download-not-authorized',
    }
  }
  const bytes = await readFile(offlineArtifactPath)
  const artifact = createDevelopmentArtifact(manifest, bytes)
  const key = stableKey ?? artifact.route.slice(1)
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
  store: R2ArtifactStore
): Promise<R2ArtifactPublicationResult> =>
  publishValidatedR2PublicationBundle(await validatePublicationBundle(bundlePath), store)

export const publishR2PublicationCatalog = async (
  bundlePaths: readonly string[],
  mobileCatalogPath: string,
  store: R2ArtifactStore,
  options: {
    onResult?: (result: R2ArtifactPublicationResult, index: number, total: number) => void
  } = {}
): Promise<R2ArtifactPublicationResult[]> => {
  const [validatedBundles, mobileCatalog] = await Promise.all([
    Promise.all(bundlePaths.map(validatePublicationBundle)),
    readMobileResourceCatalog(mobileCatalogPath),
  ])
  const candidates = validatedBundles.map(validated => {
    const catalogId = getMobileResourceCatalogId(validated.manifest)
    const catalogEntry = mobileCatalog.resources.get(catalogId)
    if (!catalogEntry) throw new Error(`R2_PUBLICATION_CATALOG_RESOURCE_MISSING:${catalogId}`)
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
  const results: R2ArtifactPublicationResult[] = []
  for (const candidate of candidates) {
    const result = await publishValidatedR2PublicationBundle(
      candidate.validated,
      store,
      candidate.stableKey
    )
    results.push(result)
    options.onResult?.(result, results.length, candidates.length)
  }
  return results
}
