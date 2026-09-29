import { createHash, hkdfSync } from 'node:crypto'

import {
  BlobWriter,
  configure,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js'

import type { R2ArtifactStore } from './r2ArtifactPublisher'
import { immutableR2ArtifactKey } from './r2ArtifactPublisher'

// Node has no worker scripts for zip.js; run its codecs on the main thread.
configure({ useWebWorkers: false })

export const ARCHIVE_KEYS_ENV = 'BIBLE_STRONG_ARCHIVE_KEYS'
export const ENCRYPTED_ARCHIVE_ROUTE = '/v1/offline-archives/'
const PASSWORD_SALT = 'bible-strong-offline-archive'
const SHA256_PATTERN = /^[a-f0-9]{64}$/

export type ArchiveKeys = ReadonlyMap<number, Buffer>

export type EncryptedArchiveDescriptor = {
  url: string
  file: string
  sha256: string
  bytes: number
  keyVersion: number
}

/** The catalog fields this workflow reads from a resource entry. */
export type EncryptableCatalogEntry = {
  id: string
  file: string
  archiveSha256: string
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/** Parses `<version>:<base64 32-byte key>` pairs, as the app's config plugin does. */
export const parseArchiveKeys = (value: string | undefined): ArchiveKeys => {
  const keys = new Map<number, Buffer>()
  if (!value?.trim()) return keys
  for (const pair of value.split(',')) {
    const separator = pair.indexOf(':')
    const version = Number(pair.slice(0, separator).trim())
    const key = Buffer.from(pair.slice(separator + 1).trim(), 'base64')
    if (separator <= 0 || !Number.isSafeInteger(version) || version <= 0) {
      throw new Error('ENCRYPTED_ARCHIVE_KEYS_INVALID')
    }
    if (key.length !== 32) throw new Error(`ENCRYPTED_ARCHIVE_KEY_LENGTH_INVALID:${version}`)
    if (keys.has(version)) throw new Error(`ENCRYPTED_ARCHIVE_KEY_DUPLICATE:${version}`)
    keys.set(version, key)
  }
  return keys
}

export const latestArchiveKeyVersion = (keys: ArchiveKeys): number => {
  const versions = [...keys.keys()]
  if (versions.length === 0) throw new Error(`${ARCHIVE_KEYS_ENV}_REQUIRED`)
  return Math.max(...versions)
}

/** Mirrors the native module derivation (ADR-0065); both sides are pinned by test vectors. */
export const deriveOfflineArchivePassword = (
  masterKey: Buffer,
  resourceId: string,
  plainArchiveSha256: string
): string => {
  if (!resourceId || !SHA256_PATTERN.test(plainArchiveSha256)) {
    throw new Error(`ENCRYPTED_ARCHIVE_DERIVATION_INPUT_INVALID:${resourceId}`)
  }
  return Buffer.from(
    hkdfSync('sha256', masterKey, PASSWORD_SALT, `${resourceId}\n${plainArchiveSha256}`, 32)
  ).toString('hex')
}

export const encryptedArchiveFile = (plainFile: string): string => {
  if (!plainFile.endsWith('.zip')) throw new Error(`ENCRYPTED_ARCHIVE_SOURCE_INVALID:${plainFile}`)
  return `${plainFile.slice(0, -'.zip'.length)}.encrypted.zip`
}

export const encryptedArchiveUrl = (apiOrigin: string, file: string, archiveSha256: string) =>
  `${apiOrigin}${ENCRYPTED_ARCHIVE_ROUTE}${file}?sha256=${archiveSha256}`

/** Private index: reuse one encrypted object per plain archive and key version. */
export const encryptedArchiveIndexKey = (keyVersion: number, plainArchiveSha256: string) =>
  `encrypted-archives/v${keyVersion}/${plainArchiveSha256}.json`

const readEntries = async (archive: Uint8Array, password?: string) => {
  const reader = new ZipReader(new Uint8ArrayReader(archive), { password })
  try {
    const files = (await reader.getEntries()).filter(entry => !entry.directory)
    return await Promise.all(
      files.map(async entry => ({
        name: entry.filename,
        encrypted: entry.encrypted,
        bytes: await entry.getData!(new Uint8ArrayWriter()),
      }))
    )
  } finally {
    await reader.close()
  }
}

/** Re-encodes every entry of a plain archive as AES-256 with the given password. */
export const encryptOfflineArchive = async (
  plainArchive: Uint8Array,
  password: string
): Promise<Buffer> => {
  const entries = await readEntries(plainArchive)
  if (entries.length === 0) throw new Error('ENCRYPTED_ARCHIVE_SOURCE_EMPTY')
  const writer = new ZipWriter(new BlobWriter('application/zip'), {
    password,
    encryptionStrength: 3,
    level: 9,
  })
  for (const entry of entries) {
    await writer.add(entry.name, new Uint8ArrayReader(entry.bytes))
  }
  return Buffer.from(await (await writer.close()).arrayBuffer())
}

/**
 * Decrypts the archive again and checks that every entry is encrypted and matches the plain
 * archive's declared content, so a broken encryption never reaches R2.
 */
export const verifyEncryptedOfflineArchive = async (
  encryptedArchive: Uint8Array,
  password: string,
  expectedEntries: ReadonlyMap<string, string>
) => {
  const entries = await readEntries(encryptedArchive, password)
  if (entries.length !== expectedEntries.size)
    throw new Error('ENCRYPTED_ARCHIVE_ENTRY_COUNT_MISMATCH')
  for (const entry of entries) {
    if (!entry.encrypted) throw new Error(`ENCRYPTED_ARCHIVE_ENTRY_NOT_ENCRYPTED:${entry.name}`)
    if (expectedEntries.get(entry.name) !== sha256(entry.bytes)) {
      throw new Error(`ENCRYPTED_ARCHIVE_ENTRY_MISMATCH:${entry.name}`)
    }
  }
}

const readPlainArchive = async (store: R2ArtifactStore, entry: EncryptableCatalogEntry) => {
  // Newer publications live under immutable keys; older ones only under their stable key.
  for (const key of [immutableR2ArtifactKey(entry.file, entry.archiveSha256), entry.file]) {
    const bytes = await store.get(key)
    if (bytes && sha256(bytes) === entry.archiveSha256) return bytes
  }
  throw new Error(`ENCRYPTED_ARCHIVE_PLAIN_SOURCE_MISSING:${entry.id}`)
}

const expectedEntriesFrom = (plainArchive: Uint8Array) =>
  readEntries(plainArchive).then(
    entries => new Map(entries.map(entry => [entry.name, sha256(entry.bytes)]))
  )

const decodeIndex = (bytes: Buffer, keyVersion: number): EncryptedArchiveDescriptor | undefined => {
  const value = JSON.parse(bytes.toString('utf8')) as Partial<EncryptedArchiveDescriptor>
  return value.keyVersion === keyVersion &&
    typeof value.url === 'string' &&
    typeof value.file === 'string' &&
    SHA256_PATTERN.test(value.sha256 ?? '') &&
    Number.isSafeInteger(value.bytes)
    ? (value as EncryptedArchiveDescriptor)
    : undefined
}

export type EnsureEncryptedArchiveResult = {
  status: 'indexed' | 'encrypted' | 'verified-only'
  descriptor: EncryptedArchiveDescriptor
}

/**
 * Returns the encrypted copy of one catalog resource, encrypting and uploading it only when the
 * R2 index has none for this plain SHA and key version. Catalog fields are never trusted here:
 * catalog regeneration drops them, and they do not record the plain SHA they were made from.
 */
export const ensureEncryptedOfflineArchive = async ({
  entry,
  store,
  keys,
  keyVersion,
  apiOrigin,
  dryRun = false,
}: {
  entry: EncryptableCatalogEntry
  store: R2ArtifactStore
  keys: ArchiveKeys
  keyVersion: number
  apiOrigin: string
  dryRun?: boolean
}): Promise<EnsureEncryptedArchiveResult> => {
  const masterKey = keys.get(keyVersion)
  if (!masterKey) throw new Error(`ENCRYPTED_ARCHIVE_KEY_MISSING:${keyVersion}`)
  const file = encryptedArchiveFile(entry.file)
  const indexKey = encryptedArchiveIndexKey(keyVersion, entry.archiveSha256)
  const indexed = await store.get(indexKey)
  const indexedDescriptor = indexed ? decodeIndex(indexed, keyVersion) : undefined
  if (indexedDescriptor?.file === file) return { status: 'indexed', descriptor: indexedDescriptor }

  const plainArchive = await readPlainArchive(store, entry)
  const password = deriveOfflineArchivePassword(masterKey, entry.id, entry.archiveSha256)
  const encrypted = await encryptOfflineArchive(plainArchive, password)
  await verifyEncryptedOfflineArchive(encrypted, password, await expectedEntriesFrom(plainArchive))

  const encryptedSha256 = sha256(encrypted)
  const descriptor: EncryptedArchiveDescriptor = {
    url: encryptedArchiveUrl(apiOrigin, file, encryptedSha256),
    file,
    sha256: encryptedSha256,
    bytes: encrypted.byteLength,
    keyVersion,
  }
  if (dryRun) return { status: 'verified-only', descriptor }

  const objectKey = immutableR2ArtifactKey(file, encryptedSha256)
  await store.putBytes(objectKey, encrypted, 'application/zip')
  const uploaded = await store.get(objectKey)
  if (!uploaded || sha256(uploaded) !== encryptedSha256) {
    throw new Error(`ENCRYPTED_ARCHIVE_VERIFICATION_FAILED:${objectKey}`)
  }
  // The index is written last, so an interrupted run never points at a missing object.
  await store.putBytes(indexKey, Buffer.from(`${JSON.stringify(descriptor)}\n`), 'application/json')
  return { status: 'encrypted', descriptor }
}
