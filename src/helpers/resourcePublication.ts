import { storage } from './storage'

export interface ResourcePublication {
  generation: string
  md5Hash?: string
  crc32c?: string
  size: number
  etag?: string
}

export interface InstalledResourcePublication extends ResourcePublication {
  sourceUrl: string
  installedAt: number
}

export type ResourcePublicationStatus = 'current' | 'update-available'

export interface ResourcePublicationStorage {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  remove(key: string): void
}

type FetchResponse = {
  ok: boolean
  status?: number
  headers: { get(name: string): string | null }
}

const STORAGE_PREFIX = 'resource-publication:'

const withMetadataCacheBust = (url: string) =>
  `${url}${url.includes('?') ? '&' : '?'}resource_metadata=${Date.now()}`

const parseGoogHash = (value: string | null) => {
  const hashes = Object.fromEntries(
    (value ?? '')
      .split(',')
      .map(part => {
        const normalized = part.trim()
        const separator = normalized.indexOf('=')
        return [normalized.slice(0, separator), normalized.slice(separator + 1)]
      })
      .filter(([key, hash]) => key && hash)
  )
  return { md5Hash: hashes.md5, crc32c: hashes.crc32c }
}

export const publicationFromHeaders = (headers: FetchResponse['headers']): ResourcePublication => {
  const generation = headers.get('x-goog-generation')
  if (!generation) throw new Error('RESOURCE_GENERATION_MISSING')
  const size = Number(headers.get('content-length') ?? 0)
  const hashes = parseGoogHash(headers.get('x-goog-hash'))
  return {
    generation,
    ...hashes,
    size: Number.isFinite(size) ? size : 0,
    etag: headers.get('etag') ?? undefined,
  }
}

export const base64ChecksumToHex = (checksum: string): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let bits = 0
  let bitCount = 0
  const bytes: number[] = []
  for (const character of checksum.replace(/=+$/, '')) {
    const value = alphabet.indexOf(character)
    if (value < 0) throw new Error('RESOURCE_CHECKSUM_INVALID')
    bits = (bits << 6) | value
    bitCount += 6
    if (bitCount >= 8) {
      bitCount -= 8
      bytes.push((bits >> bitCount) & 0xff)
    }
  }
  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export const assertResourceChecksum = (
  publication: ResourcePublication,
  downloadedMd5?: string
): void => {
  if (!publication.md5Hash || !downloadedMd5) {
    throw new Error('RESOURCE_DOWNLOAD_CHECKSUM_MISSING')
  }
  if (base64ChecksumToHex(publication.md5Hash) !== downloadedMd5.toLowerCase()) {
    throw new Error('RESOURCE_DOWNLOAD_CHECKSUM_MISMATCH')
  }
}

export const fetchResourcePublication = async (
  url: string,
  { fetcher = fetch }: { fetcher?: (url: string, init: RequestInit) => Promise<FetchResponse> } = {}
): Promise<ResourcePublication> => {
  const response = await fetcher(withMetadataCacheBust(url), {
    method: 'HEAD',
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  })
  if (!response.ok) throw new Error(`RESOURCE_METADATA_HTTP_${response.status ?? 'ERROR'}`)
  return publicationFromHeaders(response.headers)
}

export const compareResourcePublications = (
  installed: InstalledResourcePublication | undefined,
  remote: ResourcePublication
): ResourcePublicationStatus =>
  installed?.generation === remote.generation ? 'current' : 'update-available'

export const createResourcePublicationStore = (backend: ResourcePublicationStorage) => ({
  read(resourceId: string): InstalledResourcePublication | undefined {
    const value = backend.getString(`${STORAGE_PREFIX}${resourceId}`)
    if (!value) return undefined
    try {
      return JSON.parse(value) as InstalledResourcePublication
    } catch {
      return undefined
    }
  },
  write(resourceId: string, publication: InstalledResourcePublication) {
    backend.set(`${STORAGE_PREFIX}${resourceId}`, JSON.stringify(publication))
  },
  remove(resourceId: string) {
    backend.remove(`${STORAGE_PREFIX}${resourceId}`)
  },
})

export const resourcePublicationStore = createResourcePublicationStore(storage)
