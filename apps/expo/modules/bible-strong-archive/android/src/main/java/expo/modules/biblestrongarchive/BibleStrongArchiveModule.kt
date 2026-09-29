package expo.modules.biblestrongarchive

import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import net.lingala.zip4j.ZipFile
import net.lingala.zip4j.exception.ZipException

class ExtractEncryptedArchiveOptions : Record {
  @Field val sourcePath: String = ""
  @Field val destinationPath: String = ""
  @Field val resourceId: String = ""
  @Field val archiveSha256: String = ""
  @Field val keyVersion: Int = 0
}

class BibleStrongArchiveModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BibleStrongArchive")

    Function("isKeyAvailable") { keyVersion: Int -> ArchiveKeyStore.key(keyVersion) != null }

    // Resolves to `{ path }` or `{ errorCode, message }`, matching iOS, where Expo drops the
    // code of thrown exceptions.
    AsyncFunction("extractEncryptedArchive") { options: ExtractEncryptedArchiveOptions ->
      try {
        mapOf("path" to extract(options))
      } catch (failure: ArchiveFailure) {
        mapOf("errorCode" to failure.errorCode, "message" to (failure.message ?: failure.errorCode))
      } catch (error: Exception) {
        mapOf("errorCode" to "ARCHIVE_EXTRACTION_FAILED", "message" to (error.message ?: "unknown"))
      }
    }
  }

  private fun extract(options: ExtractEncryptedArchiveOptions): String {
    val masterKey =
      ArchiveKeyStore.key(options.keyVersion)
        ?: throw ArchiveFailure("ARCHIVE_KEY_UNAVAILABLE", "This build has no Offline-copy key for the requested version")
    val password =
      ArchivePassword.derive(masterKey, options.resourceId, options.archiveSha256)
        ?: throw ArchiveFailure("ARCHIVE_INVALID_REQUEST", "The resource id or plain archive SHA-256 is invalid")

    val destination = fileFrom(options.destinationPath)
    val zipFile = ZipFile(fileFrom(options.sourcePath), password.toCharArray())
    try {
      val entries = zipFile.fileHeaders.filterNot { it.isDirectory }
      if (entries.isEmpty() || entries.any { !it.isEncrypted }) {
        throw ArchiveFailure("ARCHIVE_NOT_ENCRYPTED", "The archive is not password protected")
      }
      destination.mkdirs()
      zipFile.extractAll(destination.absolutePath)
    } catch (error: ZipException) {
      throw ArchiveFailure("ARCHIVE_EXTRACTION_FAILED", "Encrypted archive extraction failed: ${error.message}")
    } finally {
      zipFile.close()
    }
    return destination.absolutePath
  }

  private fun fileFrom(value: String): File =
    File(if (value.startsWith("file://")) Uri.parse(value).path ?: value else value)
}

internal class ArchiveFailure(val errorCode: String, message: String) : Exception(message)
