package expo.modules.biblestrongarchive

import expo.modules.biblestrongarchive.generated.ArchiveKeyMaterial

/** Key material generated at prebuild by `withBibleStrongArchiveKeys` into `generated/`. */
internal class ArchiveKeyMaterialEntry(val version: Int, val masked: IntArray, val mask: IntArray)

internal object ArchiveKeyStore {
  fun key(version: Int): ByteArray? {
    val entry = ArchiveKeyMaterial.entries.firstOrNull { it.version == version } ?: return null
    if (entry.masked.isEmpty() || entry.masked.size != entry.mask.size) return null
    return ByteArray(entry.masked.size) { index -> (entry.masked[index] xor entry.mask[index]).toByte() }
  }
}
