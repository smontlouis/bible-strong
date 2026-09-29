package expo.modules.biblestrongarchive

import java.io.File
import java.util.Base64
import net.lingala.zip4j.ZipFile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Vectors come from Node's `crypto.hkdfSync` and `@zip.js/zip.js`, the publication tooling, with a
 * fixed test key. They pin the Kotlin derivation and zip4j extraction to what publication writes.
 */
class ArchivePasswordTest {
  private val testMasterKey = ByteArray(32) { index -> (index + 1).toByte() }
  private val plainSha256 = "a8671609da0052a7afd556651e091882ec848675317f5642efab84346a333354"
  private val expectedPassword = "a4fa97894dc44cbfd4b1bc6aa5e64427a4edfe333bbcfc04dccaa3e47d669c94"
  private val zipJsArchive =
    "UEsDBDMACQBjAG6UPV0AAAAAAAAAAAAAAAAHABQAcWEuanNvbgGZBwACAEFFAwgAVVQFAAHQ6LtqPQ4o8iYz2znOYBLOiCycY7UC" +
      "ZjR0RTIQ0wgj+dctpVQ4ceSsZt2pQwUJL/eDZhef5fSlUG4SRiTj8FBLBwgAAAAAOgAAABwAAABQSwECAAMzAAkAYwBulD1dAAAA" +
      "ADoAAAAcAAAABwAUAAAAAAAAAAAApIEAAAAAcWEuanNvbgGZBwACAEFFAwgAVVQFAAHQ6LtqUEsFBgAAAAABAAEASQAAAIMAAAAA" +
      "AA=="

  @Test
  fun derivesThePublicationPassword() {
    assertEquals(expectedPassword, ArchivePassword.derive(testMasterKey, "bible:QA", plainSha256))
  }

  @Test
  fun rejectsInvalidDerivationInputs() {
    assertNull(ArchivePassword.derive(testMasterKey, "", plainSha256))
    assertNull(ArchivePassword.derive(testMasterKey, "bible:QA", plainSha256.uppercase()))
    assertNull(ArchivePassword.derive(testMasterKey, "bible:QA", "not-a-sha"))
  }

  @Test
  fun extractsAnAesArchiveWrittenByZipJs() {
    val directory = createTempDirectory()
    try {
      val archive = File(directory, "qa-encrypted.zip").apply { writeBytes(Base64.getDecoder().decode(zipJsArchive)) }
      val password = ArchivePassword.derive(testMasterKey, "bible:QA", plainSha256)!!
      ZipFile(archive, password.toCharArray()).use { zipFile ->
        assertEquals(true, zipFile.fileHeaders.all { it.isEncrypted })
        zipFile.extractAll(File(directory, "out").absolutePath)
      }
      assertEquals("{\"check\":\"zip.js-to-native\"}", File(directory, "out/qa.json").readText())
    } finally {
      directory.deleteRecursively()
    }
  }

  private fun createTempDirectory(): File =
    File.createTempFile("bible-strong-archive", "").apply {
      delete()
      mkdirs()
    }
}
