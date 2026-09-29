import {
  extractEncryptedArchive,
  isEncryptedArchiveSupported,
} from '../../modules/bible-strong-archive'
import { toNativeFilePath } from './fileIntegrity'
import { MOBILE_RESOURCE_CATALOG } from './mobileResourceCatalog'

/** Where an Offline copy is downloaded from and how its bytes are checked and extracted. */
export type OfflineArchiveSource =
  | { kind: 'plain'; url: string; archiveSha256: string }
  | {
      kind: 'encrypted'
      url: string
      /** SHA-256 of the downloaded encrypted file. */
      archiveSha256: string
      /** Installed revision and key derivation input: the plain archive SHA-256. */
      plainArchiveSha256: string
      resourceId: string
      keyVersion: number
    }

/**
 * Prefers the public encrypted copy when the catalog declares one and this binary holds its key
 * version (ADR-0065); otherwise keeps the App Check-protected plain archive.
 */
export const resolveOfflineArchiveSource = (
  url: string,
  plainArchiveSha256: string
): OfflineArchiveSource => {
  const entry = Object.values(MOBILE_RESOURCE_CATALOG.resources).find(
    resource => resource.archiveSha256 === plainArchiveSha256
  )
  const encrypted = entry?.encryptedArchive
  if (!entry || !encrypted || !isEncryptedArchiveSupported(encrypted.keyVersion)) {
    return { kind: 'plain', url, archiveSha256: plainArchiveSha256 }
  }
  // Keep the plain URL's origin, so a development build pointed at a local Worker stays there.
  const encryptedUrl = new URL(encrypted.url)
  return {
    kind: 'encrypted',
    url: new URL(`${encryptedUrl.pathname}${encryptedUrl.search}`, new URL(url).origin).toString(),
    archiveSha256: encrypted.sha256,
    plainArchiveSha256,
    resourceId: entry.id,
    keyVersion: encrypted.keyVersion,
  }
}

export const unzipOfflineArchive = async (
  archivePath: string,
  extractionDirectory: string,
  source: OfflineArchiveSource
): Promise<void> => {
  if (source.kind === 'plain') {
    const { unzip } = await import('react-native-zip-archive')
    await unzip(toNativeFilePath(archivePath), toNativeFilePath(extractionDirectory), 'UTF-8')
    return
  }
  await extractEncryptedArchive({
    sourcePath: toNativeFilePath(archivePath),
    destinationPath: toNativeFilePath(extractionDirectory),
    resourceId: source.resourceId,
    archiveSha256: source.plainArchiveSha256,
    keyVersion: source.keyVersion,
  })
}
