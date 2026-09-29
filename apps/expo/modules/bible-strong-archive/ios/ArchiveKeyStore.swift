/// Key material generated at prebuild by `withBibleStrongArchiveKeys` into `Generated/`.
struct ArchiveKeyMaterialEntry {
  let version: Int
  let masked: [UInt8]
  let mask: [UInt8]
}

enum ArchiveKeyStore {
  static func key(version: Int) -> [UInt8]? {
    guard let entry = ArchiveKeyMaterial.entries.first(where: { $0.version == version }),
      entry.masked.count == entry.mask.count, !entry.masked.isEmpty
    else { return nil }
    return zip(entry.masked, entry.mask).map { $0 ^ $1 }
  }
}
