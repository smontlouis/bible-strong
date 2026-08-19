import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { createDevelopmentArtifact } from '../runtime/developmentArtifacts'
import {
  isBiblePublicationBundleManifest,
  isCommentaryPublicationBundleManifest,
  isCrossReferencePublicationBundleManifest,
  isDictionaryPublicationBundleManifest,
  isInterlinearBiblePublicationBundleManifest,
  isNavePublicationBundleManifest,
  isStrongLexiconPublicationBundleManifest,
  isTimelinePublicationBundleManifest,
  validatePublicationBundle,
  type PublicationBundleManifest,
} from './publicationBundle'

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

export const getPublicationResourceIdentity = (manifest: PublicationBundleManifest): string =>
  isBiblePublicationBundleManifest(manifest)
    ? `bible-text:${manifest.identity.versionId}`
    : isNavePublicationBundleManifest(manifest)
      ? `nave:${manifest.identity.language}`
      : isDictionaryPublicationBundleManifest(manifest)
        ? `dictionary:${manifest.identity.language}`
        : isCommentaryPublicationBundleManifest(manifest)
          ? `commentary:${manifest.identity.resourceId}:${manifest.identity.language}`
          : isCrossReferencePublicationBundleManifest(manifest)
            ? `cross-references:${manifest.identity.language}`
            : isTimelinePublicationBundleManifest(manifest)
              ? `timeline:${manifest.identity.language}`
              : isInterlinearBiblePublicationBundleManifest(manifest)
                ? `interlinear-index:${manifest.identity.versionId}:${manifest.identity.language}`
                : isStrongLexiconPublicationBundleManifest(manifest)
                  ? manifest.identity.resourceId
                  : `strong-bible-index:${manifest.identity.versionId}`

const publishValidatedR2PublicationBundle = async (
  validated: ValidatedPublicationBundle,
  store: R2ArtifactStore
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
  const key = artifact.route.slice(1)
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
  store: R2ArtifactStore,
  options: {
    onResult?: (result: R2ArtifactPublicationResult, index: number, total: number) => void
  } = {}
): Promise<R2ArtifactPublicationResult[]> => {
  const validatedBundles = await Promise.all(bundlePaths.map(validatePublicationBundle))
  const results: R2ArtifactPublicationResult[] = []
  for (const validated of validatedBundles) {
    const result = await publishValidatedR2PublicationBundle(validated, store)
    results.push(result)
    options.onResult?.(result, results.length, validatedBundles.length)
  }
  return results
}
