export const MAX_STRONG_LEXICON_ARCHIVE_BYTES = 64 * 1024 * 1024
export const MAX_STRONG_LEXICON_CONTENT_BYTES = 128 * 1024 * 1024
const MAX_COMPRESSION_RATIO = 250

export type BoundedZipEntryContract = {
  entry: string
  archiveBytes: number
  contentBytes: number
}

const isSafeEntryName = (name: string): boolean =>
  name.length > 0 &&
  !name.endsWith('/') &&
  !name.includes('\\') &&
  name.split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..')

const readU16 = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! | (bytes[offset + 1]! << 8)

const readU32 = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)) >>>
  0

const findEndOfCentralDirectory = (bytes: Uint8Array): number => {
  const minimum = Math.max(0, bytes.byteLength - 65_557)
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (readU32(bytes, offset) === 0x06054b50) return offset
  }
  return -1
}

/**
 * Inspect ZIP central-directory metadata without inflating it. Native unzip
 * is only called after this exact-one-entry and regular-file contract passes.
 */
export const validateBoundedZipArchive = (
  bytes: Uint8Array,
  contract: BoundedZipEntryContract
): void => {
  if (
    !Number.isSafeInteger(contract.archiveBytes) ||
    !Number.isSafeInteger(contract.contentBytes) ||
    contract.archiveBytes !== bytes.byteLength ||
    bytes.byteLength > MAX_STRONG_LEXICON_ARCHIVE_BYTES ||
    contract.contentBytes <= 0 ||
    contract.contentBytes > MAX_STRONG_LEXICON_CONTENT_BYTES ||
    !isSafeEntryName(contract.entry)
  ) {
    throw new Error('STRONG_LEXICON_ARCHIVE_BOUNDS_INVALID')
  }

  const endOfCentralDirectory = findEndOfCentralDirectory(bytes)
  if (endOfCentralDirectory < 0) throw new Error('STRONG_LEXICON_ARCHIVE_INVALID')
  const entryCount = readU16(bytes, endOfCentralDirectory + 10)
  const centralDirectoryBytes = readU32(bytes, endOfCentralDirectory + 12)
  const centralDirectoryOffset = readU32(bytes, endOfCentralDirectory + 16)
  if (
    entryCount !== 1 ||
    centralDirectoryBytes > bytes.byteLength ||
    centralDirectoryOffset > bytes.byteLength ||
    centralDirectoryOffset + centralDirectoryBytes > endOfCentralDirectory
  ) {
    throw new Error('STRONG_LEXICON_ARCHIVE_ENTRY_INVALID')
  }

  const central = centralDirectoryOffset
  if (readU32(bytes, central) !== 0x02014b50) {
    throw new Error('STRONG_LEXICON_ARCHIVE_ENTRY_INVALID')
  }
  const versionMadeBy = readU16(bytes, central + 4)
  const compression = readU16(bytes, central + 10)
  const compressedBytes = readU32(bytes, central + 20)
  const contentBytes = readU32(bytes, central + 24)
  const nameBytes = readU16(bytes, central + 28)
  const extraBytes = readU16(bytes, central + 30)
  const commentBytes = readU16(bytes, central + 32)
  const externalAttributes = readU32(bytes, central + 38)
  const localHeaderOffset = readU32(bytes, central + 42)
  const centralEntryBytes = 46 + nameBytes + extraBytes + commentBytes
  if (
    central + centralEntryBytes !== centralDirectoryOffset + centralDirectoryBytes ||
    nameBytes === 0 ||
    central + centralEntryBytes > bytes.byteLength ||
    compressedBytes === 0xffffffff ||
    contentBytes === 0xffffffff ||
    (compression !== 0 && compression !== 8) ||
    contentBytes !== contract.contentBytes ||
    contentBytes > MAX_STRONG_LEXICON_CONTENT_BYTES ||
    contentBytes > Math.max(compressedBytes * MAX_COMPRESSION_RATIO, 1024 * 1024)
  ) {
    throw new Error('STRONG_LEXICON_ARCHIVE_ENTRY_INVALID')
  }
  const name = new TextDecoder().decode(bytes.subarray(central + 46, central + 46 + nameBytes))
  if (name !== contract.entry || !isSafeEntryName(name)) {
    throw new Error('STRONG_LEXICON_ARCHIVE_ENTRY_INVALID')
  }

  const hostSystem = versionMadeBy >>> 8
  const unixMode = (externalAttributes >>> 16) & 0xf000
  if (
    (hostSystem === 3 && unixMode !== 0x8000) ||
    (hostSystem !== 3 && (externalAttributes & 0x10) !== 0)
  ) {
    throw new Error('STRONG_LEXICON_ARCHIVE_ENTRY_TYPE_INVALID')
  }
  if (readU32(bytes, localHeaderOffset) !== 0x04034b50) {
    throw new Error('STRONG_LEXICON_ARCHIVE_ENTRY_INVALID')
  }
  const localNameBytes = readU16(bytes, localHeaderOffset + 26)
  const localExtraBytes = readU16(bytes, localHeaderOffset + 28)
  const payloadEnd = localHeaderOffset + 30 + localNameBytes + localExtraBytes + compressedBytes
  if (payloadEnd > centralDirectoryOffset) {
    throw new Error('STRONG_LEXICON_ARCHIVE_ENTRY_INVALID')
  }
}
