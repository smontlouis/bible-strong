import { createHash } from 'node:crypto'
import path from 'node:path'

import type { PublicationBundleManifest } from '../publication/publicationBundle'

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
  return {
    route: `/bibles/${filename}`,
    bytes,
    headers: {
      'content-type': manifest.offlineArtifact.mediaType,
      'content-length': String(bytes.byteLength),
      'x-goog-generation': manifest.revision,
      'x-goog-hash': `md5=${createHash('md5').update(bytes).digest('base64')}`,
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
