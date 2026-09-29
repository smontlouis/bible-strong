import ExpoModulesCore
import SSZipArchive

struct ExtractEncryptedArchiveOptions: Record {
  @Field var sourcePath: String = ""
  @Field var destinationPath: String = ""
  @Field var resourceId: String = ""
  @Field var archiveSha256: String = ""
  @Field var keyVersion: Int = 0
}

public class BibleStrongArchiveModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BibleStrongArchive")

    Function("isKeyAvailable") { (keyVersion: Int) -> Bool in
      ArchiveKeyStore.key(version: keyVersion) != nil
    }

    // Resolves to `{ path }` or `{ errorCode, message }`: Expo wraps thrown exceptions and
    // drops their code, so failures are returned as values to keep codes stable.
    AsyncFunction("extractEncryptedArchive") { (options: ExtractEncryptedArchiveOptions) -> [String: String] in
      do {
        return ["path": try Self.extract(options)]
      } catch let error as ArchiveFailure {
        return ["errorCode": error.errorCode, "message": error.message]
      } catch {
        return ["errorCode": "ARCHIVE_EXTRACTION_FAILED", "message": error.localizedDescription]
      }
    }
  }

  private static func extract(_ options: ExtractEncryptedArchiveOptions) throws -> String {
    guard let masterKey = ArchiveKeyStore.key(version: options.keyVersion) else {
      throw ArchiveFailure("ARCHIVE_KEY_UNAVAILABLE", "This build has no Offline-copy key for the requested version")
    }
    guard let password = ArchivePassword.derive(
      masterKey: masterKey,
      resourceId: options.resourceId,
      archiveSha256: options.archiveSha256
    ) else {
      throw ArchiveFailure("ARCHIVE_INVALID_REQUEST", "The resource id or plain archive SHA-256 is invalid")
    }

    let source = filePath(options.sourcePath)
    let destination = filePath(options.destinationPath)
    guard SSZipArchive.isFilePasswordProtected(atPath: source) else {
      throw ArchiveFailure("ARCHIVE_NOT_ENCRYPTED", "The archive is not password protected")
    }

    do {
      try FileManager.default.createDirectory(atPath: destination, withIntermediateDirectories: true)
      try SSZipArchive.unzipFile(atPath: source, toDestination: destination, overwrite: true, password: password)
    } catch {
      throw ArchiveFailure("ARCHIVE_EXTRACTION_FAILED", error.localizedDescription)
    }
    return destination
  }

  private static func filePath(_ value: String) -> String {
    if value.hasPrefix("file://"), let url = URL(string: value) {
      return url.path
    }
    return value
  }
}

struct ArchiveFailure: Error {
  let errorCode: String
  let message: String

  init(_ errorCode: String, _ message: String) {
    self.errorCode = errorCode
    self.message = message
  }
}
