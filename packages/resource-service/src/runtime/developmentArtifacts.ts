import path from 'node:path'

import mobileResourceCatalog from '@bible-strong/resource-catalog/catalog'

import type { PublicationBundleManifest } from '../publication/publicationBundle'
import { getPublicationIdentityProjection } from '../publication/publicationIdentity'

export type DevelopmentArtifact = {
  route: string
  bytes: Buffer
  headers: Readonly<Record<string, string>>
}

export const createDevelopmentArtifact = (
  manifest: PublicationBundleManifest,
  bytes: Buffer
): DevelopmentArtifact => {
  const filename = path.basename(manifest.offlineArtifact.path)
  const databasePrefix =
    manifest.identity.kind === 'commentary' && manifest.identity.resourceId !== 'MHY'
      ? '/commentaries'
      : (manifest.identity.kind === 'nave' || manifest.identity.kind === 'timeline') &&
          manifest.identity.language === 'en'
        ? '/databases/en'
        : '/databases'
  const databaseKinds = new Set([
    'nave',
    'dictionary',
    'commentary',
    'cross-references',
    'strong-lexicon-module',
    'timeline',
  ])
  // The application asks for the path its catalog lists, which is not always the name of the
  // archive inside the bundle (the BHG bundle ships `bible-bhg.json.zip` for
  // `bibles/bible-step.json.zip`).
  const catalogFile =
    mobileResourceCatalog.resources[getPublicationIdentityProjection(manifest).mobileCatalogId]
      ?.file
  return {
    route: catalogFile
      ? `/${catalogFile}`
      : `${databaseKinds.has(manifest.identity.kind) ? databasePrefix : '/bibles'}/${filename}`,
    bytes,
    headers: {
      'content-type': manifest.offlineArtifact.mediaType,
      'content-length': String(bytes.byteLength),
      etag: manifest.offlineArtifact.sha256,
    },
  }
}

export const respondWithDevelopmentArtifact = (
  request: Pick<Request, 'method' | 'url'>,
  artifact: DevelopmentArtifact
): Response => {
  const pathname = new URL(request.url).pathname
  if (pathname !== artifact.route) return new Response(null, { status: 404 })
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } })
  }
  const body = artifact.bytes.buffer.slice(
    artifact.bytes.byteOffset,
    artifact.bytes.byteOffset + artifact.bytes.byteLength
  ) as ArrayBuffer
  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers: artifact.headers,
  })
}
