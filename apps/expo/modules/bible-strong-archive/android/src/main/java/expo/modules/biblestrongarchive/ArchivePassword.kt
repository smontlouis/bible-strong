package expo.modules.biblestrongarchive

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Per-archive password: HKDF-SHA256(masterKey, salt, "<resource id>\n<plain archive SHA-256>").
 * Publication derives the same password (ADR-0065); keep both implementations in sync.
 */
internal object ArchivePassword {
  private val SALT = "bible-strong-offline-archive".toByteArray(Charsets.UTF_8)
  private val SHA256_PATTERN = Regex("^[0-9a-f]{64}$")

  fun derive(masterKey: ByteArray, resourceId: String, archiveSha256: String): String? {
    if (resourceId.isEmpty() || !SHA256_PATTERN.matches(archiveSha256)) return null
    // RFC 5869 extract, then a single expand block: 32 bytes is one SHA-256 output.
    val pseudorandomKey = hmacSha256(SALT, masterKey)
    val info = "$resourceId\n$archiveSha256".toByteArray(Charsets.UTF_8)
    val okm = hmacSha256(pseudorandomKey, info + byteArrayOf(1))
    return okm.joinToString("") { "%02x".format(it) }
  }

  private fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray =
    Mac.getInstance("HmacSHA256").run {
      init(SecretKeySpec(key, "HmacSHA256"))
      doFinal(data)
    }
}
